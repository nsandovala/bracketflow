"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

import { Player, Team, Tournament } from "../../lib/api";
import { getTeamSeedLabel, getTeamShortDisplayName } from "../../lib/bracketDisplay";
import { ResolvedTournamentEngine } from "../../lib/tournamentModel";

type RouletteArenaProps = {
  tournament: Tournament;
  engine: ResolvedTournamentEngine;
  players: Player[];
  teams: Team[];
  submitting: boolean;
  onImportParticipants: (nicknames: string[]) => Promise<unknown>;
  onRemoveParticipant: (playerId: number) => Promise<unknown>;
  onClearParticipants: () => Promise<unknown>;
  onSpinRoulette?: (shuffleSeed: string) => Promise<unknown>;
  onConfirmRoulette?: (shuffleSeed: string) => Promise<unknown>;
  onOpenRosterRespin: (durationSeconds: number) => Promise<unknown>;
  onCloseRosterRespin?: () => Promise<unknown>;
  onLockRosterRespin: () => Promise<unknown>;
  canRegenerate?: boolean;
};

type TimerState = "idle" | "running" | "closed";
type RoulettePhase = "idle" | "spinning" | "revealing";

type PreviewUpload = {
  label: string;
  names: string[];
};

const WHEEL_SIZE = 340;
const WHEEL_RADIUS = WHEEL_SIZE / 2;
const WHEEL_SEGMENTS = 16;
const DEFAULT_RESPIN_SECONDS = 180;
const MAX_RESPIN_SECONDS = 240;

function clampDuration(value: number) {
  return Math.max(1, Math.min(MAX_RESPIN_SECONDS, value));
}

function cleanParticipantName(value: string) {
  return value
    .trim()
    .replace(/^\uFEFF/, "")
    .replace(/^\s*(?:[-*•]\s+|\d+[\.)]\s*)/, "")
    .trim();
}

function parseParticipants(value: string) {
  const seen = new Set<string>();
  const names: string[] = [];
  const rawParts = value.split(/[\n,;\t]+/);

  rawParts.forEach((raw) => {
    const cleaned = cleanParticipantName(raw);
    if (!cleaned) return;
    const key = cleaned.toLocaleLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    names.push(cleaned);
  });

  return names;
}

