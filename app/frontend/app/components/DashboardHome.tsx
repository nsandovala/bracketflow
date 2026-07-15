"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { resolveTournamentEngine } from "../../lib/tournamentModel";
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
  running: "En operacion",
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

type NextAction = {
  kicker: string;
  title: string;
  detail: string;
  href: string;
  cta: string;
  tone: "neutral" | "warning" | "success";
};

function getStatusLabel(value: string | null | undefined, fallback = "Sin estado") {
  if (!value) {
    return fallback;
  }

  return STATUS_LABELS[value.toLowerCase()] ?? value;
}

function formatPoints(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatTeamLabel(names: string[]) {
  if (names.length === 0) {
    return "Sin equipos pendientes.";
  }

  if (names.length <= 2) {
    return names.join(" y ");
  }

  return `${names.slice(0, 2).join(", ")} y ${names.length - 2} mas`;
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
    pendingTeams,
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
  const bracketHref = selectedTournamentId
    ? `/operator?tournamentId=${selectedTournamentId}&tab=bracket`
    : "/operator";

  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const stat = (value: number | string) => (loading ? DASH : String(value));
  const tournamentsCount = tournaments.length;
  const playersCount = players.length;
  const top3 = sortedStandings.slice(0, 3);
  const leader = top3[0] ?? null;
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
  const needsRoulette = engine?.rosterPolicy === "roulette" && totalTeams === 0;
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

  const pendingTeamNames = pendingTeams.map((team) => getTeamDisplayName(team));
  const pendingReportsCount = activeMatch ? Math.max(totalTeams - activeMatchResults.length, 0) : 0;
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

    if (engine.primaryView === "bracket") {
      if (matches.length === 0) {
        if (selectedTournament.roster_status === "locked") {
          return "Listo para preparar bracket";
        }
        if (selectedTournament.roster_status === "respin_open") {
          return "Respin de roster abierto";
        }
        return totalTeams > 0 ? "Equipos listos" : "Setup";
      }

      if (matches.some((match) => match.status === "in_progress")) {
        return "Serie en curso";
      }

      if (killRaceCurrentMatch) {
        return "Listo para operar";
      }

      if (matches.some((match) => match.status === "ready")) {
        return "Esperando carga de resultado";
      }

      return "Esperando propagacion";
    }

    if (activeMatch && pendingReportsCount > 0) {
      return "Cargando resultados";
    }

    if (canCreateNextGame && totalTeams > 0) {
      return reportedBattleRoyaleMatches > 0 ? "Listo para siguiente partida" : "Listo para abrir partida";
    }

    if (reportedBattleRoyaleMatches > 0) {
      return "Operacion en curso";
    }

    return totalTeams > 0 ? "Setup listo" : "Setup";
  })();

  const nextAction = (() => {
    if (!backendOnline) {
      return {
        kicker: "Backend",
        title: "Revisar conexion del backend",
        detail: "El Dashboard no debe ocultar este estado: sin backend no hay lectura confiable de torneos, standings ni stream.",
        href: "/torneos",
        cta: "Ir a Torneos",
        tone: "warning",
      } satisfies NextAction;
    }

    if (!selectedTournament) {
      return {
        kicker: "Setup inicial",
        title: "Crear o seleccionar torneo",
        detail: "Todavia no hay un torneo operativo cargado en este cockpit. El siguiente paso real es abrir Torneos y definir el contexto activo.",
        href: "/torneos",
        cta: "Gestionar torneos",
        tone: "neutral",
      } satisfies NextAction;
    }

    if (engine?.rosterPolicy === "roulette" && playersCount === 0) {
      return {
        kicker: "Participantes",
        title: "Cargar pool antes de generar equipos",
        detail: "Este motor depende de ruleta. Sin participantes no hay equipos que operar ni bracket o standings que mostrar.",
        href: operatorHref,
        cta: "Ir a Operator",
        tone: "warning",
      } satisfies NextAction;
    }

    if (totalTeams === 0) {
      return {
        kicker: "Roster",
        title: needsRoulette ? "Generar equipos desde la ruleta" : "Completar roster del torneo",
        detail: needsRoulette
          ? "Ya existe contexto de torneo, pero todavia no hay equipos persistidos. El siguiente paso operativo es generar y confirmar la ruleta."
          : "El torneo existe, pero aun no tiene equipos listos para operar. Completa el roster antes de abrir partidas o bracket.",
        href: operatorHref,
        cta: "Abrir Operator",
        tone: "warning",
      } satisfies NextAction;
    }

    if (selectedTournament.roster_status === "respin_open") {
      return {
        kicker: "Confirmacion",
        title: "Cerrar respin y confirmar equipos",
        detail: "Hay equipos cargados, pero el roster sigue abierto. Antes de avanzar conviene congelar la base operativa para evitar cambios cruzados.",
        href: operatorHref,
        cta: "Confirmar desde Operator",
        tone: "warning",
      } satisfies NextAction;
    }

    if (engine?.primaryView === "bracket") {
      if (matches.length === 0 || selectedTournament.bracket_status === "pending") {
        return {
          kicker: "Bracket",
          title: "Preparar bracket operativo",
          detail: "El roster ya existe, pero todavia no hay llaves generadas. El siguiente paso real es abrir el bracket desde Operator.",
          href: operatorHref,
          cta: "Preparar bracket",
          tone: "neutral",
        } satisfies NextAction;
      }

      if (killRaceCompleted && killRaceChampion) {
        return {
          kicker: "Cierre",
          title: "Torneo completado",
          detail: `El campeon real ya existe: ${killRaceChampion.displayName}. Lo correcto ahora es revisar bracket final, stream y continuidad del siguiente torneo.`,
          href: bracketHref,
          cta: "Ver bracket final",
          tone: "success",
        } satisfies NextAction;
      }

      if (resolvedKillRaceCurrentLabel) {
        return {
          kicker: "Serie actual",
          title: "Cargar resultado de la serie lista",
          detail: `La proxima accion accionable es operar ${resolvedKillRaceCurrentLabel} y persistir su ganador para destrabar la siguiente llave.`,
          href: bracketHref,
          cta: "Operar serie",
          tone: "neutral",
        } satisfies NextAction;
      }

      return {
        kicker: "Bracket",
        title: "Revisar propagacion y series pendientes",
        detail: "No hay una serie jugable visible en este momento. Revisa si el bracket esta esperando ganadores previos o si ya quedo cerrado.",
        href: bracketHref,
        cta: "Abrir bracket",
        tone: "warning",
      } satisfies NextAction;
    }

    if (matchPointStatus.state === "champion") {
      return {
        kicker: "Cierre",
        title: "Torneo completado",
        detail: `La coronacion ya quedo resuelta por Match Point con ${matchPointStatus.championLabel}. El siguiente paso real es comunicar standings y preparar continuidad.`,
        href: standingsHref,
        cta: "Ver standings",
        tone: "success",
      } satisfies NextAction;
    }

    if (matchPointStatus.state === "threshold_reached") {
      return {
        kicker: "Match Point",
        title: "Cerrar la partida activa o resolver el desempate",
        detail: "El umbral ya fue alcanzado. El torneo no debe coronar solo por la tabla parcial: falta terminar la partida completa o destrabar el empate.",
        href: operatorHref,
        cta: "Abrir Operator",
        tone: "warning",
      } satisfies NextAction;
    }

    if (activeMatch && pendingReportsCount > 0) {
      return {
        kicker: "Reportes",
        title: "Cargar resultados pendientes",
        detail: `La partida ${activeMatch.round} sigue incompleta. Faltan reportes de ${formatTeamLabel(pendingTeamNames)}.`,
        href: operatorHref,
        cta: "Cargar resultados",
        tone: "warning",
      } satisfies NextAction;
    }

    if (canCreateNextGame && totalTeams > 0) {
      return {
        kicker: "Siguiente partida",
        title: reportedBattleRoyaleMatches > 0 ? "Abrir la siguiente partida" : "Crear la primera partida",
        detail:
          reportedBattleRoyaleMatches > 0
            ? "La partida actual ya quedo cargada. El siguiente paso real es abrir la proxima partida o revisar standings antes de continuar."
            : "El roster ya esta listo y todavia no hay resultados cargados. El cockpit esta preparado para iniciar la operacion.",
        href: operatorHref,
        cta: "Ir a Operator",
        tone: "neutral",
      } satisfies NextAction;
    }

    return {
      kicker: "Resumen",
      title: "Revisar standings en vivo",
      detail: "El torneo ya tiene resultados reales. Si no vas a abrir una partida nueva todavia, el mejor siguiente paso es validar tabla, lider y contexto competitivo.",
      href: standingsHref,
      cta: "Ver standings",
      tone: "neutral",
    } satisfies NextAction;
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
    router.replace(`/dashboard?tournamentId=${tournamentId}`);
  }

  return (
    <div className="bf-dash bf-dash-v2 bf-dash-shell">
      <section className="bf-dash-active bf-dash-header">
        <div className="bf-dash-active-main bf-dash-header-main">
          <div className="bf-dash-header-topline">
            <span className="bf-dash-section-label">Cockpit operativo</span>
            <span className={`bf-dash-badge${backendOnline ? " is-live" : ""}`}>
              {backendOnline ? "Backend online" : "Backend offline"}
            </span>
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
          <section className={`bf-dash-active bf-dash-next is-${nextAction.tone}`}>
            <div className="bf-dash-active-main bf-dash-next-copy">
              <span className="bf-dash-section-label">{nextAction.kicker}</span>
              <h3 className="bf-dash-next-title">{nextAction.title}</h3>
              <p className="bf-dash-next-detail">{nextAction.detail}</p>
              <div className="bf-dash-next-meta">
                <span>{selectedTournament ? selectedTournament.name : "Sin torneo seleccionado"}</span>
                <span aria-hidden="true">·</span>
                <span>{engine?.primaryView === "bracket" ? "Superficie bracket" : "Superficie standings"}</span>
              </div>
            </div>

            <div className="bf-dash-active-side">
              <Link href={nextAction.href} className="bf-dash-operator-cta">
                {nextAction.cta}
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
                <h3>{isKillRace ? "Bracket y series" : "Top 3 y lectura del torneo"}</h3>
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
            ) : top3.length > 0 ? (
              <div className="bf-dash-podium-list">
                {top3.map((entry, index) => (
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
                    <span className="bf-dash-podium-kills">{entry.kills} K</span>
                    <span className="bf-dash-podio-pts">{formatPoints(entry.total_points)}</span>
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
              <Link href={operatorHref} className="bf-dash-quick-link">
                <span className="bf-dash-quick-icon">
                  <IconOperator size={19} />
                </span>
                <span className="bf-dash-quick-copy">
                  <strong>Ir a Operator</strong>
                  <span>Operacion manual y carga real.</span>
                </span>
              </Link>

              <Link href={standingsHref} className="bf-dash-quick-link">
                <span className="bf-dash-quick-icon">
                  <IconStandings size={19} />
                </span>
                <span className="bf-dash-quick-copy">
                  <strong>Ver Standings</strong>
                  <span>Lectura competitiva y clasificacion.</span>
                </span>
              </Link>

              <Link href={streamHref} className="bf-dash-quick-link">
                <span className="bf-dash-quick-icon">
                  <IconStream size={19} />
                </span>
                <span className="bf-dash-quick-copy">
                  <strong>Abrir Stream</strong>
                  <span>Superficie para casting y OBS.</span>
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
                <span className="bf-dash-section-label">Contexto real</span>
                <h3>Lectura operativa</h3>
              </div>
            </div>

            <div className="bf-dash-context-list">
              <div className="bf-dash-context-row">
                <span className="bf-dash-context-label">Backend</span>
                <strong className={`bf-dash-context-value${backendOnline ? " is-success" : " is-warning"}`}>
                  {backendOnline ? "Online" : "Offline"}
                </strong>
              </div>

              <div className="bf-dash-context-row">
                <span className="bf-dash-context-label">Roster</span>
                <strong className="bf-dash-context-value">{rosterStatusLabel}</strong>
              </div>

              <div className="bf-dash-context-row">
                <span className="bf-dash-context-label">{isKillRace ? "Bracket" : "Partida activa"}</span>
                <strong className="bf-dash-context-value">
                  {isKillRace
                    ? bracketStatusLabel
                    : activeMatch
                      ? `Partida ${activeMatch.round}`
                      : "Sin partida abierta"}
                </strong>
              </div>

              <div className="bf-dash-context-row">
                <span className="bf-dash-context-label">{isKillRace ? "Serie actual" : "Reportes pendientes"}</span>
                <strong className="bf-dash-context-value">
                  {isKillRace
                    ? resolvedKillRaceCurrentLabel ?? "Sin serie jugable"
                    : activeMatch
                      ? `${pendingReportsCount}`
                      : "No aplica"}
                </strong>
              </div>

              <div className="bf-dash-context-row">
                <span className="bf-dash-context-label">{isKillRace ? "BO actual" : "Match Point"}</span>
                <strong className="bf-dash-context-value">
                  {isKillRace
                    ? `BO${engine?.bestOf ?? 3}`
                    : engine?.supportsMatchPoint
                      ? matchPointStatus.state === "champion"
                        ? "Coronado"
                        : `${engine.matchPointThreshold ?? DASH} pts`
                      : "No aplica"}
                </strong>
              </div>
            </div>
          </section>

          <section className="bf-dash-podium-panel">
            <div className="bf-dash-panel-heading">
              <div>
                <span className="bf-dash-section-label">Proximamente</span>
                <h3>Roadmap controlado</h3>
              </div>
            </div>

            <div className="bf-dash-roadmap-list">
              <article className="bf-dash-roadmap-item">
                <strong>Push Mode</strong>
                <span>Automatizacion operativa posterior al core manual.</span>
              </article>
              <article className="bf-dash-roadmap-item">
                <strong>OCR MVP</strong>
                <span>Carga asistida de resultados cuando el flujo base ya este estable.</span>
              </article>
              <article className="bf-dash-roadmap-item">
                <strong>Caster Suite</strong>
                <span>Capas premium para stream sin venderlas como feature terminada hoy.</span>
              </article>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
