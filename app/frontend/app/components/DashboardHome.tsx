"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { resolveTournamentEngine } from "../../lib/tournamentModel";
import { getOperatorNextAction } from "../../lib/operatorNextAction";
import {
  findChampion,
  getMatchPointStatus,
  getTeamDisplayName,
  isTournamentCompleted,
} from "../../lib/tournamentStatus";
import { useWorldSeriesPractice } from "../lib/useWorldSeriesPractice";
import {
  IconArrowRight,
  IconDashboard,
  IconOperator,
  IconStandings,
  IconStream,
  IconTeams,
  IconTrophy,
} from "./icons";

function parseTournamentId(value: string | null) {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const DASH = "-";

const STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  draft: "Borrador",
  teams_generated: "Equipos listos",
  bracket_generated: "Bracket listo",
  bracket_ready: "Bracket listo",
  running: "En operación",
  completed: "Finalizado",
  archived: "Archivado",
  pending: "Pendiente",
  ready: "Listo",
  in_progress: "En vivo",
  waiting_opponent: "Esperando oponente",
  respin_open: "Respin abierto",
  locked: "Bloqueado",
  participants_pending: "Participantes pendientes",
};

const STRUCTURE_LABELS = {
  cumulative: "Acumulativo",
  single_elim: "Single Elim",
  double_elim: "Double Elim",
} as const;

function getStatusLabel(value: string | null | undefined, fallback = "Sin estado") {
  if (!value) {
    return fallback;
  }

  return STATUS_LABELS[value.toLowerCase()] ?? value;
}

