"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";

import { Player, Team, Tournament } from "../../lib/api";
import {
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
  canRegenerate?: boolean;
};

function cleanParticipantName(value: string) {
  return value
    .trim()
    .replace(/^\uFEFF/, "")
    .replace(/^\s*(?:[-*•]\s+|\d+[\.)]\s*)/, "")
    .trim();
}

function validateParticipantName(name: string): { ok: true } | { ok: false; reason: string } {
  if (!name || name.length === 0) {
    return { ok: false, reason: "vacío" };
  }
  if (name.length < 2) {
    return { ok: false, reason: "muy corto" };
  }
  if (name.includes(",")) {
    return { ok: false, reason: "contiene coma interna (probablemente múltiples nombres sin separar)" };
  }
  if (name.includes(";")) {
    return { ok: false, reason: "contiene punto y coma interno" };
  }
  if (name.includes("\t")) {
    return { ok: false, reason: "contiene tab interno" };
  }
  return { ok: true };
}

function parseParticipants(value: string): { names: string[]; rejected: Array<{ raw: string; reason: string }> } {
  const seen = new Set<string>();
  const names: string[] = [];
  const rejected: Array<{ raw: string; reason: string }> = [];

  // Split by newlines, commas, semicolons, tabs, OR multiple spaces (2+)
  const rawParts = value.split(/[\n,;\t]+|\s{2,}/);

  rawParts.forEach((raw) => {
    const cleaned = cleanParticipantName(raw);
    if (!cleaned) return;

    const validation = validateParticipantName(cleaned);
    if (!validation.ok) {
      rejected.push({ raw: raw.trim(), reason: validation.reason });
      return;
    }

    const key = cleaned.toLocaleLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      names.push(cleaned);
    }
  });

  return { names, rejected };
}

function seededRandom(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
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
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  const teams: PreviewTeam[] = [];
  for (let index = 0; index < shuffled.length; index += teamSize) {
    const chunk = shuffled.slice(index, index + teamSize);
    if (chunk.length < teamSize) {
      return { teams, bench: chunk };
    }
    teams.push({ name: `Team ${teams.length + 1}`, players: chunk });
  }
  return { teams, bench: [] as Player[] };
}

