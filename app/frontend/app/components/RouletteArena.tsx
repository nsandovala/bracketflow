"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";

import { Player, Team, Tournament } from "../../lib/api";
import {
  BracketTeam,
  getTeamDisplayName,
  getTeamSeedLabel,
  getTeamShortDisplayName,
} from "../../lib/bracketDisplay";
import { ResolvedTournamentEngine } from "../../lib/tournamentModel";

type PreviewTeam = {
  name: string;
  players: Player[];
};

type RouletteArenaProps = {
  tournament: Tournament;
  engine: ResolvedTournamentEngine;
  players: Player[];
  teams: Team[];
  submitting: boolean;
  onImportParticipants: (nicknames: string[]) => Promise<unknown>;
  onRemoveParticipant: (playerId: number) => Promise<unknown>;
  onClearParticipants: () => Promise<unknown>;
  onConfirmRoulette: (shuffleSeed: string) => Promise<unknown>;
  onOpenRosterRespin: (durationMinutes: number) => Promise<unknown>;
  onLockRosterRespin: () => Promise<unknown>;
  canRegenerate?: boolean;
};

function cleanParticipantName(value: string) {
  return value
    .trim()
    .replace(/^\uFEFF/, "")
    .replace(/^\s*(?:[-*•]\s+|\d+[\.)]\s*)/, "")
    .trim();
}

function parseParticipants(value: string): { names: string[]; rejected: string[] } {
  const seen = new Set<string>();
  const names: string[] = [];
  const rejected: string[] = [];
  const rawParts = value.split(/[\n,;\t]+/);

  rawParts.forEach((raw) => {
    const cleaned = cleanParticipantName(raw);
    if (!cleaned) return;
    const key = cleaned.toLocaleLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    names.push(cleaned);
  });

  return { names, rejected };
}

function seededRandom(seed: string) {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return () => {
    hash += hash << 13;
    hash ^= hash >>> 7;
    hash += hash << 3;
    hash ^= hash >>> 17;
    hash += hash << 5;
    return ((hash >>> 0) % 100000) / 100000;
  };
}

function buildPreview(players: Player[], teamSize: number, seed: string) {
  const random = seededRandom(seed);
  const shuffled = [...players];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const teams: PreviewTeam[] = [];
  for (let i = 0; i < shuffled.length; i += teamSize) {
    const chunk = shuffled.slice(i, i + teamSize);
    if (chunk.length < teamSize) return { teams, bench: chunk };
    teams.push({ name: `Team ${teams.length + 1}`, players: chunk });
  }
  return { teams, bench: [] as Player[] };
}

function buildBracketPairs<T extends { name: string }>(teams: T[]) {
  const pairs: Array<[T, T | null]> = [];
  for (let i = 0; i < teams.length; i += 2) {
    pairs.push([teams[i], teams[i + 1] ?? null]);
  }
  return pairs;
}

function formatCountdown(deadline: string | null, now: number) {
  if (!deadline) return null;
  const diffMs = new Date(deadline).getTime() - now;
  if (diffMs <= 0) return "00:00";
  const totalSeconds = Math.floor(diffMs / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Pastel casino segment colors (like image 4)
const SEGMENT_COLORS = [
  { bg: "#ff8fa3", text: "#4a0e1a" },
  { bg: "#7ee8c6", text: "#0a2e1f" },
  { bg: "#ffd166", text: "#4a3300" },
  { bg: "#a0c4ff", text: "#0d1b2a" },
  { bg: "#c9a0dc", text: "#2a0e3d" },
  { bg: "#ffb5a7", text: "#4a1a0f" },
  { bg: "#90e0ef", text: "#0a2e3d" },
  { bg: "#ffdac1", text: "#4a2a10" },
  { bg: "#b5e48c", text: "#1a330a" },
  { bg: "#ff9f1c", text: "#4a2200" },
  { bg: "#caffbf", text: "#1a3300" },
  { bg: "#9bf6ff", text: "#0a2a2e" },
  { bg: "#a0c4ff", text: "#0d1b2a" },
  { bg: "#bdb2ff", text: "#1a0e3d" },
  { bg: "#ffc6ff", text: "#4a004a" },
  { bg: "#fdffb6", text: "#3a3a00" },
];

const WHEEL_SIZE = 340;
const WHEEL_R = WHEEL_SIZE / 2;
const WHEEL_SEGMENTS = 16;
const SEG_BLACK = "#0D1117";
const SEG_NAVY = "#1A2942";
const GOLD = "#E8B54D";
const GOLD_SOFT = "#F4CE7A";

const reduceMotion =
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)];
}

