"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

import {
  ParticipantImportAccepted,
  ParticipantImportRejected,
  ParticipantImportResult,
  Player,
  Team,
  Tournament,
} from "../../lib/api";
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

type ParticipantPreview = {
  source: string;
  rows: string[];
  accepted: ParticipantImportAccepted[];
  rejected: ParticipantImportRejected[];
};

type RouletteArenaProps = {
  tournament: Tournament;
  engine: ResolvedTournamentEngine;
  players: Player[];
  teams: Team[];
  submitting: boolean;
  onPreviewParticipants?: (rows: string[]) => Promise<ParticipantImportResult | null>;
  onImportParticipants: (rows: string[]) => Promise<ParticipantImportResult | null | unknown>;
  onRemoveParticipant: (playerId: number) => Promise<unknown>;
  onClearParticipants: () => Promise<unknown>;
  onConfirmRoulette: (shuffleSeed: string) => Promise<unknown>;
  onOpenRosterRespin: (durationMinutes: number) => Promise<unknown>;
  onLockRosterRespin: () => Promise<unknown>;
  canRegenerate?: boolean;
};

function splitParticipantRows(value: string) {
  return value.split(/\n/).map((row) => row.replace(/\r$/, ""));
}

function splitLegacyParticipants(value: string) {
  return value
    .split(/[\n,;\t]+/)
    .map((row) => row.trim())
    .filter((row) => row.length > 0);
}

function collapseInternalWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isParticipantImportResult(value: unknown): value is ParticipantImportResult {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<ParticipantImportResult>;
  return Array.isArray(candidate.accepted) && Array.isArray(candidate.rejected);
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

export default function RouletteArena({
  tournament,
  engine,
  players,
  teams,
  submitting,
  onPreviewParticipants,
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
  const [participantPreview, setParticipantPreview] = useState<ParticipantPreview | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [fileMessage, setFileMessage] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const teamSize = engine.teamSize;
  const minimumPlayers = teamSize * 2;
  const missingPlayers = Math.max(minimumPlayers - players.length, 0);
  const hasConfirmedTeams = teams.length > 0;
  const isKillRace = engine.engineKey === "kill_race_bracket";
  const rosterCountdown = formatCountdown(tournament.roster_respin_deadline_at, now);
  const rosterOpen = tournament.roster_status === "respin_open" && rosterCountdown !== "00:00";
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

  const wheelPlayers = useMemo(() => {
    const max = 20;
    const slice = players.slice(0, max);
    if (players.length > max) {
      return [...slice, { id: -1, nickname: `+${players.length - max}` } as Player];
    }
    return slice;
  }, [players]);

  const isHeroMode = players.length >= minimumPlayers && rosterOpen;
  const showBigWheel = isHeroMode || spinning || preview;

  async function persistParticipantPreview() {
    if (!participantPreview || participantPreview.accepted.length === 0) {
      setFileMessage("No hay participantes en preview.");
      return;
    }
    const result = await onImportParticipants(participantPreview.rows);
    if (!result) {
      return;
    }
    setParticipantPreview(null);
    setBulkValue("");
    if (isParticipantImportResult(result)) {
      setFileMessage(`${result.persisted_count} guardados.`);
      return;
    }
    setFileMessage("Participantes guardados.");
  }

  async function handleParsedParticipants(content: string, source: string) {
    if (!onPreviewParticipants) {
      const rows = splitLegacyParticipants(content);
      const accepted = rows.map((row, index) => ({
        line: index + 1,
        raw: row,
        display_name: collapseInternalWhitespace(row),
        activision_id: null,
      }));
      if (accepted.length === 0) {
        setFileMessage("No se detectaron participantes validos.");
        return;
      }
      setParticipantPreview({
        source,
        rows,
        accepted,
        rejected: [],
      });
      setFileMessage(`${source}: ${accepted.length} aceptados.`);
      return;
    }

    const rows = splitParticipantRows(content);
    const result = await onPreviewParticipants(rows);
    if (!result) {
      return;
    }
    if (result.accepted.length === 0 && result.rejected.length === 0) {
      setFileMessage("No se detectaron participantes validos.");
      return;
    }
    setParticipantPreview({
      source,
      rows,
      accepted: result.accepted,
      rejected: result.rejected,
    });
    setFileMessage(
      `${source}: ${result.accepted.length} aceptados${
        result.rejected.length > 0 ? `, ${result.rejected.length} rechazados` : ""
      }.`
    );
  }

  function handleBulkPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void handleParsedParticipants(bulkValue, "Texto");
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
      void handleParsedParticipants(content, `Archivo ${file.name}`);
    };
    reader.onerror = () => setFileMessage("No se pudo leer el archivo.");
    reader.readAsText(file);
  }

  function spinRoulette() {
    if (!rosterOpen || players.length < minimumPlayers) return;
    const nextSeed = `${Date.now()}-${players.length}-${teamSize}`;
    setSeed(nextSeed);
    setSpinning(true);
    window.setTimeout(() => {
      setPreview(buildPreview(players, teamSize, nextSeed));
      setSpinning(false);
    }, 1200);
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
                : participantPreview
                  ? "Preview de import"
                  : "Carga participantes"}
          </span>
          <h2>
            {hasConfirmedTeams
              ? `${teams.length} equipos · ${modeBadge}`
              : preview
                ? "Revisa antes de confirmar"
                : participantPreview
                  ? `${participantPreview.accepted.length} aceptados · ${participantPreview.rejected.length} rechazados`
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

          {participantPreview ? (
            <div className="bf-roulette-tags-v3">
              <div className="bf-roulette-tag-header-v3">
                <span>
                  {participantPreview.accepted.length} listos
                  {participantPreview.rejected.length > 0
                    ? ` · ${participantPreview.rejected.length} rechazados`
                    : ""}
                </span>
                <button
                  type="button"
                  className="bf-button bf-button-primary bf-button-small"
                  disabled={submitting || participantPreview.accepted.length === 0}
                  onClick={() => void persistParticipantPreview()}
                >
                  Guardar
                </button>
              </div>
              <div className="bf-roulette-tag-list-v3">
                {participantPreview.accepted.map((item) => (
                  <span
                    key={`${item.line}-${item.display_name}`}
                    className="bf-roulette-tag-v3"
                  >
                    {item.activision_id
                      ? `${item.display_name} · ${item.activision_id}`
                      : item.display_name}
                  </span>
                ))}
              </div>
              {participantPreview.rejected.length > 0 ? (
                <div className="bf-message" role="status">
                  {participantPreview.rejected.map((item) => (
                    <p key={`${item.line}-${item.raw}`}>
                      Linea {item.line}: {item.reason}
                    </p>
                  ))}
                </div>
              ) : null}
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

        {/* CENTER: Casino Wheel */}
        <div className={`bf-roulette-col bf-roulette-col-wheel${showBigWheel ? " is-hero" : ""}`}>
          {showBigWheel ? (
            <div className="bf-roulette-casino">
              {/* Portal rings (Doctor Strange effect) */}
              <div className={`bf-roulette-portal${spinning ? " is-active" : ""}`} aria-hidden="true">
                <div className="bf-roulette-portal-ring ring-1" />
                <div className="bf-roulette-portal-ring ring-2" />
                <div className="bf-roulette-portal-ring ring-3" />
                <div className="bf-roulette-portal-ring ring-4" />
              </div>

              {/* The wheel */}
              <div className={`bf-roulette-casino-wheel${spinning ? " is-spinning" : ""}`}>
                <div className="bf-roulette-casino-segments">
                  {wheelPlayers.map((player, index) => {
                    const color = SEGMENT_COLORS[index % SEGMENT_COLORS.length];
                    const angle = 360 / Math.max(wheelPlayers.length, 1);
                    const rotation = index * angle;
                    return (
                      <div
                        key={player.id === -1 ? `extra-${index}` : player.id}
                        className="bf-roulette-segment"
                        style={{
                          transform: `rotate(${rotation}deg)`,
                          background: color.bg,
                          color: color.text,
                        }}
                      >
                        <span>{player.nickname.slice(0, 14)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="bf-roulette-casino-center">
                  <strong>{spinning ? "" : preview ? "✓" : "?"}</strong>
                  <span>{players.length}</span>
                </div>
                <div className="bf-roulette-casino-pointer" aria-hidden="true" />
              </div>

              {/* Actions */}
              <div className="bf-roulette-casino-actions">
                {!preview ? (
                  <button
                    type="button"
                    className="bf-button bf-button-primary bf-button-casino"
                    onClick={spinRoulette}
                    disabled={!rosterOpen || submitting || spinning || players.length < minimumPlayers}
                  >
                    {hasConfirmedTeams && canRegenerate ? "REGENERAR" : "GIRAR RULETA"}
                  </button>
                ) : (
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
                )}
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
                  : "Abre respin para generar equipos."}
              </p>
            </div>
          ) : (
            <div className="bf-roulette-casino-idle">
              <div className="bf-roulette-idle-wheel" aria-hidden="true">
                <span>?</span>
              </div>
              <strong>
                {players.length === 0
                  ? "Carga participantes para activar la ruleta"
                  : players.length < minimumPlayers
                    ? `Faltan ${minimumPlayers - players.length} para ${teamSize}v${teamSize}`
                    : rosterOpen
                      ? "Lista para girar"
                      : hasConfirmedTeams
                        ? `${teams.length} equipos confirmados`
                        : "Abre respin para girar"}
              </strong>
              <span>{modeBadge}</span>
            </div>
          )}
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
                <div key={index} className="bf-roulette-seed-row-v3">
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