function formatTimer(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function polar(cx: number, cy: number, radius: number, degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  return [cx + radius * Math.sin(radians), cy - radius * Math.cos(radians)];
}

function buildSlicePath(start: number, end: number, radius: number) {
  const [x0, y0] = polar(WHEEL_RADIUS, WHEEL_RADIUS, radius, start);
  const [x1, y1] = polar(WHEEL_RADIUS, WHEEL_RADIUS, radius, end);
  return `M ${WHEEL_RADIUS} ${WHEEL_RADIUS} L ${x0} ${y0} A ${radius} ${radius} 0 0 1 ${x1} ${y1} Z`;
}

function buildBracketPairs(teams: Team[]) {
  const pairs: Array<[Team, Team | null]> = [];
  for (let index = 0; index < teams.length; index += 2) {
    pairs.push([teams[index], teams[index + 1] ?? null]);
  }
  return pairs;
}

function playCloseBeep() {
  try {
    const AudioContextCtor =
      window.AudioContext ||
      ((window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext ?? null);
    if (!AudioContextCtor) return;
    const context = new AudioContextCtor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = 784;
    oscillator.connect(gain);
    gain.connect(context.destination);
    const start = context.currentTime;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.16, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
    oscillator.start(start);
    oscillator.stop(start + 0.24);
  } catch {}
}

function RevealRunes({ active, reducedMotion }: { active: boolean; reducedMotion: boolean }) {
  if (!active) return null;
  const ticks = Array.from({ length: 24 }, (_, index) => index * 15);
  return (
    <div
      className={`bf-roulette-runes${reducedMotion ? " is-reduced" : ""}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 200 200">
        <circle className="bf-roulette-runes-core" cx="100" cy="100" r="70" />
        <g className="bf-roulette-runes-ring bf-roulette-runes-ring-a">
          <circle cx="100" cy="100" r="92" />
          <circle cx="100" cy="100" r="84" />
        </g>
        <g className="bf-roulette-runes-ring bf-roulette-runes-ring-b">
          <circle cx="100" cy="100" r="70" />
          <circle cx="100" cy="100" r="60" />
        </g>
        <g className="bf-roulette-runes-ticks">
          {ticks.map((angle) => {
            const [x1, y1] = polar(100, 100, 94, angle);
            const [x2, y2] = polar(100, 100, 100, angle);
            return <line key={angle} x1={x1} y1={y1} x2={x2} y2={y2} />;
          })}
        </g>
      </svg>
    </div>
  );
}

function Wheel({
  disabled,
  participantCount,
  phase,
  rotation,
  reducedMotion,
  onSpin,
}: {
  disabled: boolean;
  participantCount: number;
  phase: RoulettePhase;
  rotation: number;
  reducedMotion: boolean;
  onSpin: () => void;
}) {
  const sliceAngle = 360 / WHEEL_SEGMENTS;
  const spinDurationMs = reducedMotion ? 320 : 4000;

  return (
    <div className="bf-roulette-wheel-shell">
      <svg
        className="bf-roulette-pointer"
        width="28"
        height="22"
        viewBox="0 0 28 22"
        aria-hidden="true"
      >
        <polygon points="14,22 2,2 26,2" />
      </svg>

      <svg
        className="bf-roulette-wheel"
        viewBox={`0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`}
        width="100%"
        height="100%"
        aria-hidden="true"
      >
        <circle
          className="bf-roulette-wheel-ring"
          cx={WHEEL_RADIUS}
          cy={WHEEL_RADIUS}
          r={WHEEL_RADIUS - 2}
        />
        <g
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: "50% 50%",
            transition:
              phase === "spinning"
                ? `transform ${spinDurationMs}ms cubic-bezier(0.15,0.85,0.2,1)`
                : "none",
          }}
        >
          {Array.from({ length: WHEEL_SEGMENTS }, (_, index) => (
            <path
              key={index}
              d={buildSlicePath(index * sliceAngle, (index + 1) * sliceAngle, WHEEL_RADIUS - 5)}
              className={index % 2 === 0 ? "bf-roulette-wheel-slice is-black" : "bf-roulette-wheel-slice is-navy"}
            />
          ))}
        </g>
      </svg>

      <button
        type="button"
        className={`bf-roulette-hub${disabled ? " is-disabled" : ""}${
          !disabled && !reducedMotion && phase === "idle" ? " is-ready" : ""
        }`}
        disabled={disabled}
        aria-label={`Girar ruleta con ${participantCount} participantes`}
        onClick={onSpin}
      >
        <strong>{participantCount}</strong>
        <span>{phase === "spinning" ? "GIRANDO" : "GIRAR"}</span>
      </button>
    </div>
  );
}

export default function RouletteArena({
  tournament,
  engine,
  players,
  teams,
  submitting,
  onImportParticipants,
  onRemoveParticipant,
  onClearParticipants,
  onSpinRoulette,
  onConfirmRoulette,
  onOpenRosterRespin,
  onCloseRosterRespin,
  onLockRosterRespin,
}: RouletteArenaProps) {
  const [bulkValue, setBulkValue] = useState("");
  const [fileMessage, setFileMessage] = useState<string | null>(null);
  const [uploadPreview, setUploadPreview] = useState<PreviewUpload | null>(null);
  const [phase, setPhase] = useState<RoulettePhase>("idle");
  const [rotation, setRotation] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [durationSeconds, setDurationSeconds] = useState(() =>
    clampDuration(engine.config.rouletteRosterDurationSeconds ?? DEFAULT_RESPIN_SECONDS)
  );
  const [reducedMotion, setReducedMotion] = useState(false);
  const [spinPending, setSpinPending] = useState(false);

  const spinTimeoutRef = useRef<number | null>(null);
  const revealTimeoutRef = useRef<number | null>(null);
  const autoClosedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyPreference = () => setReducedMotion(mediaQuery.matches);
    applyPreference();
    mediaQuery.addEventListener("change", applyPreference);
    return () => mediaQuery.removeEventListener("change", applyPreference);
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    return () => {
      if (spinTimeoutRef.current !== null) {
        window.clearTimeout(spinTimeoutRef.current);
      }
      if (revealTimeoutRef.current !== null) {
        window.clearTimeout(revealTimeoutRef.current);
      }
    };
  }, []);

  const teamSize = engine.teamSize;
  const minimumPlayers = teamSize * 2;
  const remainder = players.length % teamSize;
  const missingPlayers = Math.max(minimumPlayers - players.length, 0);
  const poolValid = players.length >= minimumPlayers && remainder === 0;
  const isLocked = tournament.roster_status === "locked";
  const configuredTimerState = engine.config.rouletteRosterTimerState ?? "idle";
  const respinCount = engine.config.rouletteRespinCount ?? 0;
  const lastSpinAt = engine.config.rouletteLastSpinAt ?? engine.config.rouletteGeneratedAt ?? null;
  const countdownSeconds = tournament.roster_respin_deadline_at
    ? Math.max(
        0,
        Math.ceil((new Date(tournament.roster_respin_deadline_at).getTime() - now) / 1000)
      )
    : 0;

  const timerState: TimerState = isLocked
    ? "closed"
    : tournament.roster_status === "respin_open" && countdownSeconds > 0
      ? "running"
      : configuredTimerState === "closed"
        ? "closed"
        : "idle";
  const spinAction = onSpinRoulette ?? onConfirmRoulette;

  useEffect(() => {
    if (timerState !== "running") {
      autoClosedRef.current = false;
      return;
    }
    if (countdownSeconds > 0 || autoClosedRef.current) {
      return;
    }
    autoClosedRef.current = true;
    playCloseBeep();
    if (onCloseRosterRespin) {
      void onCloseRosterRespin();
    }
  }, [countdownSeconds, onCloseRosterRespin, timerState]);

  const sortedPlayers = useMemo(
    () =>
      [...players].sort((left, right) =>
        left.nickname.localeCompare(right.nickname, undefined, { sensitivity: "base" })
      ),
    [players]
  );

  const bracketPairs = useMemo(() => buildBracketPairs(teams), [teams]);

  const canSpin =
    poolValid &&
    phase === "idle" &&
    timerState === "running" &&
    !isLocked &&
    !submitting &&
    spinAction !== undefined &&
    !spinPending;

  const invalidMessage =
    players.length === 0
      ? null
      : players.length < minimumPlayers
        ? `Faltan ${missingPlayers}`
        : remainder !== 0
          ? `Sobran ${remainder}`
          : null;

  async function persistUploadPreview() {
    if (!uploadPreview || uploadPreview.names.length === 0) {
      setFileMessage("No hay participantes para guardar.");
      return;
    }
    await onImportParticipants(uploadPreview.names);
    setUploadPreview(null);
    setFileMessage(`${uploadPreview.names.length} participantes agregados.`);
  }

  async function addFromTextarea() {
    const names = parseParticipants(bulkValue);
    if (names.length === 0) {
      setFileMessage("No se detectaron nombres válidos.");
      return;
    }
    await onImportParticipants(names);
    setBulkValue("");
    setFileMessage(`${names.length} participantes agregados.`);
  }

  function handleFileContent(content: string, label: string) {
    const names = parseParticipants(content);
    if (names.length === 0) {
      setFileMessage("No se detectaron participantes válidos.");
      return;
    }
    setUploadPreview({ label, names });
    setFileMessage(`${label}: ${names.length} detectados.`);
  }

  function handleFileImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const lowerName = file.name.toLocaleLowerCase();
    if (!lowerName.endsWith(".txt") && !lowerName.endsWith(".csv")) {
      setFileMessage("Formato no soportado. Usa .txt o .csv.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === "string" ? reader.result : "";
      handleFileContent(content, `Archivo ${file.name}`);
    };
    reader.onerror = () => setFileMessage("No se pudo leer el archivo.");
    reader.readAsText(file);
  }

  async function handleStartRespin(seconds = durationSeconds) {
    await onOpenRosterRespin(clampDuration(seconds));
  }

  async function handleCloseRespin(manual = true) {
    if (manual) {
      playCloseBeep();
    }
    if (onCloseRosterRespin) {
      await onCloseRosterRespin();
    }
  }

  async function handleSpin() {
    if (!canSpin) return;
    if (!spinAction) return;

    setSpinPending(true);
    setPhase("spinning");
    setRotation((current) => current + (reducedMotion ? 360 : 5 * 360) + Math.floor(Math.random() * 360));

    const spinDuration = reducedMotion ? 320 : 4000;
    const revealDuration = reducedMotion ? 400 : 1300;
    const shuffleSeed =
      typeof window.crypto?.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `${Date.now()}-${players.length}-${teamSize}`;

    spinTimeoutRef.current = window.setTimeout(async () => {
      const result = await spinAction(shuffleSeed);
      if (!result) {
        setSpinPending(false);
        setPhase("idle");
        return;
      }

      setPhase("revealing");
      revealTimeoutRef.current = window.setTimeout(() => {
        setSpinPending(false);
        setPhase("idle");
      }, revealDuration);
    }, spinDuration + 40);
  }

  return (
    <section className="bf-roulette-setup">
      <header className={`bf-roulette-setup-header${timerState === "closed" ? " is-closed" : ""}`}>
        <div className="bf-roulette-setup-timer">
          <span className="bf-roulette-setup-kicker">
            {timerState === "running"
              ? "RESPIN ABIERTO"
              : timerState === "closed"
                ? "RESPIN CERRADO"
                : "RESPIN SIN INICIAR"}
          </span>
          <strong>{formatTimer(timerState === "running" ? countdownSeconds : durationSeconds)}</strong>
          <small>
            {lastSpinAt ? `Último giro ${new Date(lastSpinAt).toLocaleTimeString()}` : "Sin giros todavía"}
          </small>
        </div>

        <div className="bf-roulette-setup-controls">
          <label className="bf-roulette-duration">
            <span>Segundos</span>
            <input
              type="number"
              min={1}
              max={MAX_RESPIN_SECONDS}
              value={durationSeconds}
              disabled={submitting || isLocked}
              onChange={(event) => {
                const next = Number(event.target.value);
                setDurationSeconds(clampDuration(Number.isFinite(next) ? next : DEFAULT_RESPIN_SECONDS));
              }}
            />
          </label>

          <div className="bf-roulette-setup-actions">
            <button
              type="button"
              className="bf-button bf-button-ghost"
              disabled={submitting || timerState === "running" || isLocked}
              onClick={() => void handleStartRespin()}
            >
              Iniciar respin
            </button>
            <button
              type="button"
              className="bf-button bf-button-ghost"
              disabled={submitting || timerState !== "running" || isLocked}
              onClick={() => void handleCloseRespin(true)}
            >
              Cerrar respin ahora
            </button>
            <button
              type="button"
              className="bf-button bf-button-ghost"
              disabled={submitting || isLocked}
              onClick={() => void handleStartRespin(durationSeconds)}
            >
              Reiniciar
            </button>
            <button
              type="button"
              className="bf-button bf-button-primary"
              disabled={submitting || isLocked || timerState !== "closed" || teams.length === 0}
              onClick={() => void onLockRosterRespin()}
            >
              Bloquear y preparar bracket
            </button>
          </div>
        </div>
      </header>

      <div className="bf-roulette-grid">
        <aside className="bf-roulette-panel bf-roulette-panel-participants">
          <div className="bf-roulette-panel-title">
            <span>Participantes</span>
            <strong>
              {players.length} / {minimumPlayers}
            </strong>
          </div>

          <div className="bf-roulette-import-drop">
            <input
              ref={fileInputRef}
              className="bf-roulette-file-input"
              type="file"
              accept=".txt,.csv,text/plain,text/csv"
              onChange={handleFileImport}
              disabled={submitting || isLocked}
            />
            <button
              type="button"
              className="bf-button bf-button-ghost"
              disabled={submitting || isLocked}
              onClick={() => fileInputRef.current?.click()}
            >
              Importar TXT / CSV
            </button>
            <p>El import existente se mantiene y agrega al pool real.</p>
          </div>

          {fileMessage ? <p className="bf-roulette-inline-note">{fileMessage}</p> : null}

          {uploadPreview ? (
            <div className="bf-roulette-upload-preview">
              <div className="bf-roulette-upload-preview-head">
                <span>{uploadPreview.label}</span>
                <button
                  type="button"
                  className="bf-button bf-button-primary bf-button-small"
                  disabled={submitting || isLocked}
                  onClick={() => void persistUploadPreview()}
                >
                  Guardar
                </button>
              </div>
              <div className="bf-roulette-chip-list is-preview">
                {uploadPreview.names.map((name) => (
                  <span key={name} className="bf-roulette-chip">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <textarea
            className="bf-roulette-paste"
            rows={4}
            value={bulkValue}
            disabled={submitting || isLocked}
            onChange={(event) => setBulkValue(event.target.value)}
            placeholder={"Pega nombres aquí\nuno por línea, coma o punto y coma"}
          />
          <div className="bf-roulette-paste-actions">
            <button
              type="button"
              className="bf-button bf-button-primary"
              disabled={submitting || isLocked || bulkValue.trim().length === 0}
              onClick={() => void addFromTextarea()}
            >
              Agregar
            </button>
            <button
              type="button"
              className="bf-button bf-button-ghost"
              disabled={submitting || isLocked || players.length === 0}
              onClick={() => void onClearParticipants()}
            >
              Limpiar
            </button>
          </div>

          {invalidMessage ? (
            <div className="bf-roulette-pool-warning">
              {invalidMessage}
              {players.length < minimumPlayers ? ` para completar ${minimumPlayers}.` : "."}
            </div>
          ) : null}

          <div className="bf-roulette-chip-header">
            <span>{sortedPlayers.length} participantes</span>
            <span>{poolValid ? "Pool listo" : `Team size ${teamSize}`}</span>
          </div>
          <div className="bf-roulette-chip-list">
            {sortedPlayers.map((player) => (
              <span key={player.id} className="bf-roulette-chip">
                {player.nickname}
                {!isLocked ? (
                  <button
                    type="button"
                    aria-label={`Quitar ${player.nickname}`}
                    disabled={submitting}
                    onClick={() => void onRemoveParticipant(player.id)}
                  >
                    ×
                  </button>
                ) : null}
              </span>
            ))}
          </div>
        </aside>

        <section className="bf-roulette-panel bf-roulette-panel-wheel">
          <div className="bf-roulette-panel-title">
            <span>Ruleta</span>
            <strong>
              {teamSize}v{teamSize} · respins {respinCount}
            </strong>
          </div>

          <div className="bf-roulette-wheel-stage">
            <Wheel
              disabled={!canSpin}
              participantCount={players.length}
              phase={phase}
              rotation={rotation}
              reducedMotion={reducedMotion}
              onSpin={() => void handleSpin()}
            />
            <RevealRunes active={phase === "revealing"} reducedMotion={reducedMotion} />
          </div>

          <p className={`bf-roulette-wheel-copy${phase === "revealing" ? " is-highlight" : ""}`}>
            {phase === "spinning"
              ? "Armando equipos..."
              : phase === "revealing"
                ? "Equipos formados."
                : isLocked
                  ? "Equipos bloqueados."
                  : timerState === "closed"
                    ? "Respin cerrado."
                    : !poolValid
                      ? "Ajusta el pool para girar."
                      : timerState !== "running"
                        ? "Inicia respin para habilitar el giro."
                        : teams.length > 0
                          ? "Cada giro re-arma todos los equipos."
                          : "Presiona el centro para armar equipos."}
          </p>
        </section>

        <aside className="bf-roulette-panel bf-roulette-panel-seed">
          <div className="bf-roulette-panel-title">
            <span>Seed del bracket</span>
            <strong>{teams.length > 0 ? `${teams.length} equipos` : "Pendiente"}</strong>
          </div>

          {bracketPairs.length === 0 ? (
            <div className="bf-empty">Gira la ruleta y los emparejamientos aparecen aquí.</div>
          ) : (
            <div key={respinCount} className="bf-roulette-seed-list">
              {bracketPairs.map(([left, right], index) => (
                <article
                  key={`${left.id}-${right?.id ?? "bye"}`}
                  className="bf-roulette-seed-card"
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <span className="bf-roulette-seed-match">M{index + 1}</span>
                  <div className="bf-roulette-seed-team">
                    <strong>{getTeamShortDisplayName(left, teamSize <= 2 ? 2 : 3)}</strong>
                    <small>{getTeamSeedLabel(left, index * 2 + 1)}</small>
                  </div>
                  <em>VS</em>
                  <div className="bf-roulette-seed-team">
                    <strong>
                      {right ? getTeamShortDisplayName(right, teamSize <= 2 ? 2 : 3) : "BYE"}
                    </strong>
                    {right ? <small>{getTeamSeedLabel(right, index * 2 + 2)}</small> : null}
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="bf-roulette-footer-actions">
            <Link
              href={`/standings?tournamentId=${tournament.id}`}
              className={`bf-button bf-button-ghost${isLocked ? "" : " is-disabled-link"}`}
              aria-disabled={!isLocked}
              tabIndex={isLocked ? 0 : -1}
              onClick={(event) => {
                if (!isLocked) event.preventDefault();
              }}
            >
              Ver bracket
            </Link>
            <Link
              href={`/operator?tournamentId=${tournament.id}&tab=bracket`}
              className={`bf-button bf-button-primary${isLocked ? "" : " is-disabled-link"}`}
              aria-disabled={!isLocked}
              tabIndex={isLocked ? 0 : -1}
              onClick={(event) => {
                if (!isLocked) event.preventDefault();
              }}
            >
              Preparar bracket
            </Link>
          </div>
        </aside>
      </div>
    </section>
  );
}
