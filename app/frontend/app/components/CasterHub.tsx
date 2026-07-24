"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { resolveTournamentEngine } from "../../lib/tournamentModel";
import { getMvpState } from "../../lib/mvp";
import {
  findChampion,
  getMatchPointStatus,
  getMatchPointStatusMessage,
  getTeamDisplayName,
  getTournamentStatusLabel,
  isTournamentCompleted,
} from "../../lib/tournamentStatus";
import { useWorldSeriesPractice } from "../lib/useWorldSeriesPractice";
import { layoutLabel, useBroadcastSetup } from "../lib/broadcastSetup";
import { useIdentityMetadata } from "../lib/useIdentityMetadata";
import {
  getPlayerIdentityContext,
  getTeamIdentityContext,
  resolveTournamentResults,
  resolveTournamentTeams,
} from "../../lib/identityResolver";
import BroadcastSetup from "./BroadcastSetup";

const STREAM_ORIGIN = "http://localhost:3000";

type OverlayDefinition = {
  layout: "sidebar" | "lower-third" | "matchpoint" | "mvp" | "leaderboard";
  title: string;
  description: string;
  note?: string;
  transparent: boolean;
};

const OVERLAYS: OverlayDefinition[] = [
  {
    layout: "sidebar",
    title: "Sidebar",
    description: "Tabla compacta anclada al lateral para la señal en vivo.",
    transparent: true,
  },
  {
    layout: "lower-third",
    title: "Lower third",
    description: "Top 3 fijo para entradas, pausas y cambio de partida.",
    transparent: true,
  },
  {
    layout: "matchpoint",
    title: "Match point",
    description: "Estado de umbral y campeón confirmado en la transmisión.",
    note: "Visible solo con Match Point o Campeón.",
    transparent: true,
  },
  {
    layout: "mvp",
    title: "MVP",
    description: "Jugador destacado desde los stats reportados de la partida.",
    note: "Usa player stats si existen; si no, Team MVP.",
    transparent: true,
  },
  {
    layout: "leaderboard",
    title: "Leaderboard",
    description: "Tabla completa para escenas de análisis y cierre de ronda.",
    transparent: true,
  },
];

