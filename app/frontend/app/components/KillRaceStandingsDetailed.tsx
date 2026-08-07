"use client";

import { Fragment, useState } from "react";

import type { Match, Team, Tournament } from "../../lib/api";
import {
  KILL_RACE_STANDINGS_TABS,
  createKillRaceStandingsUiState,
  reconcileKillRaceStandingsUiState,
  toggleStandingsSelection,
  type KillRaceStandingsMatch,
  type KillRaceStandingsPlayer,
  type KillRaceStandingsTeam,
  type KillRaceStandingsViewModel,
} from "../../lib/killRaceStandings.mjs";
import type { ResolvedTournamentEngine } from "../../lib/tournamentModel";
import BracketView from "./BracketView";

type Props = {
  viewModel: KillRaceStandingsViewModel;
  tournament: Tournament;
  engine: ResolvedTournamentEngine;
  teams: Team[];
  matches: Match[];
};

function formatAverage(value: number | null) {
  if (value === null) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function stateTone(state: KillRaceStandingsTeam["competitiveState"]) {
  if (state === "CAMPEÓN") return "champion";
  if (state === "EN FINAL" || state === "EN SEMIFINAL" || state === "ESPERANDO RIVAL") {
    return "alive";
  }
  if (state === "SUBCAMPEÓN" || state === "ELIMINADO EN SEMIFINAL") return "out";
  return "pending";
}

function EmptyState({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="kr-detailed-empty">
      <span>BRACKETFLOW · ARENA DIGITAL</span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

function Summary({ viewModel }: { viewModel: KillRaceStandingsViewModel }) {
  const { summary } = viewModel;
  const topNames = summary.topPlayers.map((player) => player.nickname).join(" / ");
  const topKills = summary.topPlayers[0]?.confirmedKills ?? null;
  return (
    <section className="kr-detailed-summary" aria-label="Resumen Kill Race">
      <article className="kr-detailed-summary-leader">
        <span>LÍDER EN KILLS</span>
        <strong>{summary.leader?.teamName ?? "Sin datos confirmados"}</strong>
        <p>
          {summary.leader
            ? `${summary.leader.confirmedKills} K · ${summary.leader.confirmedMaps} mapas`
            : "Esperando el primer mapa"}
        </p>
      </article>
      <article>
        <span>{summary.topPlayers.length > 1 ? "MVP EMPATADO" : "TOP PLAYER"}</span>
        <strong>{topNames || "Sin desglose individual"}</strong>
        <p>{topKills === null ? "Player stats pendientes" : `${topKills} K confirmadas`}</p>
      </article>
      <article>
        <span>SERIES</span>
        <strong>
          {summary.completedSeriesCount} / {summary.totalSeriesCount}
        </strong>
        <p>completadas</p>
      </article>
      <article className={summary.champion ? "is-champion" : ""}>
        <span>ESTADO</span>
        <strong>{summary.champion ? `Campeón: ${summary.champion.teamName}` : summary.currentPhase}</strong>
        <p>{summary.confirmedMapCount} mapas confirmados</p>
      </article>
    </section>
  );
}

function TeamDetail({ team }: { team: KillRaceStandingsTeam }) {
  return (
    <div className="kr-detailed-team-detail" id={`kr-team-detail-${team.teamId}`}>
      <section>
        <header><span>A</span><strong>JUGADORES</strong></header>
        {team.playerRows.length === 0 ? (
          <p className="kr-detailed-muted">Sin desglose individual confirmado.</p>
        ) : (
          <div className="kr-detailed-mini-table">
            <div className="is-head"><span>Jugador</span><span>Kills</span><span>Mapas</span><span>Prom.</span></div>
            {team.playerRows.map((player) => (
              <div key={player.playerKey}>
                <strong>{player.nickname}</strong>
                <span>{player.confirmedKills}</span>
                <span>{player.confirmedMapCount}</span>
                <span>{formatAverage(player.averageKills)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
      <section>
        <header><span>B</span><strong>MAPAS</strong></header>
        {team.mapRows.length === 0 ? (
          <p className="kr-detailed-muted">Sin mapas reportados.</p>
        ) : (
          <div className="kr-detailed-compact-list">
            {team.mapRows.map((map) => (
              <div key={`${map.matchId}:${map.mapId}`} className={map.resultStatus === "provisional" ? "is-review" : ""}>
                <p><strong>Match {map.matchId} · Mapa {map.mapNumber}</strong><span>{map.opponentTeamName}</span></p>
                <p>
                  <strong>{map.resultStatus === "provisional" ? "Provisional" : `${map.killsFor}–${map.killsAgainst}`}</strong>
                  <span>{map.outcome === "EN REVISIÓN" ? "En revisión" : map.outcome}</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
      <section>
        <header><span>C</span><strong>RECORRIDO</strong></header>
        {team.seriesRows.length === 0 ? (
          <p className="kr-detailed-muted">La serie inicial está por disputar.</p>
        ) : (
          <div className="kr-detailed-compact-list is-route">
            {team.seriesRows.map((series) => (
              <div key={series.matchId}>
                <p><strong>{series.phaseLabel}</strong><span>vs. {series.opponentTeamName}</span></p>
                <p>
                  <strong>{series.outcome === "PENDIENTE" ? "Pendiente" : `${series.scoreFor}–${series.scoreAgainst}`}</strong>
                  <span>{series.outcome}</span>
                </p>
              </div>
            ))}
            <p className={`kr-detailed-route-state is-${stateTone(team.competitiveState)}`}>{team.competitiveState}</p>
          </div>
        )}
      </section>
    </div>
  );
}

function PerformanceTab({
  viewModel,
  expandedTeamId,
  onToggle,
}: {
  viewModel: KillRaceStandingsViewModel;
  expandedTeamId: number | null;
  onToggle: (teamId: number) => void;
}) {
  if (viewModel.summary.confirmedMapCount === 0) {
    return (
      <EmptyState title="TORNEO PREPARADO">
        Los rankings aparecerán al confirmar el primer mapa.
      </EmptyState>
    );
  }
  return (
    <div className="kr-detailed-ranking" aria-label="Ranking de rendimiento por equipo">
      <div className="kr-detailed-team-head" aria-hidden="true">
        <span>#</span><span>EQUIPO</span><span>KILLS</span><span>MAPAS</span><span>PROMEDIO</span><span>SERIES</span><span>DIF.</span><span>ESTADO</span>
      </div>
      {viewModel.teamRanking.map((team) => {
        const expanded = expandedTeamId === team.teamId;
        return (
          <Fragment key={team.teamId}>
            <button
              type="button"
              className={`kr-detailed-team-row${expanded ? " is-expanded" : ""}${team.isChampion ? " is-champion" : ""}`}
              aria-expanded={expanded}
              aria-controls={`kr-team-detail-${team.teamId}`}
              onClick={() => onToggle(team.teamId)}
            >
              <span className="kr-detailed-rank">#{team.rank}</span>
              <span className="kr-detailed-team-name"><strong>{team.teamName}</strong><small>{team.roster.join(" / ") || "Roster pendiente"}</small></span>
              <strong className="kr-detailed-kills">{team.confirmedKills}</strong>
              <span className="kr-col-maps">{team.confirmedMaps}</span>
              <span className="kr-col-average">{formatAverage(team.averageKills)}</span>
              <span className="kr-col-series">{team.seriesWins}–{team.seriesLosses}</span>
              <span className="kr-col-gap">{team.gapToLeader === null ? "Líder" : `${team.gapToLeader} K`}</span>
              <span className={`kr-detailed-state is-${stateTone(team.competitiveState)}`}>{team.competitiveState}</span>
            </button>
            {expanded ? <TeamDetail team={team} /> : null}
          </Fragment>
        );
      })}
    </div>
  );
}

function PlayerDetail({ player }: { player: KillRaceStandingsPlayer }) {
  return (
    <div className="kr-detailed-player-detail" id={`kr-player-detail-${player.playerKey.replace(/[^a-z0-9_-]/gi, "-")}`}>
      <span>DESGLOSE CONFIRMADO</span>
      {player.mapBreakdown.map((map) => (
        <p key={`${map.matchId}:${map.mapNumber}`}>
          <strong>Match {map.matchId} · Mapa {map.mapNumber}</strong>
          <span>{map.kills} K</span>
        </p>
      ))}
    </div>
  );
}

function PlayersTab({
  viewModel,
  expandedPlayerKey,
  onToggle,
}: {
  viewModel: KillRaceStandingsViewModel;
  expandedPlayerKey: string | null;
  onToggle: (key: string) => void;
}) {
  if (viewModel.playerRanking.length === 0) {
    return (
      <EmptyState title="SIN DESGLOSE INDIVIDUAL">
        No existen estadísticas individuales confirmadas. El ranking de equipos sigue disponible.
      </EmptyState>
    );
  }
  return (
    <div className="kr-detailed-player-ranking">
      <div className="kr-detailed-player-head" aria-hidden="true">
        <span>#</span><span>JUGADOR</span><span>EQUIPO</span><span>KILLS</span><span>MAPAS REPORTADOS</span><span>PROMEDIO</span><span>ESTADO</span>
      </div>
      {viewModel.playerRanking.map((player) => {
        const expanded = expandedPlayerKey === player.playerKey;
        const panelId = `kr-player-detail-${player.playerKey.replace(/[^a-z0-9_-]/gi, "-")}`;
        return (
          <Fragment key={player.playerKey}>
            <button
              type="button"
              className={`kr-detailed-player-row${expanded ? " is-expanded" : ""}`}
              aria-expanded={expanded}
              aria-controls={panelId}
              onClick={() => onToggle(player.playerKey)}
            >
              <span className="kr-detailed-rank">#{player.rank}</span>
              <strong>{player.nickname}</strong>
              <span>{player.teamName}</span>
              <strong className="kr-detailed-kills">{player.confirmedKills}</strong>
              <span>{player.confirmedMapCount}</span>
              <span>{formatAverage(player.averageKills)}</span>
              <span className={player.isMvp ? "kr-detailed-mvp" : ""}>{player.isMvp ? (player.isTiedMvp ? "MVP EMPATADO" : "MVP") : "—"}</span>
            </button>
            {expanded ? <PlayerDetail player={player} /> : null}
          </Fragment>
        );
      })}
    </div>
  );
}

function seriesStatus(match: KillRaceStandingsMatch) {
  if (match.winner) return "Completada";
  if (!match.leftTeam || !match.rightTeam) return "Esperando ganador anterior";
  if (match.maps.some((map) => map.resultStatus === "provisional")) return "En revisión";
  if (match.status === "in_progress" || match.maps.some((map) => map.resultStatus === "live")) return "En curso";
  return "Por disputar";
}

function MatchCard({ match }: { match: KillRaceStandingsMatch }) {
  const status = seriesStatus(match);
  const visibleMaps = match.maps.filter((map) => map.resultStatus === "confirmed" || map.resultStatus === "provisional");
  return (
    <article className={`kr-detailed-match${match.isBroadcast ? " is-broadcast" : ""}`}>
      <header>
        <span>Match {match.matchId} · BO{match.bestOf}</span>
        <strong>{status}</strong>
      </header>
      <div className="kr-detailed-matchup">
        <span>{match.leftTeam?.name ?? "Por definir"}</span>
        <strong>{match.seriesScore.left}<i>—</i>{match.seriesScore.right}</strong>
        <span>{match.rightTeam?.name ?? "Por definir"}</span>
      </div>
      {match.winner ? <p className="kr-detailed-match-winner">Ganador · {match.winner.name}</p> : null}
      {visibleMaps.length > 0 ? (
        <div className="kr-detailed-match-maps">
          {visibleMaps.map((map) => (
            <div key={map.mapId} className={map.resultStatus === "provisional" ? "is-review" : ""}>
              <span>MAPA {map.mapNumber}</span>
              <strong>{map.leftKills}–{map.rightKills}</strong>
              <small>{map.resultStatus === "provisional" ? "PROVISIONAL · Pendiente de confirmación" : "Confirmado"}</small>
            </div>
          ))}
        </div>
      ) : <p className="kr-detailed-muted">Sin mapas reportados.</p>}
    </article>
  );
}

function MatchesTab({ viewModel }: { viewModel: KillRaceStandingsViewModel }) {
  if (viewModel.matchHistory.length === 0) {
    return <EmptyState title="EQUIPOS LISTOS">Genera el bracket para comenzar el torneo.</EmptyState>;
  }
  const phases = [...new Set(viewModel.matchHistory.map((match) => match.phaseLabel))];
  return (
    <div className="kr-detailed-match-history">
      {phases.map((phase) => (
        <section key={phase}>
          <header className="kr-detailed-phase"><span>{phase.toUpperCase()}</span><i /></header>
          <div className="kr-detailed-match-grid">
            {viewModel.matchHistory.filter((match) => match.phaseLabel === phase).map((match) => <MatchCard key={match.matchId} match={match} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function KillRaceStandingsDetailed({
  viewModel,
  tournament,
  engine,
  teams,
  matches,
}: Props) {
  const [ui, setUi] = useState(() => createKillRaceStandingsUiState(tournament.id));
  const reconciledUi = reconcileKillRaceStandingsUiState(
    ui,
    tournament.id,
    viewModel.teamRanking.map((team) => team.teamId),
    viewModel.playerRanking.map((player) => player.playerKey)
  );
  if (reconciledUi !== ui) setUi(reconciledUi);

  if (teams.length === 0) {
    return <EmptyState title="AÚN NO HAY EQUIPOS">Confirma los equipos para preparar la llave.</EmptyState>;
  }
  if (matches.length === 0) {
    return <EmptyState title="EQUIPOS LISTOS">Genera el bracket para comenzar el torneo.</EmptyState>;
  }

  return (
    <div className="kr-detailed" data-visual-key={viewModel.visualKey}>
      <Summary viewModel={viewModel} />
      <div className="kr-detailed-tabs" role="tablist" aria-label="Secciones de Kill Race Standings">
        {KILL_RACE_STANDINGS_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`kr-standings-tab-${tab.key}`}
            aria-selected={ui.activeTab === tab.key}
            aria-controls={`kr-standings-panel-${tab.key}`}
            tabIndex={ui.activeTab === tab.key ? 0 : -1}
            onClick={() => setUi((current) => ({ ...current, activeTab: tab.key }))}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <section
        className="kr-detailed-panel"
        role="tabpanel"
        id={`kr-standings-panel-${ui.activeTab}`}
        aria-labelledby={`kr-standings-tab-${ui.activeTab}`}
      >
        {ui.activeTab === "performance" ? (
          <PerformanceTab
            viewModel={viewModel}
            expandedTeamId={ui.expandedTeamId}
            onToggle={(teamId) => setUi((current) => ({ ...current, expandedTeamId: toggleStandingsSelection(current.expandedTeamId, teamId) }))}
          />
        ) : null}
        {ui.activeTab === "players" ? (
          <PlayersTab
            viewModel={viewModel}
            expandedPlayerKey={ui.expandedPlayerKey}
            onToggle={(playerKey) => setUi((current) => ({ ...current, expandedPlayerKey: toggleStandingsSelection(current.expandedPlayerKey, playerKey) }))}
          />
        ) : null}
        {ui.activeTab === "matches" ? <MatchesTab viewModel={viewModel} /> : null}
        {ui.activeTab === "bracket" ? (
          <BracketView tournament={tournament} engine={engine} teams={teams} matches={matches} mode="standings" />
        ) : null}
      </section>
    </div>
  );
}
