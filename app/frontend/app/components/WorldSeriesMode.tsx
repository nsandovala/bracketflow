import { FormEventHandler, RefObject } from "react";

import { LeaderboardEntry, Match, Team, TeamResultDetail } from "../../lib/api";
import { estimateWorldSeriesPoints, formatPoints } from "../../lib/tournamentMode";

import ScoreRow from "./ScoreRow";

type ResultDraft = {
  kills: string;
  placement: string;
};

type WorldSeriesModeProps = {
  teams: Team[];
  matches: Match[];
  activeMatch: Match | null;
  activeMatchResults: TeamResultDetail[];
  leaderboard: LeaderboardEntry[];
  teamName: string;
  teamFormError: string | null;
  matchRound: string;
  resultDrafts: Record<string, ResultDraft>;
  submitting: boolean;
  teamInputRef: RefObject<HTMLInputElement | null>;
  onTeamNameChange: (value: string) => void;
  onMatchRoundChange: (value: string) => void;
  onCreateTeam: FormEventHandler<HTMLFormElement>;
  onCreateRound: FormEventHandler<HTMLFormElement>;
  onSelectMatch: (matchId: number) => void;
  onUpdateDraft: (matchId: number, teamId: number, patch: Partial<ResultDraft>) => void;
  onSaveResults: (matchId: number) => void;
};

function getDraftKey(matchId: number, teamId: number) {
  return `${matchId}:${teamId}`;
}

