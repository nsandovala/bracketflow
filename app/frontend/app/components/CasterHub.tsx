"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { resolveTournamentEngine } from "../../lib/tournamentModel";
import { getMvpState } from "../../lib/mvp";
import {
  findChampion,
  getMatchPointStatusFromPolicy,
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
import CasterContextInspector from "./CasterContextInspector";
import { getCompatibleOverlayLayouts } from "../../lib/streamRouting.mjs";
import { buildKillRaceCasterState } from "../../lib/killRaceCasterState.mjs";
import {
  buildKillRaceChampionOverlay,
  buildKillRaceMvpOverlay,
} from "../../lib/killRaceAwards.mjs";
import {
  getFollowOperatorOverlayUrl,
  getTournamentOverlayUrl,
} from "../../lib/broadcastChannel.mjs";

const STREAM_ORIGIN = "http://localhost:3000";

type OverlayDefinition = {
  layout: "sidebar" | "lower-third" | "matchpoint" | "mvp" | "leaderboard" | "scorebug" | "intermission" | "bracket" | "champion";
  title: string;
  description: string;
  note?: string;
  transparent: boolean;
  transparentOption?: boolean;
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

const KILL_RACE_OVERLAYS: OverlayDefinition[] = [
  {
    layout: "scorebug",
    title: "Kill Race Scorebug",
    description: "Marcador compacto de serie y kills individuales para gameplay.",
    transparent: true,
  },
  {
    layout: "intermission",
    title: "Intermission",
    description: "Escena de pausa con enfrentamiento, último mapa y jugador destacado.",
    note: "ESCENA ENTRE PARTIDAS",
    transparent: false,
    transparentOption: true,
  },
  {
    layout: "bracket",
    title: "Bracket",
    description: "Llave completa read-only para una escena independiente de OBS.",
    transparent: true,
  },
  {
    layout: "mvp",
    title: "MVP / Jugador destacado",
    description: "Jugador destacado confirmado del mapa, serie o torneo.",
    transparent: true,
  },
  {
    layout: "champion",
    title: "Champion",
    description: "Escena de coronación basada exclusivamente en la final confirmada.",
    transparent: false,
    transparentOption: true,
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

function getOverlayUrl(tournamentId: number, overlay: OverlayDefinition, matchId?: number) {
  const query = new URLSearchParams({
    tournamentId: String(tournamentId),
    obs: "1",
  });

  if (overlay.transparent) {
    query.set("bg", "transparent");
  }
  query.set("layout", overlay.layout);
  if (matchId !== undefined) query.set("matchId", String(matchId));

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
    matchCompletionPolicy,
    selectedTournamentId,
    activeMatch,
    sortedStandings,
    tournamentResults: rawTournamentResults,
    selectedEngine,
    broadcastChannel,
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
  const isKillRace = engine?.scoringProfile === "kill_race";
  const compatibleLayouts = getCompatibleOverlayLayouts({
    isKillRace,
    supportsMatchPoint: Boolean(engine?.supportsMatchPoint),
  });
  const compatibleOverlays = (isKillRace ? KILL_RACE_OVERLAYS : OVERLAYS).filter((overlay) =>
    compatibleLayouts.includes(overlay.layout)
  );
  const broadcastMatchId =
    broadcastChannel?.activeTournamentId === selectedTournament?.id
      ? broadcastChannel?.broadcastMatchId ?? null
      : null;
  const onAirTournament = tournaments.find(
    (candidate) => candidate.id === broadcastChannel?.activeTournamentId
  ) ?? null;
  const killRaceState = useMemo(
    () =>
      isKillRace
        ? buildKillRaceCasterState({
            matches,
            teams,
            broadcastMatchId,
          })
        : null,
    [broadcastMatchId, isKillRace, matches, teams]
  );
  const killRaceMvpAward = useMemo(
    () =>
      isKillRace
        ? buildKillRaceMvpOverlay({
            tournament: selectedTournament,
            teams,
            matches,
          })
        : null,
    [isKillRace, matches, selectedTournament, teams]
  );
  const killRaceChampionAward = useMemo(
    () =>
      isKillRace
        ? buildKillRaceChampionOverlay({
            tournament: selectedTournament,
            teams,
            matches,
          })
        : null,
    [isKillRace, matches, selectedTournament, teams]
  );
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
  const bracketChampion = isBracket ? findChampion(matches, teams) : null;
  const bracketCompleted = isBracket ? isTournamentCompleted(matches) : false;
  const matchPointStatus =
    selectedTournament && engine && !isBracket
      ? getMatchPointStatusFromPolicy({
          policy: matchCompletionPolicy,
          teams,
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
  const championLabel =
    matchPointStatus.state === "champion"
      ? matchPointStatus.championLabel
      : bracketChampion?.displayName ?? null;
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
  const killRaceTopTeam = killRaceState?.teamTotals[0] ?? null;
  const killRaceMvpNames = killRaceState?.mvp.map((player) => player.playerName) ?? [];

  const nowNarration = (() => {
    if (!selectedTournament) {
      return "Selecciona un torneo para preparar la señal y la narrativa.";
    }
    if (isKillRace) {
      if (killRaceState?.champion) {
        return `Cierra con ${killRaceState.champion.name}, campeón confirmado, y conserva las estadísticas finales.`;
      }
      if (killRaceState?.broadcastMatch) {
        return `Sigue el Match ${killRaceState.broadcastMatch.id}, la serie enviada por Operator.`;
      }
      return killRaceTopTeam
        ? `${killRaceTopTeam.teamName} lidera las kills confirmadas; no hay serie al aire.`
        : "Kill Race está en preparación; no hay mapas confirmados ni serie al aire.";
    }
    if (championLabel) {
      return `Cierra con ${championLabel}: el campeonato ya está decidido.`;
    }
    if (matchPointStatus.state === "threshold_reached") {
      return `Sigue a ${matchPointStatus.leaderName}: Match Point activo y la definición sigue abierta.`;
    }
    if (matchPointStatus.state === "not_configured") {
      return "Match Point no está configurado; evita narrar umbral o definición hasta que Operator lo resuelva.";
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
          <CasterContextInspector
            key={selectedTournament.id}
            tournament={selectedTournament}
            teams={teams}
            rawTeams={rawTeams}
            standings={standings}
            matches={matches}
            results={tournamentResults}
            identityCatalog={identityCatalog}
            matchPointStatus={matchPointStatus}
            matchCompletionPolicy={matchCompletionPolicy}
            isBracket={isBracket}
            bracketCompleted={bracketCompleted}
            bracketChampionLabel={bracketChampion?.displayName ?? null}
            activeMatch={activeMatch}
            loading={loading}
            backendOnline={backendOnline}
            killRaceState={killRaceState}
          />

          {isKillRace ? (
            <section className="bf-caster-context" aria-label="Match en transmisión">
              <strong>CANAL MAIN · EN TRANSMISIÓN</strong>
              <span>Torneo: {onAirTournament?.name ?? "Ninguno"}</span>
              <span>
                {killRaceState?.broadcastMatch
                  ? `Match ${killRaceState.broadcastMatch.id} · ${getMatchTeamLabel(killRaceState.broadcastMatch.team_a_id!)} vs ${getMatchTeamLabel(killRaceState.broadcastMatch.team_b_id!)}`
                  : "Sin serie enviada por Operator"}
              </span>
              <span>Engine: {broadcastChannel?.engine ?? "Sin engine"}</span>
            </section>
          ) : null}

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
                {isKillRace ? (
                  <div className="bf-caster-overlay-group" aria-label="Canal main en vivo">
                    <div className="bf-caster-overlay-group-head">
                      <div>
                        <span>CANAL MAIN · EN VIVO</span>
                        <strong>Fuentes OBS estables</strong>
                      </div>
                      <p>Sigue la transmisión enviada por Operator.</p>
                    </div>
                    {KILL_RACE_OVERLAYS.filter(
                      (overlay) => overlay.layout === "mvp" || overlay.layout === "champion"
                    ).map((overlay) => {
                      const url = getFollowOperatorOverlayUrl(
                        STREAM_ORIGIN,
                        overlay.layout,
                        "main",
                        true
                      );
                      const copyKey = `live-${overlay.layout}`;
                      const status = copyState?.key === copyKey ? copyState.status : null;
                      return (
                        <article className="bf-caster-overlay is-live-source" key={copyKey}>
                          <div className="bf-caster-overlay-copy">
                            <h3>{overlay.title} · CANAL MAIN</h3>
                            <p>Fuente OBS estable · sigue exclusivamente el canal main.</p>
                            <small className="bf-caster-overlay-note">No cambia al seleccionar otro torneo.</small>
                            <code>{url}</code>
                          </div>
                          <div className="bf-caster-overlay-actions">
                            <button type="button" onClick={() => void handleCopy(copyKey, url)}>
                              {status === "copied" ? "Copiada" : status === "error" ? "Reintentar" : "Copiar URL OBS"}
                            </button>
                            <button type="button" className="is-open" onClick={() => openOverlay(url)}>
                              Abrir canal al aire
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : null}

                {isKillRace ? (
                  <div className="bf-caster-overlay-group is-preview" aria-label="Preview del torneo seleccionado">
                    <div className="bf-caster-overlay-group-head">
                      <div>
                        <span>PREVIEW · TORNEO SELECCIONADO</span>
                        <strong>Vista previa histórica</strong>
                      </div>
                      <p>#{selectedTournament.id} · {selectedTournament.name}</p>
                    </div>
                    {KILL_RACE_OVERLAYS.filter(
                      (overlay) => overlay.layout === "mvp" || overlay.layout === "champion"
                    ).map((overlay) => {
                      const url = getTournamentOverlayUrl(
                        STREAM_ORIGIN,
                        selectedTournament.id,
                        overlay.layout
                      );
                      const copyKey = `preview-${overlay.layout}-${selectedTournament.id}`;
                      const status = copyState?.key === copyKey ? copyState.status : null;
                      const availabilityNote = overlay.layout === "mvp"
                        ? killRaceMvpAward?.state === "ready"
                          ? killRaceMvpAward.isTied
                            ? `MVP empatado · ${killRaceMvpAward.leaders.length} jugadores confirmados`
                            : `${killRaceMvpAward.title} disponible`
                          : killRaceMvpAward?.state === "no-player-stats"
                            ? "SIN DESGLOSE INDIVIDUAL CONFIRMADO"
                            : "Esperando cierre o player stats confirmadas"
                        : killRaceChampionAward?.state === "ready"
                          ? `Campeón oficial · ${killRaceChampionAward.champion?.name}`
                          : "CAMPEÓN AÚN NO DEFINIDO";
                      return (
                        <article className="bf-caster-overlay is-preview-source" key={copyKey}>
                          <div className="bf-caster-overlay-copy">
                            <h3>{overlay.title} · TORNEO SELECCIONADO</h3>
                            <p>Histórico fijo · torneo #{selectedTournament.id}.</p>
                            <small className="bf-caster-overlay-note">{availabilityNote}</small>
                            <code>{url}</code>
                          </div>
                          <div className="bf-caster-overlay-actions">
                            <button type="button" className="is-open" onClick={() => openOverlay(url)}>
                              Abrir preview
                            </button>
                            <button type="button" onClick={() => void handleCopy(copyKey, url)}>
                              {status === "copied" ? "Copiada" : status === "error" ? "Reintentar" : "Copiar URL fija"}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : null}

                {compatibleOverlays.filter(
                  (overlay) => !isKillRace || (overlay.layout !== "mvp" && overlay.layout !== "champion")
                ).map((overlay) => {
                  const url = isKillRace
                    ? getFollowOperatorOverlayUrl(
                        STREAM_ORIGIN,
                        overlay.layout,
                        "main",
                        overlay.transparent
                      )
                    : getOverlayUrl(selectedTournament.id, overlay);
                  const transparentUrl =
                    isKillRace && overlay.transparentOption
                      ? getFollowOperatorOverlayUrl(
                          STREAM_ORIGIN,
                          overlay.layout,
                          "main",
                          true
                        )
                      : null;
                  const status = copyState?.key === overlay.layout ? copyState.status : null;
                  const isRecommended = isKillRace
                    ? overlay.layout === "scorebug"
                    : overlay.layout === broadcastSetup.defaultLayout;
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
                        {isKillRace ? <small className="bf-caster-overlay-note">Follow operator · canal main</small> : null}
                        {overlay.note && <small className="bf-caster-overlay-note">{overlay.note}</small>}
                        <code>{url}</code>
                      </div>
                      <div className="bf-caster-overlay-actions">
                        <button type="button" onClick={() => void handleCopy(overlay.layout, url)}>
                          {status === "copied" ? "Copiada" : status === "error" ? "Reintentar" : "Copiar URL"}
                        </button>
                        <button type="button" className="is-open" onClick={() => openOverlay(url)}>
                          Abrir overlay
                        </button>
                        {transparentUrl && (
                          <button
                            type="button"
                            className="is-secondary"
                            onClick={() => void handleCopy(`${overlay.layout}-transparent`, transparentUrl)}
                          >
                            Copiar transparente
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
                {isKillRace
                  ? matches
                      .filter((match) =>
                        match.team_a_id !== null &&
                        match.team_b_id !== null &&
                        (match.winner_id === null ||
                          match.maps.some((map) => map.result_status === "provisional"))
                      )
                      .map((match) => {
                        const overlay = KILL_RACE_OVERLAYS[0];
                        const url = getOverlayUrl(selectedTournament.id, overlay, match.id);
                        return (
                          <article className="bf-caster-overlay" key={`fixed-${match.id}`}>
                            <div className="bf-caster-overlay-copy">
                              <h3>Scorebug fijo · Match {match.id}</h3>
                              <p>{getMatchTeamLabel(match.team_a_id!)} vs {getMatchTeamLabel(match.team_b_id!)}</p>
                              <code>{url}</code>
                            </div>
                            <div className="bf-caster-overlay-actions">
                              <button type="button" onClick={() => void handleCopy(`fixed-${match.id}`, url)}>Copy URL</button>
                              <button type="button" className="is-open" onClick={() => openOverlay(url)}>Open overlay</button>
                            </div>
                          </article>
                        );
                      })
                  : null}
                {isKillRace && killRaceChampionAward?.state !== "ready"
                  ? matches
                      .filter((match) =>
                        match.team_a_id !== null &&
                        match.team_b_id !== null &&
                        match.maps.some(
                          (map) =>
                            map.result_status === "confirmed" &&
                            (map.player_stats?.length ?? 0) > 0
                        )
                      )
                      .map((match) => {
                        const overlay = KILL_RACE_OVERLAYS.find(
                          (candidate) => candidate.layout === "mvp"
                        )!;
                        const url = getTournamentOverlayUrl(
                          STREAM_ORIGIN,
                          selectedTournament.id,
                          overlay.layout,
                          match.id
                        );
                        return (
                          <article className="bf-caster-overlay" key={`fixed-mvp-${match.id}`}>
                            <div className="bf-caster-overlay-copy">
                              <h3>MVP fijo · Match {match.id}</h3>
                              <p>{getMatchTeamLabel(match.team_a_id!)} vs {getMatchTeamLabel(match.team_b_id!)}</p>
                              <code>{url}</code>
                            </div>
                            <div className="bf-caster-overlay-actions">
                              <button type="button" onClick={() => void handleCopy(`fixed-mvp-${match.id}`, url)}>Copiar URL fija</button>
                              <button type="button" className="is-open" onClick={() => openOverlay(url)}>Abrir preview</button>
                            </div>
                          </article>
                        );
                      })
                  : null}
                {!isKillRace ? <article className="bf-caster-overlay bf-caster-overlay-dark">
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
                </article> : null}
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
                {isKillRace && killRaceState?.teamTotals.length ? (
                  <ol>
                    {killRaceState.teamTotals.slice(0, 3).map((entry, index) => (
                      <li key={entry.teamId}>
                        <b>{index + 1}</b>
                        <strong>{entry.teamName}</strong>
                        <small>{entry.kills} K · {entry.confirmedMaps} mapas confirmados</small>
                      </li>
                    ))}
                  </ol>
                ) : topThree.length > 0 ? (
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
                  <strong>{isKillRace ? killRaceTopTeam?.teamName ?? "Sin datos suficientes" : teamToWatch}</strong>
                  {isKillRace
                    ? killRaceTopTeam ? ` lidera con ${killRaceTopTeam.kills} kills confirmadas.` : " no tiene mapas confirmados."
                    : highestKills ? ` lidera en kills con ${highestKills.kills}.` : " no tiene estadísticas todavía."}
                  {!isKillRace && teamToWatchContext?.notes ? ` Nota Identity: ${teamToWatchContext.notes}` : ""}
                </p>
              </div>

              <div className="bf-caster-note-block">
                <span>
                  {isKillRace
                    ? killRaceMvpNames.length > 1 ? "MVP empatado" : killRaceMvpNames.length === 1 ? "MVP confirmado" : "MVP pendiente"
                    : mvp.kind === "player"
                    ? mvp.tiedWith.length > 0
                      ? "MVP empatado"
                      : "MVP actual"
                    : "MVP pendiente"}
                </span>
                <p>
                  {isKillRace ? (
                    killRaceMvpNames.length
                      ? <><strong>{killRaceMvpNames.join(" / ")}</strong> · {killRaceState?.mvp[0]?.kills ?? 0} K confirmadas.</>
                      : "Sin desglose individual; no se infiere MVP desde kills de equipo."
                  ) : mvp.kind === "player" ? (
                    mvp.tiedWith.length > 0 ? (
                      <>
                        MVP empatado:{" "}
                        <strong>
                          {[mvp.playerName, ...mvp.tiedWith.map((entry) => entry.playerName)].join(" / ")}
                        </strong>{" "}
                        · {mvp.kills} K
                        {playerMvpIdentity?.notes ? ` · Nota Identity: ${playerMvpIdentity.notes}` : ""}
                      </>
                    ) : (
                      <>
                        MVP actual: <strong>{mvp.playerName}</strong> suma {mvp.kills} kills.
                        {playerMvpIdentity?.notes ? ` Nota Identity: ${playerMvpIdentity.notes}` : ""}
                      </>
                    )
                  ) : (
                    "MVP pendiente: faltan player stats reportadas."
                  )}
                </p>
              </div>

              <div className="bf-caster-note-block">
                <span>{isKillRace ? "Campeón" : "Match Point / campeón"}</span>
                <p>{isKillRace
                  ? killRaceState?.champion ? `Campeón de Kill Race: ${killRaceState.champion.name}.` : "La llave sigue abierta."
                  : matchPointMessage ?? (bracketChampion ? `Campeón de bracket: ${bracketChampion.displayName}.` : "Sin definición activa confirmada.")}</p>
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