function parseTournamentId(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatPoints(points: number) {
  return Number.isInteger(points) ? String(points) : points.toFixed(1);
}

function getOverlayUrl(tournamentId: number, overlay: OverlayDefinition) {
  const query = new URLSearchParams({
    tournamentId: String(tournamentId),
    obs: "1",
  });

  if (overlay.transparent) {
    query.set("bg", "transparent");
  }
  query.set("layout", overlay.layout);

  return `${STREAM_ORIGIN}/stream?${query.toString()}`;
}

function getDarkLeaderboardUrl(tournamentId: number) {
  return `${STREAM_ORIGIN}/stream?tournamentId=${tournamentId}&obs=1&layout=leaderboard`;
}

export default function CasterHub() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preferredTournamentId = parseTournamentId(searchParams.get("tournamentId"));
  const [copyState, setCopyState] = useState<{ key: string; status: "copied" | "error" } | null>(null);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const copyTimeoutRef = useRef<number | null>(null);

  const {
    backendOnline,
    loading,
    tournaments,
    teams: rawTeams,
    matches,
    selectedTournament,
    selectedTournamentId,
    activeMatch,
    sortedStandings,
    latestReportedRound,
    totalTeams,
    tournamentResults: rawTournamentResults,
    selectedEngine,
    selectTournament,
  } = useWorldSeriesPractice(preferredTournamentId);
  const identityCatalog = useIdentityMetadata();
  const teams = useMemo(
    () => resolveTournamentTeams(rawTeams, identityCatalog),
    [rawTeams, identityCatalog]
  );
  const tournamentResults = useMemo(
    () => resolveTournamentResults(rawTournamentResults, rawTeams, identityCatalog),
    [rawTournamentResults, rawTeams, identityCatalog]
  );

  // El perfil se persiste con el mismo store local y se edita desde Caster Hub.
  const { setup: broadcastSetup } = useBroadcastSetup();

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const engine = selectedTournament ? selectedEngine ?? resolveTournamentEngine(selectedTournament) : null;
  const isBracket = engine?.primaryView === "bracket";
  const standings = sortedStandings.map((entry) => ({
    ...entry,
    team_name: teams.find((team) => team.id === entry.team_id)?.name ?? entry.team_name,
  })).sort((left, right) => {
    if (right.total_points !== left.total_points) {
      return right.total_points - left.total_points;
    }
    if (right.kills !== left.kills) {
      return right.kills - left.kills;
    }
    if (left.best_placement !== right.best_placement) {
      return (
        (left.best_placement ?? Number.MAX_SAFE_INTEGER) -
        (right.best_placement ?? Number.MAX_SAFE_INTEGER)
      );
    }
    return left.team_name.localeCompare(right.team_name);
  });
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const rawTeamById = new Map(rawTeams.map((team) => [team.id, team]));
  const getIdentityTeamContext = (teamId: number) => {
    const team = rawTeamById.get(teamId) ?? teamById.get(teamId);
    return team ? getTeamIdentityContext(team, identityCatalog) : null;
  };
  const leader = standings[0] ?? null;
  const highestKills = [...standings].sort((left, right) => right.kills - left.kills)[0] ?? null;
  const completedMatches = matches.filter(
    (match) => match.status === "completed" && (match.winner_id !== null || match.maps.length > 0)
  );
  const reportedMatches = matches.filter(
    (match) => match.team_a_id === null && match.team_b_id === null && match.status === "completed"
  );
  const bracketChampion = isBracket ? findChampion(matches, teams) : null;
  const bracketCompleted = isBracket ? isTournamentCompleted(matches) : false;
  const matchPointStatus =
    selectedTournament && engine && !isBracket
      ? getMatchPointStatus({
          tournament: selectedTournament,
          threshold: engine.matchPointThreshold,
          standings,
          teams,
          matches,
        })
      : { state: "idle" as const };
  const matchPointMessage = getMatchPointStatusMessage(matchPointStatus);

  const mvp = getMvpState(tournamentResults, standings);
  const playerMvpIdentity =
    mvp.kind === "player"
      ? getPlayerIdentityContext(mvp.playerName, identityCatalog)
      : null;

  const leaderLabel = leader ? teamById.get(leader.team_id) : null;
  const resolvedLeaderLabel = leaderLabel
    ? getTeamDisplayName(leaderLabel)
    : leader?.team_name ?? "Sin líder";
  const highestKillsContext = highestKills
    ? getIdentityTeamContext(highestKills.team_id)
    : null;
  const topKillsLabel = highestKills
    ? `${highestKills.team_name}${highestKillsContext?.shortName ? ` (${highestKillsContext.shortName})` : ""} · ${highestKills.kills} K`
    : "Datos pendientes";
  const championLabel =
    matchPointStatus.state === "champion"
      ? matchPointStatus.championLabel
      : bracketChampion?.displayName ?? null;
  const matchPointLabel = championLabel
    ? `Campeón: ${championLabel}`
    : matchPointStatus.state === "threshold_reached"
      ? "Match Point activo"
      : "Sin Match Point";
  const reportedLabel = isBracket
    ? `${completedMatches.length}/${matches.length || 0}`
    : String(reportedMatches.length);
  const reportedDescription = isBracket
    ? "Series reportadas"
    : latestReportedRound > 0
      ? `Hasta Partida ${latestReportedRound}`
      : "Sin partidas reportadas";
  const getMatchTeamLabel = (teamId: number) => {
    const team = teamById.get(teamId);
    return team ? getTeamDisplayName(team) : "Equipo pendiente";
  };
  const activeMatchLabel = activeMatch
    ? activeMatch.team_a_id !== null && activeMatch.team_b_id !== null
      ? `${getMatchTeamLabel(activeMatch.team_a_id)} vs ${getMatchTeamLabel(activeMatch.team_b_id)}`
      : `Partida ${activeMatch.round}`
    : null;
  const topThree = standings.slice(0, 3);
  const pointsGap = leader && standings[1] ? leader.total_points - standings[1].total_points : null;
  const teamToWatch = highestKills
    ? highestKills.team_name
    : leader
      ? resolvedLeaderLabel
      : "Sin datos suficientes";
  const teamToWatchContext = highestKillsContext;

  const nowNarration = (() => {
    if (!selectedTournament) {
      return "Selecciona un torneo para preparar la señal y la narrativa.";
    }
    if (championLabel) {
      return `Cierra con ${championLabel}: el campeonato ya está decidido.`;
    }
    if (matchPointStatus.state === "threshold_reached") {
      return `Sigue a ${matchPointStatus.leaderName}: Match Point activo y la definición sigue abierta.`;
    }
    if (leader && pointsGap !== null && pointsGap <= 5) {
      return `La punta está cerrada: ${resolvedLeaderLabel} tiene ${formatPoints(pointsGap)} pts de ventaja.`;
    }
    if (activeMatchLabel) {
      return `${activeMatchLabel} es la referencia operativa de este momento.`;
    }
    if (leader) {
      return `Presenta a ${resolvedLeaderLabel}, líder con ${formatPoints(leader.total_points)} pts.`;
    }
    return "El torneo está en preparación; presenta el formato y los equipos confirmados.";
  })();

  function handleSelectTournament(tournamentId: number) {
    selectTournament(tournamentId);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("tournamentId", String(tournamentId));
    router.replace(`/caster?${nextParams.toString()}`);
  }

  async function handleCopy(key: string, url: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = url;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }
      setCopyState({ key, status: "copied" });
    } catch {
      setCopyState({ key, status: "error" });
    }

    if (copyTimeoutRef.current !== null) {
      window.clearTimeout(copyTimeoutRef.current);
    }
    copyTimeoutRef.current = window.setTimeout(() => setCopyState(null), 1800);
  }

  function openOverlay(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <main className="bf-caster">
      <header className="bf-caster-head">
        <div>
          <span className="bf-caster-eyebrow">Broadcast control room</span>
          <h1>Caster Hub</h1>
          <p>Cabina de transmisión / overlays OBS</p>
        </div>
        <div className="bf-caster-head-status">
          <span className={`bf-caster-status${backendOnline ? " is-online" : " is-offline"}`}>
            <i />
            {backendOnline ? "Backend online" : "Backend offline"}
          </span>
          {selectedTournament && (
            <span className="bf-caster-status is-tournament">
              {getTournamentStatusLabel(selectedTournament.status)}
            </span>
          )}
        </div>
      </header>

      <section className="bf-caster-profile" aria-label="Perfil de transmisión">
        <span className="bf-caster-profile-mark">{broadcastSetup.brandMark || "BF"}</span>
        <div className="bf-caster-profile-copy">
          <span className="bf-caster-profile-label">Perfil broadcast activo</span>
          <strong>{broadcastSetup.eventName || "Evento sin configurar"}</strong>
          <span>
            {broadcastSetup.organizer || "Sin organizador"}
            {broadcastSetup.casterName ? ` · Caster: ${broadcastSetup.casterName}` : ""}
          </span>
          <small>
            Guardado en este navegador. Caster Hub usa este perfil para recomendar y abrir URLs;
            /stream renderiza el overlay real para OBS.
          </small>
        </div>
        <div className="bf-caster-profile-meta">
          <span className="bf-caster-profile-chip">
            Overlay: {layoutLabel(broadcastSetup.defaultLayout)}
          </span>
          <span className="bf-caster-profile-chip">{broadcastSetup.obsTarget}</span>
          <button
            type="button"
            className="bf-caster-profile-edit"
            aria-expanded={profileEditorOpen}
            aria-controls="caster-broadcast-profile-editor"
            onClick={() => setProfileEditorOpen((open) => !open)}
          >
            {profileEditorOpen ? "Cerrar editor" : "Editar perfil"}
          </button>
        </div>
      </section>

      <div
        id="caster-broadcast-profile-editor"
        className="bf-caster-profile-editor"
        hidden={!profileEditorOpen}
      >
        <BroadcastSetup />
      </div>

      <section className="bf-caster-context" aria-label="Torneo de transmisión">
        <label className="bf-caster-select-label" htmlFor="caster-tournament">
          Torneo de transmisión
        </label>
        <select
          id="caster-tournament"
          className="bf-caster-select"
          value={selectedTournamentId ?? ""}
          disabled={loading || tournaments.length === 0}
          onChange={(event) => handleSelectTournament(Number(event.target.value))}
        >
          <option value="">{loading ? "Cargando torneos..." : "Selecciona un torneo"}</option>
          {tournaments.map((tournament) => (
            <option key={tournament.id} value={tournament.id}>
              #{tournament.id} · {tournament.name}
            </option>
          ))}
        </select>
        <div className="bf-caster-tournament-copy">
          <strong>{selectedTournament?.name ?? "Sin torneo seleccionado"}</strong>
          <span>
            {selectedTournament
              ? `${selectedTournament.game} · ${engine?.label ?? "Formato sin resolver"}`
              : "Los controles OBS aparecerán al seleccionar o crear un torneo."}
          </span>
        </div>
      </section>

      {!selectedTournament ? (
        <section className="bf-caster-empty">
          <span className="bf-caster-empty-mark">BF</span>
          <div>
            <h2>La cabina espera un torneo</h2>
            <p>Selecciona un torneo existente o crea uno para generar sus URLs de OBS.</p>
          </div>
          <Link href="/torneos" className="bf-caster-link">
            Ir a torneos
          </Link>
        </section>
      ) : (
        <>
          <section className="bf-caster-snapshot" aria-label="Snapshot del torneo">
            <article className="bf-caster-stat is-leader">
              <span>Líder actual</span>
              <strong>{championLabel ?? resolvedLeaderLabel}</strong>
              <small>
                {championLabel
                  ? "Campeonato confirmado"
                  : leader
                    ? `${formatPoints(leader.total_points)} pts · ${leader.kills} K`
                    : "Leaderboard pendiente"}
              </small>
            </article>
            <article className="bf-caster-stat">
              <span>Top kills / equipo</span>
              <strong>{topKillsLabel}</strong>
              <small>
                {mvp.kind === "player"
                  ? `MVP actual: ${mvp.playerName} · ${mvp.kills} K`
                  : mvp.kind === "team"
                    ? `Team MVP: ${mvp.teamName} · ${mvp.kills} K`
                    : "MVP pendiente: faltan player stats"}
              </small>
            </article>
            <article className="bf-caster-stat is-gold">
              <span>Definición</span>
              <strong>{matchPointLabel}</strong>
              <small>{matchPointMessage ?? (bracketCompleted ? "Bracket finalizado" : "Estado competitivo abierto")}</small>
            </article>
            <article className="bf-caster-stat">
              <span>Partidas / serie</span>
              <strong>{reportedLabel}</strong>
              <small>{activeMatchLabel ? `${reportedDescription} · ${activeMatchLabel}` : reportedDescription}</small>
            </article>
            <article className="bf-caster-stat">
              <span>Equipos</span>
              <strong>{totalTeams}</strong>
              <small>{totalTeams > 0 ? "Equipos cargados en torneo" : "Setup de equipos pendiente"}</small>
            </article>
          </section>

          <div className="bf-caster-grid">
            <section className="bf-caster-panel bf-caster-overlays">
              <div className="bf-caster-panel-head">
                <div>
                  <span className="bf-caster-eyebrow">OBS sources</span>
                  <h2>Overlay launcher</h2>
                </div>
                <span className="bf-caster-panel-meta">Localhost 3000</span>
              </div>

              <div className="bf-caster-overlay-list">
                {OVERLAYS.map((overlay) => {
                  const url = getOverlayUrl(selectedTournament.id, overlay);
                  const status = copyState?.key === overlay.layout ? copyState.status : null;
                  const isRecommended = overlay.layout === broadcastSetup.defaultLayout;
                  return (
                    <article
                      className={`bf-caster-overlay${isRecommended ? " is-recommended" : ""}`}
                      key={overlay.layout}
                    >
                      <div className="bf-caster-overlay-copy">
                        <h3>
                          {overlay.title}
                          {isRecommended && (
                            <span className="bf-caster-overlay-badge">Recomendado por tu perfil</span>
                          )}
                        </h3>
                        <p>{overlay.description}</p>
                        {overlay.note && <small className="bf-caster-overlay-note">{overlay.note}</small>}
                        <code>{url}</code>
                      </div>
                      <div className="bf-caster-overlay-actions">
                        <button type="button" onClick={() => void handleCopy(overlay.layout, url)}>
                          {status === "copied" ? "Copiada" : status === "error" ? "Reintentar" : "Copy URL"}
                        </button>
                        <button type="button" className="is-open" onClick={() => openOverlay(url)}>
                          Open overlay
                        </button>
                      </div>
                    </article>
                  );
                })}
                <article className="bf-caster-overlay bf-caster-overlay-dark">
                  <div className="bf-caster-overlay-copy">
                    <h3>Leaderboard dark</h3>
                    <p>Escena de leaderboard a pantalla completa con fondo oscuro.</p>
                    <code>{getDarkLeaderboardUrl(selectedTournament.id)}</code>
                  </div>
                  <div className="bf-caster-overlay-actions">
                    <button
                      type="button"
                      onClick={() => void handleCopy("leaderboard-dark", getDarkLeaderboardUrl(selectedTournament.id))}
                    >
                      {copyState?.key === "leaderboard-dark" && copyState.status === "copied"
                        ? "Copiada"
                        : copyState?.key === "leaderboard-dark" && copyState.status === "error"
                          ? "Reintentar"
                          : "Copy URL"}
                    </button>
                    <button
                      type="button"
                      className="is-open"
                      onClick={() => openOverlay(getDarkLeaderboardUrl(selectedTournament.id))}
                    >
                      Open overlay
                    </button>
                  </div>
                </article>
              </div>
            </section>

            <aside className="bf-caster-panel bf-caster-notes" aria-label="Notas de narración">
              <div className="bf-caster-panel-head">
                <div>
                  <span className="bf-caster-eyebrow">Read only</span>
                  <h2>Notas de narración</h2>
                </div>
              </div>

              <div className="bf-caster-note-block">
                <span>Top 3 equipos</span>
                {topThree.length > 0 ? (
                  <ol>
                    {topThree.map((entry, index) => (
                      <li key={entry.team_id}>
                        <b>{index + 1}</b>
                        <strong>{entry.team_name}</strong>
                        <small>{formatPoints(entry.total_points)} pts · {entry.kills} K</small>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p>Leaderboard pendiente de la primera partida reportada.</p>
                )}
              </div>

              <div className="bf-caster-note-block">
                <span>Equipo a seguir</span>
                <p>
                  <strong>{teamToWatch}</strong>
                  {highestKills ? ` lidera en kills con ${highestKills.kills}.` : " no tiene estadísticas todavía."}
                  {teamToWatchContext?.notes ? ` Nota Identity: ${teamToWatchContext.notes}` : ""}
                </p>
              </div>

              <div className="bf-caster-note-block">
                <span>{mvp.kind === "player" ? "MVP actual" : "MVP pendiente"}</span>
                <p>
                  {mvp.kind === "player" ? (
                    <>MVP actual: <strong>{mvp.playerName}</strong> suma {mvp.kills} kills.{playerMvpIdentity?.notes ? ` Nota Identity: ${playerMvpIdentity.notes}` : ""}</>
                  ) : (
                    "MVP pendiente: faltan player stats reportadas."
                  )}
                </p>
              </div>

              <div className="bf-caster-note-block">
                <span>Match Point / campeón</span>
                <p>{matchPointMessage ?? (bracketChampion ? `Campeón de bracket: ${bracketChampion.displayName}.` : "Sin definición activa confirmada.")}</p>
              </div>

              <div className="bf-caster-now">
                <span>Qué narrar ahora</span>
                <p>{nowNarration}</p>
              </div>
            </aside>
          </div>
        </>
      )}
    </main>
  );
}