function slicePath(a0: number, a1: number, r: number): string {
  const [x0, y0] = polar(WHEEL_R, WHEEL_R, r, a0);
  const [x1, y1] = polar(WHEEL_R, WHEEL_R, r, a1);
  return `M ${WHEEL_R} ${WHEEL_R} L ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1} Z`;
}

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  return `${m}:${String(seconds % 60).padStart(2, "0")}`;
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
  onConfirmRoulette,
  onOpenRosterRespin,
  onLockRosterRespin,
  canRegenerate = true,
}: RouletteArenaProps) {
  const [bulkValue, setBulkValue] = useState("");
  const [seed, setSeed] = useState(() => `${Date.now()}`);
  const [preview, setPreview] = useState<{ teams: PreviewTeam[]; bench: Player[] } | null>(null);
  const [participantPreview, setParticipantPreview] = useState<string[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [fileMessage, setFileMessage] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const spinT = useRef<number | null>(null);
  const revealT = useRef<number | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(timer);
      if (spinT.current) window.clearTimeout(spinT.current);
      if (revealT.current) window.clearTimeout(revealT.current);
    };
  }, []);

  const teamSize = engine.teamSize;
  const minimumPlayers = teamSize * 2;
  const missingPlayers = Math.max(minimumPlayers - players.length, 0);
  const hasConfirmedTeams = teams.length > 0;
  const isKillRace = engine.engineKey === "kill_race_bracket";
  const rosterCountdown = formatCountdown(tournament.roster_respin_deadline_at, now);
  const rosterOpen = tournament.roster_status === "respin_open" && rosterCountdown !== "00:00";
  const timerSecondsRaw = (() => {
    if (!tournament.roster_respin_deadline_at) return 0;
    const diff = new Date(tournament.roster_respin_deadline_at).getTime() - now;
    return Math.max(0, Math.floor(diff / 1000));
  })();
  const timerIsWarning = timerSecondsRaw <= 30;
  const timerIsClosed = tournament.roster_status !== "respin_open" || rosterCountdown === "00:00";
  const modeBadge =
    engine.engineKey === "roulette_ws"
      ? engine.gameMode === "br"
        ? "BR 4v4"
        : "Rebirth 3v3"
      : `${teamSize}v${teamSize}`;
  const confirmedBench = engine.config.rouletteBench ?? [];
  const visiblePreviewTeams = preview?.teams ?? [];
  const visiblePreviewBench = preview?.bench ?? [];
  const resultTeams: BracketTeam[] = preview ? visiblePreviewTeams : teams;
  const bracketPairs = buildBracketPairs(resultTeams);
  const resultBench = preview
    ? visiblePreviewBench.map((p) => p.nickname)
    : confirmedBench;
  const estimatedTeams = Math.floor(players.length / teamSize);
  const estimatedBench = players.length >= teamSize ? players.length % teamSize : players.length;

  const isHeroMode = players.length >= minimumPlayers && rosterOpen;

  async function persistParticipantPreview() {
    if (participantPreview.length === 0) {
      setFileMessage("No hay participantes en preview.");
      return;
    }
    await onImportParticipants(participantPreview);
    setParticipantPreview([]);
    setBulkValue("");
    setFileMessage(`${participantPreview.length} guardados.`);
  }

  function handleParsedParticipants(content: string, source: string) {
    const { names } = parseParticipants(content);
    if (names.length === 0) {
      setFileMessage("No se detectaron participantes validos.");
      return;
    }
    setParticipantPreview(names);
    setFileMessage(`${source}: ${names.length} detectados.`);
  }

  function handleBulkPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    handleParsedParticipants(bulkValue, "Texto");
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
      handleParsedParticipants(content, `Archivo ${file.name}`);
    };
    reader.onerror = () => setFileMessage("No se pudo leer el archivo.");
    reader.readAsText(file);
  }

  function spinRoulette() {
    if (!rosterOpen || players.length < minimumPlayers) return;
    const nextSeed = `${Date.now()}-${players.length}-${teamSize}`;
    setSeed(nextSeed);
    setSpinning(true);
    setRevealing(false);
    setWheelRotation((r) => r + (reduceMotion ? 360 : 5 * 360) + Math.floor(Math.random() * 360));
    const dur = reduceMotion ? 340 : 4050;
    spinT.current = window.setTimeout(() => {
      setPreview(buildPreview(players, teamSize, nextSeed));
      setSpinning(false);
      setRevealing(true);
      revealT.current = window.setTimeout(
        () => setRevealing(false),
        reduceMotion ? 420 : 1350
      );
    }, dur);
  }

  async function confirmRoulette() {
    if (!preview) return;
    await onConfirmRoulette(seed);
    setPreview(null);
  }

  // Team card render
  const renderTeamGrid = () => {
    if (resultTeams.length === 0) {
      return <p className="bf-empty">Gira la ruleta para ver equipos.</p>;
    }
    return (
      <div className="bf-roulette-teams-grid-v3">
        {resultTeams.map((team, index) => {
          const color = SEGMENT_COLORS[index % SEGMENT_COLORS.length];
          const displayName = getTeamDisplayName(team);
          const seedLabel = getTeamSeedLabel(team, index + 1);
          const playerNames = (() => {
            const t = team as unknown as { players?: Player[]; roster?: Array<{ nickname?: string } | string> };
            if (Array.isArray(t.players)) return t.players.map((p) => p.nickname).join(" · ");
            if (Array.isArray(t.roster)) return t.roster.map((p) => (typeof p === "string" ? p : p.nickname ?? "?")).join(" · ");
            return "";
          })();
          return (
            <div
              key={team.name || index}
              className="bf-roulette-team-card-v3"
              style={{
                borderColor: color.bg,
                background: `${color.bg}12`,
                boxShadow: `0 0 16px ${color.bg}22`,
              }}
            >
              <div className="bf-roulette-team-card-head-v3">
                <strong style={{ color: color.text }}>{displayName}</strong>
                <span>{seedLabel}</span>
              </div>
              <div className="bf-roulette-team-card-body-v3" style={{ color: color.text }}>
                {playerNames}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <section className="bf-roulette-arena-v3">
      {/* ---- Header ---- */}
      <div className="bf-roulette-head-v3">
        <div>
          <span className="opr-eyebrow">
            {hasConfirmedTeams
              ? "Equipos confirmados"
              : preview
                ? "Preview de ruleta"
                : participantPreview.length > 0
                  ? "Preview de import"
                  : "Carga participantes"}
          </span>
          <h2>
            {hasConfirmedTeams
              ? `${teams.length} equipos · ${modeBadge}`
              : preview
                ? "Revisa antes de confirmar"
                : participantPreview.length > 0
                  ? `${participantPreview.length} participantes detectados`
                  : rosterOpen
                    ? "Respin abierto · gira la ruleta"
                    : "Carga participantes"}
          </h2>
        </div>
        <div className="bf-roulette-head-side-v3">
          <span className="bf-roulette-badge">{modeBadge}</span>
          {rosterOpen && rosterCountdown ? (
            <span className="bf-roulette-timer">Respin {rosterCountdown}</span>
          ) : hasConfirmedTeams ? (
            <span className="bf-roulette-status-confirmed">Confirmado</span>
          ) : tournament.roster_status === "locked" ? (
            <span className="bf-roulette-status-locked">Locked</span>
          ) : (
            <span className="bf-roulette-status-pending">{players.length} cargados</span>
          )}
        </div>
      </div>

      {!rosterOpen && tournament.roster_status !== "locked" ? (
        <div className="bf-hub-form-actions bf-roulette-open-actions">
          {[3, 4, 5].map((minutes) => (
            <button
              key={minutes}
              type="button"
              className="bf-button bf-button-primary"
              disabled={submitting}
              onClick={() => void onOpenRosterRespin(minutes)}
            >
              Abrir respin {minutes} min
            </button>
          ))}
        </div>
      ) : null}

      {tournament.roster_status === "locked" ? (
        <p className="bf-message">
          Roster locked{tournament.roster_locked_at ? ` · ${tournament.roster_locked_at}` : ""}
        </p>
      ) : null}

      {/* ---- 3-Column Workspace: Players | Wheel | Results ---- */}
      <div className="bf-roulette-workspace-v3">
        {/* LEFT: Participants */}
        <aside className="bf-roulette-col bf-roulette-col-players">
          <div className="bf-roulette-col-title">
            <span>Participantes</span>
            <strong>{players.length} · min {minimumPlayers}</strong>
          </div>

          <form className="bf-roulette-import-v3" onSubmit={handleBulkPreview}>
            <input
              ref={fileInputRef}
              className="bf-roulette-file-input"
              type="file"
              accept=".txt,.csv,text/plain,text/csv"
              onChange={handleFileImport}
              disabled={submitting || tournament.roster_status === "locked"}
            />
            <div className="bf-roulette-import-actions-v3">
              <button
                type="button"
                className="bf-button bf-button-ghost"
                onClick={() => fileInputRef.current?.click()}
                disabled={submitting || tournament.roster_status === "locked"}
              >
                Importar .txt/.csv
              </button>
            </div>
            {fileMessage ? <p className="bf-roulette-file-message">{fileMessage}</p> : null}
            <textarea
              value={bulkValue}
              onChange={(e) => setBulkValue(e.target.value)}
              placeholder={"manteca\ndemian\ncarlos\nlalo\nclara\n\nO: manteca, demian, carlos, lalo, clara"}
              rows={4}
              disabled={submitting || tournament.roster_status === "locked"}
            />
            <div className="bf-hub-form-actions">
              <button
                type="submit"
                className="bf-button bf-button-primary"
                disabled={submitting || tournament.roster_status === "locked" || bulkValue.trim().length === 0}
              >
                Preview
              </button>
            </div>
          </form>

          {participantPreview.length > 0 ? (
            <div className="bf-roulette-tags-v3">
              <div className="bf-roulette-tag-header-v3">
                <span>{participantPreview.length} listos</span>
                <button
                  type="button"
                  className="bf-button bf-button-primary bf-button-small"
                  disabled={submitting}
                  onClick={() => void persistParticipantPreview()}
                >
                  Guardar
                </button>
              </div>
              <div className="bf-roulette-tag-list-v3">
                {participantPreview.map((n) => (
                  <span key={n} className="bf-roulette-tag-v3">{n}</span>
                ))}
              </div>
            </div>
          ) : players.length > 0 ? (
            <div className="bf-roulette-tags-v3">
              <div className="bf-roulette-tag-header-v3">
                {missingPlayers > 0 ? (
                  <span>Faltan {missingPlayers} para {estimatedTeams + 1} equipos</span>
                ) : estimatedBench > 0 ? (
                  <span>{estimatedTeams} equipos · {estimatedBench} banca</span>
                ) : (
                  <span>{estimatedTeams} equipos · sin banca</span>
                )}
                <button
                  type="button"
                  className="bf-roulette-clear-btn"
                  onClick={() => void onClearParticipants()}
                  disabled={submitting || tournament.roster_status === "locked"}
                  title="Limpiar participantes"
                >
                  ×
                </button>
              </div>
              <div className="bf-roulette-tag-list-v3">
                {players.map((p) => (
                  <span key={p.id} className="bf-roulette-tag-v3">
                    {p.nickname}
                    {tournament.roster_status !== "locked" ? (
                      <button
                        type="button"
                        onClick={() => void onRemoveParticipant(p.id)}
                        disabled={submitting}
                        aria-label={`Eliminar ${p.nickname}`}
                      >
                        ×
                      </button>
                    ) : null}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="bf-empty">Todavia no hay participantes.</p>
          )}
        </aside>

        {/* CENTER: Casino Wheel — siempre visible */}
        <div className={`bf-roulette-col bf-roulette-col-wheel${isHeroMode ? " is-hero" : ""}`}>
          <div className="bf-roulette-casino">
            {/* SVG Wheel */}
            <div className="bf-roulette-wheel-wrap">
              {/* Pointer */}
              <svg className="bf-roulette-wheel-pointer-svg" width="28" height="22" viewBox="0 0 28 22">
                <polygon points="14,22 2,2 26,2" fill={GOLD} />
              </svg>

              {/* Wheel SVG */}
              <svg className="bf-roulette-wheel-svg" viewBox={`0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`}>
                {/* Outer ring with glow */}
                <circle cx={WHEEL_R} cy={WHEEL_R} r={WHEEL_R - 2} fill="none" stroke={GOLD} strokeWidth="4" className="bf-roulette-wheel-ring-glow" />
                {/* Segments */}
                <g
                  className="bf-roulette-wheel-group"
                  style={{
                    transform: `rotate(${wheelRotation}deg)`,
                    transformOrigin: "50% 50%",
                  }}
                >
                  {Array.from({ length: WHEEL_SEGMENTS }, (_, i) => {
                    const segAngle = 360 / WHEEL_SEGMENTS;
                    return (
                      <path
                        key={i}
                        d={slicePath(i * segAngle, (i + 1) * segAngle, WHEEL_R - 5)}
                        fill={i % 2 === 0 ? SEG_BLACK : SEG_NAVY}
                        stroke={GOLD}
                        strokeWidth="0.75"
                        strokeOpacity="0.45"
                      />
                    );
                  })}
                </g>
              </svg>

              {/* Arcade Hub Button */}
              <button
                type="button"
                className={`bf-roulette-arcade-hub${!preview && rosterOpen && players.length >= minimumPlayers && !spinning ? " is-ready" : ""}`}
                onClick={spinRoulette}
                disabled={!rosterOpen || submitting || spinning || players.length < minimumPlayers}
                aria-label={`Girar ruleta, ${players.length} jugadores`}
                onMouseDown={(e) => {
                  if (rosterOpen && players.length >= minimumPlayers && !spinning) {
                    e.currentTarget.style.transform = "translate(-50%, -50%) scale(.94)";
                  }
                }}
                onMouseUp={(e) => { e.currentTarget.style.transform = "translate(-50%, -50%) scale(1)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translate(-50%, -50%) scale(1)"; }}
              >
                <div className="hub-count">{players.length}</div>
                <div className="hub-label">{spinning ? "GIRANDO" : "GIRAR"}</div>
              </button>

              {/* Doctor Strange Rings */}
              <div className={`bf-roulette-strange-rings${revealing ? " is-active" : ""}`} aria-hidden="true">
                <svg width="100%" height="100%" viewBox="0 0 200 200" style={{ overflow: "visible" }}>
                  <defs>
                    <radialGradient id="ds-core" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor={GOLD_SOFT} stopOpacity="0.5" />
                      <stop offset="60%" stopColor={GOLD} stopOpacity="0.12" />
                      <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
                    </radialGradient>
                  </defs>
                  <circle cx="100" cy="100" r="70" fill="url(#ds-core)" />
                  <g className="bf-roulette-strange-ring-cw">
                    <circle cx="100" cy="100" r="92" fill="none" stroke={GOLD} strokeWidth="1.5" strokeDasharray="2 7" />
                    <circle cx="100" cy="100" r="86" fill="none" stroke={GOLD} strokeWidth="3" strokeDasharray="16 10" opacity="0.9" />
                  </g>
                  <g className="bf-roulette-strange-ring-ccw">
                    <circle cx="100" cy="100" r="70" fill="none" stroke={GOLD_SOFT} strokeWidth="1.5" strokeDasharray="4 6" />
                    <circle cx="100" cy="100" r="60" fill="none" stroke={GOLD} strokeWidth="1" strokeDasharray="1 5" opacity="0.8" />
                  </g>
                  <g className="bf-roulette-strange-ring-cw-slow">
                    {Array.from({ length: 24 }, (_, i) => {
                      const deg = i * 15;
                      const [x1, y1] = polar(100, 100, 94, deg);
                      const [x2, y2] = polar(100, 100, 100, deg);
                      return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={GOLD} strokeWidth="1.5" opacity="0.9" />;
                    })}
                  </g>
                </svg>
              </div>
            </div>

            {/* Timer below wheel */}
            {rosterOpen && rosterCountdown && (
              <div className="bf-roulette-timer-below">
                <span className="timer-label">Respin</span>
                <span className={`timer-value${timerIsWarning ? " is-warning" : ""}`}>{rosterCountdown}</span>
              </div>
            )}

            {/* Actions */}
            <div className="bf-roulette-casino-actions">
              {preview ? (
                <>
                  <button
                    type="button"
                    className="bf-button bf-button-ghost"
                    onClick={spinRoulette}
                    disabled={!rosterOpen || submitting || spinning}
                  >
                    Regenerar
                  </button>
                  <button
                    type="button"
                    className="bf-button bf-button-primary"
                    onClick={() => void confirmRoulette()}
                    disabled={submitting}
                  >
                    Confirmar
                  </button>
                </>
              ) : null}
              {rosterOpen && hasConfirmedTeams ? (
                <button
                  type="button"
                  className="bf-button bf-button-ghost"
                  disabled={submitting}
                  onClick={() => void onLockRosterRespin()}
                >
                  Locked
                </button>
              ) : null}
            </div>

            <p className="bf-roulette-casino-note">
              {rosterOpen
                ? `Respin abierto · ${players.length} jugadores · ${modeBadge}`
                : players.length === 0
                  ? "Carga participantes para activar la ruleta"
                  : players.length < minimumPlayers
                    ? `Faltan ${minimumPlayers - players.length} para ${teamSize}v${teamSize}`
                    : hasConfirmedTeams
                      ? `${teams.length} equipos confirmados`
                      : "Abre respin para girar"}
            </p>
          </div>
        </div>

        {/* RIGHT: Teams / Seed */}
        <aside className="bf-roulette-col bf-roulette-col-teams">
          <div className="bf-roulette-col-title">
            <span>{isKillRace ? "Seed de bracket" : "Equipos generados"}</span>
            <strong>{resultTeams.length > 0 ? `${resultTeams.length} equipos` : "Pendiente"}</strong>
          </div>

          {isKillRace && bracketPairs.length > 0 ? (
            <div className="bf-roulette-seed-rows-v3">
              {bracketPairs.map(([left, right], index) => (
                <div
                  key={index}
                  className={`bf-roulette-seed-row-v3${preview ? " is-stagger" : ""}`}
                  style={preview ? { animationDelay: `${index * 60}ms` } : undefined}
                >
                  <span className="bf-roulette-seed-num-v3">M{index + 1}</span>
                  <div className="bf-roulette-seed-team-v3">
                    <strong>{getTeamShortDisplayName(left, teamSize <= 2 ? 2 : 3)}</strong>
                    <small>{getTeamSeedLabel(left, index * 2 + 1)}</small>
                  </div>
                  <em className="bf-roulette-seed-vs-v3">VS</em>
                  <div className="bf-roulette-seed-team-v3">
                    <strong>{right ? getTeamShortDisplayName(right, teamSize <= 2 ? 2 : 3) : "BYE"}</strong>
                    {right ? <small>{getTeamSeedLabel(right, index * 2 + 2)}</small> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            renderTeamGrid()
          )}

          {resultBench.length > 0 && (
            <div className="bf-roulette-bench-bar-v3">
              <strong>Banca</strong>
              <span>{resultBench.join(" · ")}</span>
            </div>
          )}

          <div className="bf-hub-form-actions bf-roulette-bottom-actions-v3">
            {isKillRace ? (
              <>
                <Link href={`/operator?tournamentId=${tournament.id}&tab=bracket`} className="bf-button bf-button-primary">
                  Preparar bracket
                </Link>
                <Link href={`/standings?tournamentId=${tournament.id}`} className="bf-button bf-button-ghost">
                  Ver bracket
                </Link>
              </>
            ) : (
              <>
                <Link href={`/operator?tournamentId=${tournament.id}`} className="bf-button bf-button-primary">
                  Ir a Operator
                </Link>
                <Link href={`/standings?tournamentId=${tournament.id}`} className="bf-button bf-button-ghost">
                  Ver Standings
                </Link>
              </>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