export default function WorldSeriesMode({
  teams,
  matches,
  activeMatch,
  activeMatchResults,
  leaderboard,
  teamName,
  teamFormError,
  matchRound,
  resultDrafts,
  submitting,
  teamInputRef,
  onTeamNameChange,
  onMatchRoundChange,
  onCreateTeam,
  onCreateRound,
  onSelectMatch,
  onUpdateDraft,
  onSaveResults,
}: WorldSeriesModeProps) {
  const activeComplete =
    activeMatch !== null && teams.length > 0 && activeMatchResults.length >= teams.length;
  const pendingTeams = teams.filter(
    (team) => !activeMatchResults.some((result) => result.team_id === team.id)
  );
  const liveLeader = leaderboard[0] ?? null;
  const stage =
    teams.length === 0
      ? "teams"
      : matches.length === 0
        ? "round"
        : !activeComplete
          ? "results"
          : "leaderboard";

  return (
    <div className="bf-stack">
      <div className="bf-panel-head">
        <div>
          <p className="bf-kicker">World Series</p>
          <h2>
            {stage === "teams"
              ? "Anadir equipos"
              : stage === "round"
                ? "Crear ronda"
                : stage === "results"
                  ? `Cargar resultados${activeMatch ? ` · Ronda ${activeMatch.round}` : ""}`
                  : "Leaderboard acumulado"}
          </h2>
        </div>
      </div>

      <p className="bf-rule">1 kill = 1 punto · placement entrega bonus.</p>

      {teams.length > 0 ? (
        <div className="bf-summary-strip">
          <span>{teams.length} equipos cargados</span>
          <span>{matches.length} rondas creadas</span>
          {activeMatch ? <span>Ronda activa {activeMatch.round}</span> : null}
          {pendingTeams.length > 0 ? <span>{pendingTeams.length} pendientes</span> : null}
          {liveLeader ? (
            <span>
              Lider {liveLeader.team_name} ·{" "}
              {formatPoints(liveLeader.total_points, "battle_royale_points")} pts
            </span>
          ) : null}
        </div>
      ) : null}

      {stage === "teams" ? (
        <>
          <form className="bf-form bf-form-inline" onSubmit={onCreateTeam}>
            <label className="bf-field">
              <span>Nombre del equipo</span>
              <input
                ref={teamInputRef}
                value={teamName}
                onChange={(event) => onTeamNameChange(event.target.value)}
                placeholder="Team Alpha"
                required
              />
            </label>
            <button type="submit" className="bf-button bf-button-primary" disabled={submitting}>
              Anadir equipo
            </button>
          </form>
          {teamFormError ? <p className="bf-inline-error">{teamFormError}</p> : null}
        </>
      ) : null}

      {teams.length > 0 ? (
        <div className="bf-list">
          {teams.map((team) => (
            <div key={team.id} className="bf-list-card bf-static-card">
              <strong>{team.name}</strong>
              <span>{team.members.length > 0 ? `${team.members.length} integrantes` : "Equipo listo"}</span>
            </div>
          ))}
        </div>
      ) : null}

      {stage === "round" ? (
        <form className="bf-form bf-form-inline" onSubmit={onCreateRound}>
          <label className="bf-field">
            <span>Numero de ronda</span>
            <input
              type="number"
              min="1"
              value={matchRound}
              onChange={(event) => onMatchRoundChange(event.target.value)}
              required
            />
          </label>
          <button type="submit" className="bf-button bf-button-primary" disabled={submitting}>
            Crear ronda
          </button>
        </form>
      ) : null}

      {stage === "results" && activeMatch ? (
        <form
          className="bf-stack"
          onSubmit={(event) => {
            event.preventDefault();
            onSaveResults(activeMatch.id);
          }}
        >
          {pendingTeams.length > 0 ? (
            <div className="bf-panel-callout">
              <strong>Pendientes de reportar</strong>
              <div className="bf-tag-list">
                {pendingTeams.map((team) => (
                  <span key={team.id} className="bf-tag">
                    {team.name}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {matches.length > 1 ? (
            <div className="bf-round-tabs">
              {matches.map((match) => (
                <button
                  key={match.id}
                  type="button"
                  className={`bf-round-tab ${activeMatch.id === match.id ? "is-selected" : ""}`}
                  onClick={() => onSelectMatch(match.id)}
                >
                  Ronda {match.round}
                </button>
              ))}
            </div>
          ) : null}

          <div className="bf-results-list">
            {teams.map((team) => {
              const saved = activeMatchResults.find((result) => result.team_id === team.id);
              const key = getDraftKey(activeMatch.id, team.id);
              const killsValue = resultDrafts[key]?.kills ?? (saved ? String(saved.kills) : "");
              const placementValue =
                resultDrafts[key]?.placement ?? (saved ? String(saved.placement) : "");
              const estimatedTotal =
                saved?.total_points.toFixed(1) ??
                estimateWorldSeriesPoints(killsValue, placementValue);

              return (
                <div key={team.id} className="bf-result-row bf-result-row-world">
                  <div className="bf-result-copy">
                    <strong>{team.name}</strong>
                    <span>{saved ? "Guardado" : "Pendiente"}</span>
                  </div>
                  <label className="bf-field">
                    <span>Kills</span>
                    <input
                      type="number"
                      min="0"
                      value={killsValue}
                      onChange={(event) =>
                        onUpdateDraft(activeMatch.id, team.id, { kills: event.target.value })
                      }
                    />
                  </label>
                  <label className="bf-field">
                    <span>Placement</span>
                    <input
                      type="number"
                      min="1"
                      value={placementValue}
                      onChange={(event) =>
                        onUpdateDraft(activeMatch.id, team.id, { placement: event.target.value })
                      }
                    />
                  </label>
                  <div className="bf-readonly">
                    <span>Total estimado</span>
                    <strong>{estimatedTotal ? `${estimatedTotal} pts` : "-"}</strong>
                  </div>
                </div>
              );
            })}
          </div>

          <button type="submit" className="bf-button bf-button-primary" disabled={submitting}>
            Guardar resultados de la ronda
          </button>
        </form>
      ) : null}

      {stage === "leaderboard" ? (
        leaderboard.length > 0 ? (
          <div className="bf-list">
            {leaderboard.map((entry, index) => (
              <ScoreRow
                key={entry.team_id}
                rank={index + 1}
                title={entry.team_name}
                metrics={[
                  `${formatPoints(entry.total_points, "battle_royale_points")} pts`,
                  `${entry.kills} kills`,
                  `best ${entry.best_placement ?? "-"}`,
                  `${entry.matches_played} ronda${entry.matches_played === 1 ? "" : "s"}`,
                ]}
              />
            ))}
          </div>
        ) : (
          <p className="bf-empty">Todavia no hay leaderboard.</p>
        )
      ) : null}
    </div>
  );
}
