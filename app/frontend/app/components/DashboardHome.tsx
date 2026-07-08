"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { useWorldSeriesPractice } from "../lib/useWorldSeriesPractice";
import {
  IconArrowRight,
  IconDashboard,
  IconStream,
  IconTeams,
  IconTrophy,
} from "./icons";
import { resolveTournamentEngine } from "../../lib/tournamentModel";
import {
  findChampion,
  getMatchPointStatus,
  getMatchPointStatusMessage,
  getTeamDisplayName,
  getTeamRosterText,
  isTournamentCompleted,
} from "../../lib/tournamentStatus";

function parseTournamentId(value: string | null) {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const DASH = "—";

export default function DashboardHome() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preferredTournamentId = parseTournamentId(searchParams.get("tournamentId"));

  const {
    loading,
    tournaments,
    teams,
    matches,
    selectedTournament,
    selectedTournamentId,
    sortedStandings,
    latestReportedRound,
    currentGameNumber,
    reportsLoaded,
    totalTeams,
    selectedEngine,
    selectTournament,
  } = useWorldSeriesPractice(preferredTournamentId);

  const query = selectedTournamentId ? `?tournamentId=${selectedTournamentId}` : "";

  const stat = (value: number) => (loading ? DASH : String(value));
  const tournamentsCount = tournaments.length;
  const teamsCount = teams.length;
  const gamesCount = latestReportedRound;

  const top3 = sortedStandings.slice(0, 3);
  const gameNumber = currentGameNumber || latestReportedRound;
  const leader = top3[0];
  const streamReady = Boolean(selectedTournament);
  const engine = selectedTournament ? selectedEngine ?? resolveTournamentEngine(selectedTournament) : null;
  const needsRoulette = engine?.rosterPolicy === "roulette" && totalTeams === 0;
  const isKillRace = engine?.engineKey === "kill_race_bracket";
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const getDashboardTeamLabel = (teamId: number | null) => {
    const team = teamId ? teamsById.get(teamId) : null;
    return team ? getTeamDisplayName(team) : "Equipo sin nombre";
  };
  const killRaceCompletedSeries = matches
    .filter((match) => match.status === "completed" && match.winner_id !== null)
    .sort((left, right) => left.round - right.round || left.id - right.id);
  const killRacePlayableMatches = matches
    .filter(
      (match) =>
        match.team_a_id !== null &&
        match.team_b_id !== null &&
        match.winner_id === null &&
        match.status !== "completed"
    )
    .sort((left, right) => left.round - right.round || left.id - right.id);
  const killRaceCurrentMatch = killRacePlayableMatches[0] ?? null;
  const killRaceChampion = isKillRace ? findChampion(matches, teams) : null;
  const killRaceCompleted = isKillRace ? isTournamentCompleted(matches) : false;
  const matchPointStatus =
    engine && !isKillRace
      ? getMatchPointStatus({
          tournament: selectedTournament,
          threshold: engine.matchPointThreshold,
          standings: sortedStandings,
          teams,
          matches,
        })
      : { state: "idle" as const };
  const matchPointMessage = isKillRace ? null : getMatchPointStatusMessage(matchPointStatus);
  const matchPointRoster =
    matchPointStatus.state === "champion"
      ? getTeamRosterText(matchPointStatus.champion) || "Roster pendiente"
      : null;
  const killRaceProgress =
    matches.length > 0 ? `${killRaceCompletedSeries.length}/${matches.length} series cerradas` : "Bracket pendiente";
  const killRaceCurrentLabel =
    killRaceCurrentMatch?.team_a_id && killRaceCurrentMatch?.team_b_id
      ? `${getDashboardTeamLabel(killRaceCurrentMatch.team_a_id)} vs ${getDashboardTeamLabel(killRaceCurrentMatch.team_b_id)}`
      : null;
  const setupMissing = Boolean(selectedTournament && totalTeams === 0);
  const cta = !selectedTournament
    ? { label: "Completar setup", href: "/torneos" }
    : needsRoulette
      ? { label: "Abrir Ruleta", href: `/operator${query}&roulette=1` }
      : isKillRace
        ? {
            label: matches.length === 0 ? "Preparar bracket" : killRaceCompleted ? "Ver bracket final" : "Operar serie actual",
            href: `/operator${query}&tab=bracket`,
          }
        : setupMissing
          ? { label: "Completar setup", href: `/operator${query}` }
          : { label: "Ir a Operator · cargar partida", href: `/operator${query}` };

  function handleSelectTournament(tournamentId: number) {
    selectTournament(tournamentId);
    router.replace(`/dashboard?tournamentId=${tournamentId}`);
  }

  return (
    <div className="bf-dash bf-dash-v2">
      <section className="bf-dash-active">
        <div className="bf-dash-active-main">
          <span className="bf-dash-section-label">Práctica activa</span>
          <h2>{selectedTournament?.name ?? "Sin torneo activo"}</h2>
          {tournaments.length > 0 ? (
            <label className="bf-standings-selector">
              <span>Torneo activo</span>
              <select
                value={selectedTournamentId ?? ""}
                onChange={(event) => handleSelectTournament(Number(event.target.value))}
              >
                {tournaments.map((tournament) => (
                  <option key={tournament.id} value={tournament.id}>
                    {tournament.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="bf-dash-active-meta">
            <span>{engine?.label ?? selectedTournament?.game ?? "Selecciona o crea una práctica"}</span>
            <span aria-hidden="true">·</span>
            <span>
              {isKillRace
                ? matches.length > 0
                  ? killRaceCompleted
                    ? `Campeón: ${killRaceChampion?.displayName ?? "—"}`
                    : killRaceCurrentLabel ?? "Esperando ganador"
                  : totalTeams > 0
                    ? "Falta preparar bracket"
                    : "Falta generar equipos"
                : matchPointStatus.state === "champion"
                  ? `Campeón: ${matchPointStatus.championLabel}`
                  : gameNumber > 0
                  ? `Partida ${gameNumber}`
                  : "Sin partida abierta"}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {matchPointStatus.state === "threshold_reached" && matchPointMessage ? (
                matchPointMessage
              ) : leader ? (
                <>
                  Líder: <strong>{leader.team_name}</strong>
                </>
              ) : isKillRace ? (
                killRaceProgress
              ) : (
                "Sin líder todavía"
              )}
            </span>
          </div>
          {!isKillRace && matchPointStatus.state !== "idle" ? (
            <div className={`bf-status-banner ${matchPointStatus.state === "champion" ? "is-success" : "is-warning"}`}>
              <span className="bf-status-banner-kicker">
                {matchPointStatus.state === "champion" ? "Campeon por Match Point" : "Estado Match Point"}
              </span>
              <strong className="bf-status-banner-title">
                {matchPointStatus.state === "champion"
                  ? matchPointStatus.championLabel
                  : "Match Point alcanzado"}
              </strong>
              <span className="bf-status-banner-sub">
                {matchPointStatus.state === "champion"
                  ? matchPointRoster
                  : matchPointMessage}
              </span>
            </div>
          ) : null}
        </div>

        <div className="bf-dash-active-side">
          <span className="bf-dash-results-state">
            <i className="bf-op-dot" />
            {selectedTournament
              ? `${totalTeams} equipos · ${reportsLoaded} resultados cargados`
              : "Sistema listo"}
          </span>
          <Link href={cta.href} className="bf-dash-operator-cta">
            {cta.label}
            <IconArrowRight size={17} />
          </Link>
        </div>
      </section>

      <section className="bf-dash-stats">
        <article className="bf-dash-stat">
          <span className="bf-dash-stat-icon">
            <IconTrophy size={22} />
          </span>
          <div className="bf-dash-stat-body">
            <span className="bf-dash-stat-label">Torneos activos</span>
            <span className="bf-dash-stat-value">{stat(tournamentsCount)}</span>
            <span className="bf-dash-stat-sub">Operación World Series</span>
          </div>
        </article>

        <article className="bf-dash-stat">
          <span className="bf-dash-stat-icon">
            <IconTeams size={22} />
          </span>
          <div className="bf-dash-stat-body">
            <span className="bf-dash-stat-label">Equipos registrados</span>
            <span className="bf-dash-stat-value">{stat(teamsCount)}</span>
            <span className="bf-dash-stat-sub">
              {selectedTournament ? "Contexto heredado por Operator y Standings" : "Sin torneo activo"}
            </span>
          </div>
        </article>

        <article className="bf-dash-stat">
          <span className="bf-dash-stat-icon">
            <IconDashboard size={22} />
          </span>
          <div className="bf-dash-stat-body">
            <span className="bf-dash-stat-label">{isKillRace ? "Ronda actual" : "Partidas jugadas"}</span>
            <span className="bf-dash-stat-value">
              {isKillRace ? stat(killRaceCompletedSeries.length) : stat(gamesCount)}
            </span>
            <span className="bf-dash-stat-sub">
              {isKillRace
                ? matches.length > 0
                  ? `${matches.length} series totales`
                  : "Bracket pendiente"
                : "Partidas con resultados"}
            </span>
          </div>
        </article>

        <article className="bf-dash-stat is-stream">
          <span className="bf-dash-stat-icon">
            <IconStream size={22} />
          </span>
          <div className="bf-dash-stat-body">
            <span className="bf-dash-stat-label">Stream listo</span>
            <span className="bf-dash-stat-value is-state">
              {loading ? DASH : streamReady ? "LISTO" : "ESPERA"}
            </span>
            <span className="bf-dash-stat-sub">
              {streamReady ? "Sistema listo para transmisión" : "Activa una práctica"}
            </span>
          </div>
        </article>
      </section>

      <section className="bf-dash-workspace">
        <div className="bf-dash-podium-panel">
          <div className="bf-dash-panel-heading">
            <div>
              <span className="bf-dash-section-label">Clasificación</span>
              <h3>Podio actual</h3>
            </div>
            <span className="bf-dash-badge">{gameNumber > 0 ? `Partida ${gameNumber}` : "Sin resultados"}</span>
          </div>

          {isKillRace ? (
            matches.length === 0 ? (
              <p className="bf-dash-empty">
                {totalTeams > 0
                  ? "Equipos confirmados. Prepara bracket para ver la serie actual."
                  : "Falta generar equipos. No hay tabla WSOW para Kill Race."}
              </p>
            ) : killRaceCompleted ? (
              <div className="bf-dash-seed-preview">
                <article className="bf-dash-seed-row">
                  <span>Campeón</span>
                  <strong>{killRaceChampion?.displayName ?? "—"}</strong>
                  <em>Final</em>
                  <strong>Serie {killRaceChampion?.finalScore ?? "—"}</strong>
                </article>
              </div>
            ) : (
              <div className="bf-dash-seed-preview">
                {killRaceCurrentMatch && killRaceCurrentLabel ? (
                  <article className="bf-dash-seed-row">
                    <span>Serie actual</span>
                    <strong>{killRaceCurrentLabel}</strong>
                    <em>BO3</em>
                    <strong>{killRaceProgress}</strong>
                  </article>
                ) : (
                  <article className="bf-dash-seed-row">
                    <span>Bracket</span>
                    <strong>No hay serie jugable</strong>
                    <em>—</em>
                    <strong>Revisa propagación de BYE</strong>
                  </article>
                )}
                {killRaceCompletedSeries.slice(-2).map((match) => {
                  const winner = match.winner_id ? teamsById.get(match.winner_id) : null;
                  return (
                    <article key={match.id} className="bf-dash-seed-row">
                      <span>Ganador M{match.id}</span>
                      <strong>{winner ? getTeamDisplayName(winner) : "—"}</strong>
                      <em>Serie</em>
                      <strong>{match.maps_won_a}-{match.maps_won_b}</strong>
                    </article>
                  );
                })}
              </div>
            )
          ) : top3.length > 0 ? (
            <div className="bf-dash-podium-list">
              {top3.map((entry, index) => (
                <article
                  key={entry.team_id}
                  className={`bf-dash-podium-row${index === 0 ? " is-leader" : ""}`}
                >
                  <span className="bf-dash-rank">{index + 1}</span>
                  <div className="bf-dash-team">
                    <span className="bf-dash-team-name">{entry.team_name}</span>
                    <span className="bf-dash-team-roster">
                      {entry.players.length > 0 ? entry.players.join(" / ") : "Roster pendiente"}
                    </span>
                  </div>
                  <span className="bf-dash-podium-kills">{entry.kills} K</span>
                  <span className="bf-dash-podio-pts">{entry.total_points.toFixed(1)}</span>
                </article>
              ))}
            </div>
          ) : (
            <p className="bf-dash-empty">
              {loading
                ? "Cargando clasificación…"
                : isKillRace
                  ? "Falta generar bracket. No hay tabla WSOW para Kill Race."
                  : "Todavía no hay resultados cargados."}
            </p>
          )}

          <Link href={isKillRace ? `/operator${query}&tab=bracket` : `/standings${query}`} className="bf-dash-cta">
            {isKillRace ? cta.label : "Ver clasificación completa"}
            <IconArrowRight size={16} />
          </Link>
        </div>

      </section>
    </div>
  );
}