function buildBracketPairs<T extends { name: string }>(teams: T[]) {
  const pairs: Array<[T, T | null]> = [];
  for (let index = 0; index < teams.length; index += 2) {
    pairs.push([teams[index], teams[index + 1] ?? null]);
  }
  return pairs;
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
  canRegenerate = true,
}: RouletteArenaProps) {
  const [bulkValue, setBulkValue] = useState("");
  const [seed, setSeed] = useState(() => `${Date.now()}`);
  const [preview, setPreview] = useState<{ teams: PreviewTeam[]; bench: Player[] } | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [fileMessage, setFileMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const teamSize = engine.teamSize;
  const minimumPlayers = teamSize * 2;
  const missingPlayers = Math.max(minimumPlayers - players.length, 0);
  const hasConfirmedTeams = teams.length > 0;
  const isKillRace = engine.engineKey === "kill_race_bracket";
  const modeBadge =
    engine.engineKey === "roulette_ws"
      ? engine.gameMode === "br"
        ? "BR 4v4"
        : "Rebirth 3v3"
      : `${teamSize}v${teamSize}`;
  const confirmedBench = engine.config.rouletteBench ?? [];
  const visiblePreviewTeams = preview?.teams ?? [];
  const visiblePreviewBench = preview?.bench ?? [];
  const bracketTeams: Array<Team | PreviewTeam> = preview ? visiblePreviewTeams : teams;
  const resultTeams = preview ? visiblePreviewTeams : teams;
  const resultBench = preview
    ? visiblePreviewBench.map((player) => player.nickname)
    : confirmedBench;
  const estimatedTeams = Math.floor(players.length / teamSize);
  const estimatedBench = players.length >= teamSize ? players.length % teamSize : players.length;
  const arenaStatus = hasConfirmedTeams
    ? `${teams.length} equipos confirmados`
    : preview
      ? `${visiblePreviewTeams.length} equipos en preview`
      : players.length > 0
        ? `${players.length} cargados · ${estimatedTeams} equipos${estimatedBench > 0 ? ` · ${estimatedBench} banca` : ""}`
        : "Pendiente";
  const stateCopy = hasConfirmedTeams
    ? {
        eyebrow: "Equipos confirmados",
        title: "Equipos confirmados",
        body: `${teams.length} equipos de ${teamSize} jugadores. ${isKillRace ? "Prepara el bracket para operar." : "Ya puedes ir a Operator."}`,
      }
    : preview
      ? {
          eyebrow: "Equipos generados",
          title: "Equipos generados",
          body: `Revisa los equipos antes de confirmar. ${visiblePreviewBench.length > 0 ? `${visiblePreviewBench.length} en banca.` : ""}`,
        }
      : players.length >= minimumPlayers
        ? {
            eyebrow: "Pool listo",
            title: "Pool listo",
            body: `${players.length} participantes cargados. Equipos estimados: ${estimatedTeams}${estimatedBench > 0 ? ` · Banca: ${estimatedBench}` : ""}.`,
          }
        : {
            eyebrow: "Carga participantes",
            title: "Carga participantes",
            body: "Pega una lista o importa un archivo .txt/.csv. También puedes copiar y pegar desde Word, Excel, Discord o Google Sheets.",
          };
  const wheelLabels = useMemo(() => {
    const maxLabels = 15;
    const names = players.slice(0, maxLabels).map((player) => player.nickname);
    if (players.length > maxLabels) {
      names.push(`+${players.length - maxLabels}`);
    }
    return names;
  }, [players]);

  async function handleBulkImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { names: nicknames, rejected } = parseParticipants(bulkValue);
    if (nicknames.length === 0) {
      if (rejected.length > 0) {
        setFileMessage(`Ningún nombre válido. Revisa: ${rejected.slice(0, 3).map((r) => `"${r.raw}" (${r.reason})`).join(", ")}${rejected.length > 3 ? ` y ${rejected.length - 3} más.` : ""}`);
      } else {
        setFileMessage("Pega una lista de participantes antes de cargar.");
      }
      return;
    }
    await onImportParticipants(nicknames);
    setBulkValue("");
    setPreview(null);
    const rejectionMsg = rejected.length > 0
      ? ` · ${rejected.length} rechazado(s): ${rejected.slice(0, 2).map((r) => `"${r.raw}"`).join(", ")}${rejected.length > 2 ? "..." : ""}`
      : "";
    setFileMessage(`${nicknames.length} participantes cargados.${rejectionMsg}`);
  }

  async function importNicknames(nicknames: string[], rejected: Array<{ raw: string; reason: string }>, message: string) {
    if (nicknames.length === 0) {
      if (rejected.length > 0) {
        setFileMessage(`No se detectaron participantes válidos. Revisa: ${rejected.slice(0, 3).map((r) => `"${r.raw}" (${r.reason})`).join(", ")}`);
      } else {
        setFileMessage("No se detectaron participantes. Pega la lista manualmente.");
      }
      return;
    }
    await onImportParticipants(nicknames);
    setBulkValue("");
    setPreview(null);
    setFileMessage(message);
  }

  function handleFileImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    const lowerName = file.name.toLocaleLowerCase();
    if (lowerName.endsWith(".docx")) {
      setFileMessage("DOCX queda para roadmap. Exporta como .txt o .csv.");
      return;
    }
    if (!lowerName.endsWith(".txt") && !lowerName.endsWith(".csv")) {
      setFileMessage("Usa .txt o .csv por ahora.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === "string" ? reader.result : "";
      const { names: nicknames, rejected } = parseParticipants(content);
      const rejectionMsg = rejected.length > 0
        ? ` · ${rejected.length} línea(s) rechazada(s).`
        : "";
      void importNicknames(
        nicknames,
        rejected,
        `Archivo importado: ${nicknames.length} participantes detectados.${rejectionMsg}`
      );
    };
    reader.onerror = () => {
      setFileMessage("No se pudo leer el archivo. Pega la lista manualmente.");
    };
    reader.readAsText(file);
  }

  function spinRoulette() {
    if (players.length < minimumPlayers) {
      return;
    }
    const nextSeed = `${Date.now()}-${players.length}-${teamSize}`;
    setSeed(nextSeed);
    setSpinning(true);
    window.setTimeout(() => {
      setPreview(buildPreview(players, teamSize, nextSeed));
      setSpinning(false);
    }, 1300);
  }

  async function confirmRoulette() {
    if (!preview) {
      return;
    }
    await onConfirmRoulette(seed);
    setPreview(null);
  }

  return (
    <section className="bf-roulette-arena">
      <div className="bf-roulette-head">
        <div>
          <span className="opr-eyebrow">{stateCopy.eyebrow}</span>
          <h2>{stateCopy.title}</h2>
          <p>{stateCopy.body}</p>
        </div>
        <div className="bf-roulette-head-side">
          <span className="bf-roulette-badge">{modeBadge}</span>
          <strong>{arenaStatus}</strong>
        </div>
      </div>

      <div className="bf-roulette-grid">
        <aside className="bf-roulette-panel bf-roulette-pool">
          <div className="bf-roulette-panel-head">
            <div>
              <span>Participantes</span>
              <strong>{players.length} cargados · mínimo {minimumPlayers}</strong>
            </div>
            <em>{modeBadge}</em>
          </div>

          <form className="bf-roulette-import" onSubmit={handleBulkImport}>
            <input
              ref={fileInputRef}
              className="bf-roulette-file-input"
              type="file"
              accept=".txt,.csv,text/plain,text/csv"
              onChange={handleFileImport}
              disabled={hasConfirmedTeams || submitting}
            />
            <button
              type="button"
              className="bf-roulette-file"
              onClick={() => fileInputRef.current?.click()}
              disabled={hasConfirmedTeams || submitting}
            >
              Importar .txt/.csv
            </button>
            {fileMessage ? <p className="bf-roulette-file-message">{fileMessage}</p> : null}
            <textarea
              value={bulkValue}
              onChange={(event) => setBulkValue(event.target.value)}
              placeholder={"player1\nplayer2\nplayer3\n…También puedes copiar y pegar desde Word, Excel, Discord o Google Sheets."}
              rows={7}
              disabled={hasConfirmedTeams || submitting}
            />
            <div className="bf-hub-form-actions">
              <button
                type="submit"
                className="bf-button bf-button-primary"
                disabled={submitting || hasConfirmedTeams || bulkValue.trim().length === 0}
              >
                Cargar participantes
              </button>
              <button
                type="button"
                className="bf-button bf-button-ghost"
                onClick={() => void onClearParticipants()}
                disabled={submitting || hasConfirmedTeams || players.length === 0}
              >
                Limpiar
              </button>
            </div>
          </form>

          <div className="bf-roulette-counts">
            {missingPlayers > 0 ? (
              <span>Faltan {missingPlayers} participantes para armar {estimatedTeams + 1} equipos de {teamSize}.</span>
            ) : estimatedBench > 0 ? (
              <span>Pool listo: {estimatedTeams} equipos de {teamSize} · {estimatedBench} en banca.</span>
            ) : (
              <span>Pool listo: {estimatedTeams} equipos de {teamSize} · sin banca.</span>
            )}
          </div>

          <div className="bf-roulette-panel-scroll bf-roulette-player-list">
            {players.length === 0 ? (
              <p className="bf-empty">Todavía no hay participantes.</p>
            ) : (
              players.map((player) => (
                <span key={player.id} className="bf-roulette-player">
                  {player.nickname}
                  {!hasConfirmedTeams ? (
                    <button
                      type="button"
                      onClick={() => void onRemoveParticipant(player.id)}
                      disabled={submitting}
                      aria-label={`Eliminar ${player.nickname}`}
                    >
                      x
                    </button>
                  ) : null}
                </span>
              ))
            )}
          </div>
        </aside>

        <div className="bf-roulette-core bf-roulette-hero">
          <div className="bf-roulette-outcome">
            <span>{stateCopy.title}</span>
            <strong>{arenaStatus}</strong>
          </div>
          <div className="bf-roulette-pointer" aria-hidden="true" />
          <div className={`bf-roulette-wheel${spinning ? " is-spinning" : ""}`}>
            <div className="bf-roulette-ring" />
            <div className="bf-roulette-segments" aria-hidden="true" />
            <div className="bf-roulette-center">
              <strong>{spinning ? "Girando..." : hasConfirmedTeams || preview ? "Seed listo" : "Ruleta"}</strong>
              <span>{modeBadge}</span>
            </div>
            {wheelLabels.map((name, index) => (
              <span
                key={`${name}-${index}`}
                className="bf-roulette-tick"
                style={{ transform: `rotate(${index * (360 / Math.max(wheelLabels.length, 1))}deg)` }}
              >
                <i>{name.slice(0, 10)}</i>
              </span>
            ))}
          </div>

          <div className="bf-roulette-actions">
            {hasConfirmedTeams && !preview ? (
              <>
                <Link
                  href={
                    isKillRace
                      ? `/operator?tournamentId=${tournament.id}&tab=bracket`
                      : `/operator?tournamentId=${tournament.id}`
                  }
                  className="bf-button bf-button-primary bf-button-hero"
                >
                  {isKillRace ? "Preparar bracket" : "Ir a Operator"}
                </Link>
                {canRegenerate ? (
                  <button
                    type="button"
                    className="bf-button bf-button-ghost"
                    onClick={spinRoulette}
                    disabled={submitting || spinning || players.length < minimumPlayers}
                  >
                    Regenerar
                  </button>
                ) : null}
              </>
            ) : !preview ? (
              <button
                type="button"
                className="bf-button bf-button-primary bf-button-hero"
                onClick={spinRoulette}
                disabled={submitting || spinning || players.length < minimumPlayers}
              >
                {hasConfirmedTeams ? "Regenerar" : "Girar ruleta"}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="bf-button bf-button-ghost"
                  onClick={spinRoulette}
                  disabled={submitting || spinning}
                >
                  Regenerar
                </button>
                <button
                  type="button"
                  className="bf-button bf-button-primary"
                  onClick={() => void confirmRoulette()}
                  disabled={submitting}
                >
                  Confirmar equipos
                </button>
              </>
            )}
          </div>
          <p className="bf-roulette-note">
            {preview
              ? "Revisa los equipos y confirma para persistirlos."
              : hasConfirmedTeams
                ? `Equipos confirmados: ${teams.length} de ${teamSize} jugadores.`
                : players.length >= minimumPlayers
                  ? "Haz click en Girar ruleta para generar equipos."
                  : "Carga participantes primero."}
          </p>
        </div>

        <aside className="bf-roulette-panel bf-roulette-results">
          <div className="bf-roulette-panel-head">
            <div>
              <span>{isKillRace ? "Seed de bracket" : "Equipos generados"}</span>
              <strong>
                {hasConfirmedTeams
                  ? `${teams.length} equipos confirmados`
                  : preview
                    ? `${visiblePreviewTeams.length} equipos en preview`
                    : players.length > 0
                      ? `${players.length} participantes cargados`
                      : "Pendiente"}
              </strong>
            </div>
            <em>{modeBadge}</em>
          </div>

          {isKillRace ? (
            <div className="bf-roulette-panel-scroll bf-roulette-seed">
              {buildBracketPairs(bracketTeams).length === 0 ? (
                <p className="bf-empty">Falta generar bracket</p>
              ) : (
                buildBracketPairs(bracketTeams).map(([left, right], index) => (
                  <article key={index} className="bf-roulette-match">
                    <span>Match {index + 1}</span>
                    <strong>{getTeamShortDisplayName(left, teamSize <= 2 ? 2 : 3)}</strong>
                    <small>{getTeamSeedLabel(left, index * 2 + 1)}</small>
                    <em>vs</em>
                    <strong>{right ? getTeamShortDisplayName(right, teamSize <= 2 ? 2 : 3) : "BYE"}</strong>
                    {right ? <small>{getTeamSeedLabel(right, index * 2 + 2)}</small> : null}
                  </article>
                ))
              )}
            </div>
          ) : (
            <div className="bf-roulette-panel-scroll bf-roulette-teams-list">
              {resultTeams.length === 0 ? (
                <p className="bf-empty">Gira la ruleta para ver equipos.</p>
              ) : (
                resultTeams.map((team) => (
                  <article key={team.name} className="bf-roulette-team-card">
                    <div>
                      <strong>{getTeamDisplayName(team)}</strong>
                      <span>{modeBadge}</span>
                    </div>
                    <p>{getTeamSeedLabel(team)}</p>
                  </article>
                ))
              )}
            </div>
          )}

          {resultBench.length > 0 ? (
            <div className="bf-roulette-bench">
              <strong>Banca</strong>
              <p>{resultBench.join(" / ")}</p>
            </div>
          ) : null}

          <div className="bf-hub-form-actions">
            {isKillRace ? (
              <Link href={`/operator?tournamentId=${tournament.id}&tab=bracket`} className="bf-button bf-button-primary">
                Preparar bracket
              </Link>
            ) : null}
            {isKillRace ? (
              <Link href={`/standings?tournamentId=${tournament.id}`} className="bf-button bf-button-ghost">
                Ver bracket
              </Link>
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
            {hasConfirmedTeams && canRegenerate ? (
              <button
                type="button"
                className="bf-button bf-button-ghost"
                onClick={spinRoulette}
                disabled={submitting || spinning || players.length < minimumPlayers}
              >
                Regenerar
              </button>
            ) : null}
          </div>
        </aside>
      </div>
    </section>
  );
}