function formatPoints(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export default function DashboardHome() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preferredTournamentId = parseTournamentId(searchParams.get("tournamentId"));

  const {
    backendOnline,
    loading,
    message,
    tournaments,
    teams,
    players,
    matches,
    selectedTournament,
    selectedTournamentId,
    activeMatch,
    activeMatchResults,
    tournamentResults,
    sortedStandings,
    latestReportedRound,
    currentGameNumber,
    reportsLoaded,
    totalTeams,
    canCreateNextGame,
    selectedEngine,
    selectTournament,
  } = useWorldSeriesPractice(preferredTournamentId);

  const query = selectedTournamentId ? `?tournamentId=${selectedTournamentId}` : "";
  const operatorHref = selectedTournamentId ? `/operator${query}` : "/operator";
  const standingsHref = selectedTournamentId ? `/standings${query}` : "/standings";
  const streamHref = selectedTournamentId ? `/stream${query}` : "/stream";
  const casterHref = selectedTournamentId ? `/caster${query}` : "/caster";
  const bracketHref = selectedTournamentId
    ? `/operator?tournamentId=${selectedTournamentId}&tab=bracket`
    : "/operator";

  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const stat = (value: number | string) => (loading ? DASH : String(value));
  const tournamentsCount = tournaments.length;
  const playersCount = players.length;
  const top5 = sortedStandings.slice(0, 5);
  const leader = top5[0] ?? null;
  const leaderTeam = leader ? teamsById.get(leader.team_id) : null;
  const leaderLabel = leaderTeam ? getTeamDisplayName(leaderTeam) : leader?.team_name ?? null;
  const reportedBattleRoyaleMatches = matches.filter(
    (match) => match.team_a_id === null && match.team_b_id === null && match.status === "completed"
  ).length;
  const gameNumber = currentGameNumber || latestReportedRound;
  const engine = selectedTournament ? selectedEngine ?? resolveTournamentEngine(selectedTournament) : null;
  const structureLabel = engine ? STRUCTURE_LABELS[engine.tournamentStructure] : null;
  const streamReady = backendOnline && Boolean(selectedTournament);
  const rosterStatusLabel = selectedTournament
    ? getStatusLabel(selectedTournament.roster_status, "Sin roster")
    : DASH;
  const bracketStatusLabel =
    selectedTournament && engine?.primaryView === "bracket"
      ? getStatusLabel(selectedTournament.bracket_status, "Sin bracket")
      : "No aplica";
  const isKillRace = engine?.engineKey === "kill_race_bracket";
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
  const resolvedKillRaceCurrentLabel =
    killRaceCurrentMatch?.team_a_id && killRaceCurrentMatch?.team_b_id
      ? `${getTeamDisplayName(teamsById.get(killRaceCurrentMatch.team_a_id)!)} vs ${getTeamDisplayName(
          teamsById.get(killRaceCurrentMatch.team_b_id)!
        )}`
      : null;

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

  const tournamentFinalized =
    selectedTournament?.status === "completed" ||
    matchPointStatus.state === "champion" ||
    killRaceCompleted;

  const hasOfficialReports = tournamentResults.length > 0;
  const hasPlayerStats = tournamentResults.some(
    (result) => (result.player_stats?.length ?? 0) > 0
  );
  const standingsReady = Boolean(
    selectedTournament &&
      (isKillRace ? matches.length > 0 : sortedStandings.length > 0)
  );
  const matchPointActive =
    matchPointStatus.state === "threshold_reached" ||
    matchPointStatus.state === "champion";
  const mvpReadinessLabel = hasPlayerStats
    ? "MVP listo"
    : hasOfficialReports
      ? "Team MVP fallback"
      : "MVP pendiente";

  const pendingReportsCount = activeMatch ? Math.max(totalTeams - activeMatchResults.length, 0) : 0;
  const hasPendingOperation =
    !tournamentFinalized &&
    (isKillRace ? Boolean(killRaceCurrentMatch) : Boolean(activeMatch && pendingReportsCount > 0));
  const totalConfirmedKills = sortedStandings.reduce((sum, entry) => sum + entry.kills, 0);
  const matchPointHeadline =
    matchPointStatus.state === "champion"
      ? `Campeon por Match Point: ${matchPointStatus.championLabel}.`
      : matchPointStatus.state === "threshold_reached"
        ? "Match Point activo: falta cerrar la partida completa o resolver el desempate."
        : null;

  const phaseLabel = (() => {
    if (!selectedTournament || !engine) {
      return "Sin torneo activo";
    }

    if (selectedTournament.status === "completed" || matchPointStatus.state === "champion" || killRaceCompleted) {
      return "Finalizado";
    }
    if (matchPointStatus.state === "threshold_reached") {
      return "Match Point activo";
    }
    if (
      matches.length > 0 ||
      hasOfficialReports ||
      activeMatch ||
      selectedTournament.status === "running" ||
      selectedTournament.status === "active"
    ) {
      return "En operación";
    }
    return "Borrador";
  })();

  const nextAction = getOperatorNextAction({
    tournament: selectedTournament,
    engine,
    backendOnline,
    teamsCount: totalTeams,
    participantsCount: playersCount,
    matches,
    activeMatch,
    reportsLoaded,
    totalTeams,
    matchPointStatus,
    canCreateNextMatch: canCreateNextGame,
  });

  const dashboardNextAction = (() => {
    if (tournamentFinalized) {
      return {
        label: "Ver Standings finales",
        description: "El torneo tiene un cierre competitivo confirmado.",
        ctaLabel: "Ver Standings finales",
        href: standingsHref,
        tone: "done" as const,
        kind: "FINALIZADO",
      };
    }
    if (matchPointStatus.state === "threshold_reached") {
      return {
        label: "Resolver Match Point",
        description: "El umbral está activo y requiere resolución operativa.",
        ctaLabel: "Ir a Operator",
        href: operatorHref,
        tone: "warning" as const,
        kind: "MATCH_POINT",
      };
    }
    if (activeMatch && pendingReportsCount > 0) {
      return {
        label: "Ir a Operator",
        description: `${pendingReportsCount} ${pendingReportsCount === 1 ? "reporte pendiente" : "reportes pendientes"} en la partida activa.`,
        ctaLabel: "Ir a Operator",
        href: operatorHref,
        tone: "pending" as const,
        kind: "REPORTES",
      };
    }
    if (canCreateNextGame && hasOfficialReports) {
      return {
        label: "Crear siguiente partida",
        description: "Todos los reportes de la partida anterior están cargados.",
        ctaLabel: "Ir a Operator",
        href: operatorHref,
        tone: "ready" as const,
        kind: "SIGUIENTE_PARTIDA",
      };
    }
    return {
      label: nextAction.label,
      description: nextAction.description,
      ctaLabel: nextAction.ctaLabel,
      href: nextAction.href,
      tone: nextAction.tone,
      kind: nextAction.kind,
    };
  })();

  const leaderCardValue =
    matchPointStatus.state === "champion"
      ? matchPointStatus.championLabel
      : killRaceChampion?.displayName ?? leaderLabel ?? "Sin lider";

  const leaderCardSub =
    matchPointStatus.state === "champion"
      ? "Campeon por Match Point confirmado."
      : killRaceChampion
        ? `Campeon con score final ${killRaceChampion.finalScore}.`
        : leader
          ? `${formatPoints(leader.total_points)} pts · ${leader.kills} K`
          : isKillRace
            ? "Todavia no hay campeon."
            : "Todavia no hay standings cargados.";

  const reportCardValue = isKillRace
    ? `${killRaceCompletedSeries.length}/${matches.length || 0}`
    : stat(reportedBattleRoyaleMatches);

  const reportCardSub = isKillRace
    ? resolvedKillRaceCurrentLabel
      ? `Serie lista: ${resolvedKillRaceCurrentLabel}`
      : matches.length > 0
        ? "Sin serie jugable en este momento."
        : "Bracket pendiente."
    : activeMatch
      ? `Partida ${activeMatch.round}: ${reportsLoaded}/${totalTeams} reportes`
      : "Sin partida abierta.";

  function handleSelectTournament(tournamentId: number) {
    selectTournament(tournamentId);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("tournamentId", String(tournamentId));
    router.replace(`/dashboard?${nextParams.toString()}`);
  }

  return (
    <div className="bf-dash bf-dash-v2 bf-dash-shell">
      <header className="bf-dash-welcome">
        <div>
          <span className="bf-dash-section-label">Dashboard operativo</span>
          <h1>Bienvenido de vuelta, Operator</h1>
          <p>Controla el torneo activo, su señal competitiva y el siguiente paso operativo.</p>
        </div>
        <span className={`bf-dash-badge${backendOnline ? " is-live" : " is-offline"}`}>
          <i className="bf-op-dot" />
          {backendOnline ? "Backend online" : "Backend offline"}
        </span>
      </header>

      <section className="bf-dash-active bf-dash-header">
        <div className="bf-dash-active-main bf-dash-header-main">
          <div className="bf-dash-header-topline">
            <span className="bf-dash-section-label">Torneo activo</span>
          </div>

          <h2>{selectedTournament?.name ?? "Sin torneo activo"}</h2>

          <div className="bf-dash-active-meta">
            <span>{engine?.label ?? "Selecciona o crea un torneo"}</span>
            <span aria-hidden="true">·</span>
            <span>{structureLabel ?? "Sin formato activo"}</span>
            <span aria-hidden="true">·</span>
            <span>{engine ? `${engine.teamSize}v${engine.teamSize}` : "Sin team size"}</span>
            <span aria-hidden="true">·</span>
            <span>{phaseLabel}</span>
          </div>

          <div className="bf-dash-chip-row" aria-label="Estado del torneo">
            <span className="bf-dash-chip">
              Estado: {selectedTournament ? getStatusLabel(selectedTournament.status) : "Sin torneo"}
            </span>
            <span className="bf-dash-chip">Roster: {rosterStatusLabel}</span>
            <span className="bf-dash-chip">
              {engine?.primaryView === "bracket" ? `Bracket: ${bracketStatusLabel}` : "Vista: Standings"}
            </span>
            <span className="bf-dash-chip">
              {engine?.supportsMatchPoint ? `Match Point ${engine.matchPointThreshold ?? DASH}` : "Sin Match Point"}
            </span>
          </div>

          {matchPointHeadline ? (
            <div className={`bf-status-banner ${matchPointStatus.state === "champion" ? "is-success" : "is-warning"}`}>
              <span className="bf-status-banner-kicker">
                {matchPointStatus.state === "champion" ? "Cierre competitivo" : "Estado Match Point"}
              </span>
              <strong className="bf-status-banner-title">
                {matchPointStatus.state === "champion" ? matchPointStatus.championLabel : "Match Point alcanzado"}
              </strong>
              <span className="bf-status-banner-sub">{matchPointHeadline}</span>
            </div>
          ) : null}
        </div>

        <div className="bf-dash-active-side bf-dash-header-side">
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
          ) : (
            <Link href="/torneos" className="bf-dash-operator-cta">
              Gestionar torneos
              <IconArrowRight size={17} />
            </Link>
          )}

          <span className="bf-dash-results-state">
            <i className="bf-op-dot" />
            {selectedTournament
              ? `${totalTeams} equipos · ${playersCount} participantes`
              : `${tournamentsCount} torneos operables`}
          </span>
        </div>
      </section>

      {message ? <p className="bf-message bf-dash-surface-note">{message}</p> : null}

      <div className="bf-dash-layout">
        <div className="bf-dash-main">
          <section className={`bf-dash-active bf-dash-next is-${dashboardNextAction.tone}`}>
            <div className="bf-dash-active-main bf-dash-next-copy">
              <span className="bf-dash-section-label">Siguiente acción · {dashboardNextAction.kind.replaceAll("_", " ")}</span>
              <h3 className="bf-dash-next-title">{dashboardNextAction.label}</h3>
              <p className="bf-dash-next-detail">{dashboardNextAction.description}</p>
              <div className="bf-dash-next-meta">
                <span>{selectedTournament ? selectedTournament.name : "Sin torneo seleccionado"}</span>
                <span aria-hidden="true">·</span>
                <span>{engine?.primaryView === "bracket" ? "Superficie bracket" : "Superficie standings"}</span>
              </div>
            </div>

            <div className="bf-dash-active-side">
              <Link href={dashboardNextAction.href} className="bf-dash-operator-cta">
                {dashboardNextAction.ctaLabel}
                <IconArrowRight size={17} />
              </Link>
            </div>
          </section>

          <section className="bf-dash-stats bf-dash-state-grid" aria-label="Estado del torneo">
            <article className="bf-dash-stat">
              <span className="bf-dash-stat-icon">
                <IconDashboard size={22} />
              </span>
              <div className="bf-dash-stat-body">
                <span className="bf-dash-stat-label">Estado</span>
                <span className="bf-dash-stat-value is-state">{loading ? DASH : phaseLabel}</span>
                <span className="bf-dash-stat-sub">
                  {selectedTournament ? getStatusLabel(selectedTournament.status) : "Sin contexto operativo"}
                </span>
              </div>
            </article>

            <article className="bf-dash-stat">
              <span className="bf-dash-stat-icon">
                <IconTeams size={22} />
              </span>
              <div className="bf-dash-stat-body">
                <span className="bf-dash-stat-label">Equipos</span>
                <span className="bf-dash-stat-value">{stat(totalTeams)}</span>
                <span className="bf-dash-stat-sub">
                  {loading ? DASH : `${playersCount} participantes registrados`}
                </span>
              </div>
            </article>

            <article className="bf-dash-stat">
              <span className="bf-dash-stat-icon">
                <IconDashboard size={22} />
              </span>
              <div className="bf-dash-stat-body">
                <span className="bf-dash-stat-label">
                  {isKillRace ? "Series cerradas" : "Partidas reportadas"}
                </span>
                <span className="bf-dash-stat-value">{loading ? DASH : reportCardValue}</span>
                <span className="bf-dash-stat-sub">{reportCardSub}</span>
              </div>
            </article>

            <article className="bf-dash-stat">
              <span className="bf-dash-stat-icon">
                <IconTrophy size={22} />
              </span>
              <div className="bf-dash-stat-body">
                <span className="bf-dash-stat-label">Motor</span>
                <span className="bf-dash-stat-value">{loading ? DASH : engine?.label ?? "Sin motor"}</span>
                <span className="bf-dash-stat-sub">
                  {loading
                    ? DASH
                    : engine?.primaryView === "bracket"
                      ? `Bracket BO${engine.bestOf ?? 3}`
                      : `${structureLabel ?? "Acumulativo"} · Match Point ${engine?.matchPointThreshold ?? DASH}`}
                </span>
              </div>
            </article>

            <article className="bf-dash-stat">
              <span className="bf-dash-stat-icon">
                <IconTrophy size={22} />
              </span>
              <div className="bf-dash-stat-body">
                <span className="bf-dash-stat-label">
                  {killRaceChampion || matchPointStatus.state === "champion" ? "Campeon" : "Lider actual"}
                </span>
                <span className="bf-dash-stat-value">{loading ? DASH : leaderCardValue}</span>
                <span className="bf-dash-stat-sub">{leaderCardSub}</span>
              </div>
            </article>

            <article className="bf-dash-stat is-stream">
              <span className="bf-dash-stat-icon">
                <IconStream size={22} />
              </span>
              <div className="bf-dash-stat-body">
                <span className="bf-dash-stat-label">Stream</span>
                <span className="bf-dash-stat-value is-state">{loading ? DASH : streamReady ? "LISTO" : "ESPERA"}</span>
                <span className="bf-dash-stat-sub">
                  {streamReady ? "Superficie preparada para Stream/OBS." : "Activa un torneo para exponer el stream."}
                </span>
              </div>
            </article>
          </section>

          <section className="bf-dash-podium-panel">
            <div className="bf-dash-panel-heading">
              <div>
                <span className="bf-dash-section-label">Resumen competitivo</span>
                <h3>{isKillRace ? "Bracket y series" : "Top 5 competitivo"}</h3>
              </div>
              <span className="bf-dash-badge">
                {isKillRace
                  ? matches.length > 0
                    ? `${killRaceCompletedSeries.length}/${matches.length} cerradas`
                    : "Sin bracket"
                  : gameNumber > 0
                    ? `Partida ${gameNumber}`
                    : "Sin resultados"}
              </span>
            </div>

            {isKillRace ? (
              matches.length === 0 ? (
                <p className="bf-dash-empty">
                  {totalTeams > 0
                    ? "El roster ya existe, pero todavia no hay bracket generado."
                    : "Todavia no hay equipos confirmados para armar el bracket."}
                </p>
              ) : (
                <div className="bf-dash-summary-stack">
                  <article className={`bf-dash-summary-hero${killRaceChampion ? " is-success" : ""}`}>
                    <span className="bf-dash-summary-kicker">
                      {killRaceChampion ? "Campeon confirmado" : "Serie prioritaria"}
                    </span>
                    <strong>
                      {killRaceChampion?.displayName ?? resolvedKillRaceCurrentLabel ?? "Sin serie jugable"}
                    </strong>
                    <span>
                      {killRaceChampion
                        ? `${killRaceChampion.rosterText || "Roster pendiente"} · score final ${killRaceChampion.finalScore}`
                        : resolvedKillRaceCurrentLabel
                          ? `BO${killRaceCurrentMatch?.best_of ?? 3} · ronda ${killRaceCurrentMatch?.round ?? DASH}`
                          : "El bracket esta esperando propagacion o cierre de una serie previa."}
                    </span>
                  </article>

                  <div className="bf-dash-summary-list">
                    {(killRaceCompletedSeries.slice(-3).reverse().length > 0
                      ? killRaceCompletedSeries.slice(-3).reverse()
                      : killRacePlayableMatches.slice(0, 2)
                    ).map((match) => {
                      const teamA = match.team_a_id ? teamsById.get(match.team_a_id) : null;
                      const teamB = match.team_b_id ? teamsById.get(match.team_b_id) : null;
                      const winner = match.winner_id ? teamsById.get(match.winner_id) : null;

                      return (
                        <article key={match.id} className="bf-dash-summary-row">
                          <span className="bf-dash-summary-row-label">M{match.id}</span>
                          <div className="bf-dash-summary-row-copy">
                            <strong>
                              {teamA ? getTeamDisplayName(teamA) : "TBD"} vs {teamB ? getTeamDisplayName(teamB) : "TBD"}
                            </strong>
                            <span>
                              {winner
                                ? `Ganador: ${getTeamDisplayName(winner)} · ${match.maps_won_a}-${match.maps_won_b}`
                                : `Ronda ${match.round} · ${getStatusLabel(match.status)}`}
                            </span>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              )
            ) : top5.length > 0 ? (
              <div className="bf-dash-podium-list">
                <div className="bf-dash-podium-columns" aria-hidden="true">
                  <span>#</span><span>Equipo / roster</span><span>Pts</span><span>Kills</span><span>Best</span><span>Partidas</span>
                </div>
                {top5.map((entry, index) => (
                  <article key={entry.team_id} className={`bf-dash-podium-row${index === 0 ? " is-leader" : ""}`}>
                    <span className="bf-dash-rank">{index + 1}</span>
                    <div className="bf-dash-team">
                      <span className="bf-dash-team-name">
                        {teamsById.get(entry.team_id)
                          ? getTeamDisplayName(teamsById.get(entry.team_id)!)
                          : entry.team_name}
                      </span>
                      <span className="bf-dash-team-roster">
                        {entry.players.length > 0 ? entry.players.join(" / ") : "Roster pendiente"}
                      </span>
                    </div>
                    <span className="bf-dash-podio-pts">{formatPoints(entry.total_points)}</span>
                    <span className="bf-dash-podium-kills">{entry.kills}</span>
                    <span className="bf-dash-podium-best">{entry.best_placement ?? DASH}</span>
                    <span className="bf-dash-podium-matches">{entry.matches_played}</span>
                  </article>
                ))}
              </div>
            ) : (
              <p className="bf-dash-empty">
                {loading
                  ? "Cargando resumen competitivo..."
                  : "Todavia no hay standings cargados. El Dashboard muestra un empty state honesto hasta que entren resultados reales."}
              </p>
            )}

            <Link href={isKillRace ? bracketHref : standingsHref} className="bf-dash-cta">
              {isKillRace ? "Abrir bracket completo" : "Ver standings completos"}
              <IconArrowRight size={16} />
            </Link>
          </section>
        </div>

        <aside className="bf-dash-rail">
          <section className="bf-dash-podium-panel">
            <div className="bf-dash-panel-heading">
              <div>
                <span className="bf-dash-section-label">Accesos rapidos</span>
                <h3>Superficies operativas</h3>
              </div>
            </div>

            <div className="bf-dash-quick">
              {hasPendingOperation ? (
                <Link href={operatorHref} className="bf-dash-quick-link is-primary">
                  <span className="bf-dash-quick-icon"><IconOperator size={19} /></span>
                  <span className="bf-dash-quick-copy">
                    <strong>Ir a Operator</strong>
                    <span>{isKillRace ? "Serie lista para operar." : `${pendingReportsCount} reportes pendientes.`}</span>
                  </span>
                </Link>
              ) : null}

              <Link href={standingsHref} className={`bf-dash-quick-link${!hasPendingOperation ? " is-primary" : ""}`}>
                <span className="bf-dash-quick-icon">
                  <IconStandings size={19} />
                </span>
                <span className="bf-dash-quick-copy">
                  <strong>{tournamentFinalized ? "Ver resultado final" : "Ver Standings"}</strong>
                  <span>{tournamentFinalized ? "Campeón y clasificación confirmada." : "Lectura competitiva y clasificación."}</span>
                </span>
              </Link>

              <Link href={streamHref} className="bf-dash-quick-link">
                <span className="bf-dash-quick-icon">
                  <IconStream size={19} />
                </span>
                <span className="bf-dash-quick-copy">
                  <strong>Abrir Stream</strong>
                  <span>Vista read-only para broadcast y OBS.</span>
                </span>
              </Link>

              <Link href="/torneos" className="bf-dash-quick-link">
                <span className="bf-dash-quick-icon">
                  <IconTeams size={19} />
                </span>
                <span className="bf-dash-quick-copy">
                  <strong>Gestionar torneos</strong>
                  <span>Crear, editar o cambiar contexto.</span>
                </span>
              </Link>
            </div>
          </section>

          <section className="bf-dash-podium-panel">
            <div className="bf-dash-panel-heading">
              <div>
                <span className="bf-dash-section-label">Señal compartible</span>
                <h3>Snapshot competitivo</h3>
              </div>
            </div>

            <div className="bf-dash-snapshot">
              <div className="bf-dash-snapshot-lead">
                <span>{tournamentFinalized ? "Campeón confirmado" : "Líder actual"}</span>
                <strong>{leaderCardValue}</strong>
                <small>{leaderCardSub}</small>
              </div>
              <div className="bf-dash-snapshot-stats">
                {isKillRace ? (
                  <>
                    <span><strong>{killRaceCompletedSeries.length}</strong> series cerradas</span>
                    <span><strong>{matches.length}</strong> series totales</span>
                    <span><strong>BO{engine?.bestOf ?? 3}</strong> formato</span>
                  </>
                ) : (
                  <>
                    <span><strong>{top5.length}</strong> top visibles</span>
                    <span><strong>{totalConfirmedKills}</strong> kills acumuladas</span>
                    <span><strong>{gameNumber || DASH}</strong> {tournamentFinalized ? "partida final" : "partida actual"}</span>
                  </>
                )}
              </div>
              <p>Datos reales listos para captura manual. Exportación todavía no disponible.</p>
            </div>
          </section>

          <section className="bf-dash-podium-panel">
            <div className="bf-dash-panel-heading">
              <div>
                <span className="bf-dash-section-label">Señal de evento</span>
                <h3>Broadcast readiness</h3>
              </div>
            </div>

            <div className="bf-dash-readiness">
              <div><span>Standings</span><strong className={standingsReady ? "is-ready" : "is-waiting"}>{standingsReady ? "LISTO" : "EN ESPERA"}</strong></div>
              <div><span>Stream overlay</span><strong className={streamReady ? "is-ready" : "is-waiting"}>{streamReady ? "LISTO" : "EN ESPERA"}</strong></div>
              <div><span>Player stats / MVP</span><strong className={hasPlayerStats ? "is-ready" : "is-waiting"}>{mvpReadinessLabel}</strong></div>
              <div><span>Match Point</span><strong className={matchPointActive ? "is-ready" : "is-waiting"}>{matchPointActive ? "ACTIVO" : "EN ESPERA"}</strong></div>
              <div><span>Caster Hub</span><strong className={selectedTournament ? "is-ready" : "is-waiting"}>{selectedTournament ? "Caster Hub listo" : "Seleccionar torneo"}</strong></div>
            </div>
            <Link href={selectedTournament ? casterHref : "/torneos"} className="bf-dash-inline-link">
              {selectedTournament ? "Abrir Caster Hub" : "Seleccionar torneo"} <IconArrowRight size={15} />
            </Link>
          </section>
        </aside>
      </div>

      <section className="bf-dash-motors">
        <div className="bf-dash-panel-heading">
          <div>
            <span className="bf-dash-section-label">Motores de torneo</span>
            <h3>Seleccionar o crear formato</h3>
          </div>
          <Link href="/torneos" className="bf-dash-inline-link">
            Ver torneos <IconArrowRight size={15} />
          </Link>
        </div>
        <div className="bf-dash-motors-grid">
          {[
            ["World Series BR", "Acumulativo · standings"],
            ["Resurgence / Rebirth WS", "Acumulativo · ritmo corto"],
            ["Gedeon Roulette WS", "Ruleta · acumulativo"],
            ["Kill Race Bracket", "Bracket · series BO"],
          ].map(([label, detail]) => (
            <Link key={label} href="/torneos" className="bf-dash-motor">
              <span className="bf-dash-motor-icon"><IconTrophy size={18} /></span>
              <span className="bf-dash-motor-copy"><strong>{label}</strong><small>{detail}</small></span>
              <span className="bf-dash-motor-status">Gestionar en Torneos</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="bf-dash-secondary" aria-label="Módulos secundarios">
        <article className="bf-dash-module">
          <span className="bf-dash-module-icon"><IconDashboard size={20} /></span>
          <div><span className="bf-dash-section-label">Comunidad</span><h3>Discord Bot</h3><p>Base pendiente para notificaciones y comunidad.</p></div>
          <span className="bf-dash-module-state">Configurar luego</span>
        </article>
        <article className="bf-dash-module">
          <span className="bf-dash-module-icon"><IconStream size={20} /></span>
          <div><span className="bf-dash-section-label">Broadcast</span><h3>Stream / Overlays</h3><p>Stream y Caster Hub disponibles para el torneo activo.</p></div>
          <Link href={selectedTournament ? casterHref : streamHref} className="bf-dash-inline-link">{selectedTournament ? "Abrir Caster Hub" : "Abrir Stream"} <IconArrowRight size={15} /></Link>
        </article>
      </section>
    </div>
  );
}
