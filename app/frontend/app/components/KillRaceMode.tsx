import { FormEventHandler, RefObject } from "react";

import { LeaderboardEntry, Match, Player, Team, TeamResultDetail } from "../../lib/api";
import {
  formatPoints,
  getKillRaceCounter,
  getKillRaceDrawLabel,
  getKillRaceGroupLabel,
  getKillRaceMissingText,
  getRequiredPlayers,
} from "../../lib/tournamentMode";

import ScoreRow from "./ScoreRow";

type ResultDraft = {
  kills: string;
  placement: string;
};

type KillRaceModeProps = {
  format: "roulette_2v2" | "roulette_3v3";
  players: Player[];
  teams: Team[];
  matches: Match[];
  activeMatch: Match | null;
  activeMatchResults: TeamResultDetail[];
  leaderboard: LeaderboardEntry[];
  playerNickname: string;
  playerFormError: string | null;
  rouletteSeed: string;
  matchRound: string;
  resultDrafts: Record<string, ResultDraft>;
  submitting: boolean;
  playerInputRef: RefObject<HTMLInputElement | null>;
  onPlayerNicknameChange: (value: string) => void;
  onRouletteSeedChange: (value: string) => void;
  onMatchRoundChange: (value: string) => void;
  onCreatePlayer: FormEventHandler<HTMLFormElement>;
  onGenerateRoulette: () => void;
  onCreateRound: FormEventHandler<HTMLFormElement>;
  onSelectMatch: (matchId: number) => void;
  onUpdateDraft: (matchId: number, teamId: number, patch: Partial<ResultDraft>) => void;
  onSaveResults: (matchId: number) => void;
};

function getDraftKey(matchId: number, teamId: number) {
  return `${matchId}:${teamId}`;
}

export default function KillRaceMode({
  format,
  players,
  teams,
  matches,
  activeMatch,
  activeMatchResults,
  leaderboard,
  playerNickname,
  playerFormError,
  rouletteSeed,
  matchRound,
  resultDrafts,
  submitting,
  playerInputRef,
  onPlayerNicknameChange,
  onRouletteSeedChange,
  onMatchRoundChange,
  onCreatePlayer,
  onGenerateRoulette,
  onCreateRound,
  onSelectMatch,
  onUpdateDraft,
  onSaveResults,
}: KillRaceModeProps) {
  const minimumPlayers = getRequiredPlayers(format);
  const missingPlayers = Math.max(minimumPlayers - players.length, 0);
  const readyToDraw = players.length >= minimumPlayers;
  const activeComplete =
    activeMatch !== null && teams.length > 0 && activeMatchResults.length >= teams.length;
  const stage = !readyToDraw
    ? "players"
    : teams.length === 0
      ? "draw"
      : matches.length === 0
        ? "round"
        : !activeComplete
          ? "results"
          : "ranking";

  return (
    <div className="bf-stack">
      <div className="bf-panel-head">
        <div>
          <p className="bf-kicker">Kill Race</p>
          <h2>
            {stage === "players"
              ? "Anadir jugadores"
              : stage === "draw"
                ? getKillRaceDrawLabel(format)
                : stage === "round"
                  ? "Crear ronda"
                  : stage === "results"
                    ? `Cargar kills${activeMatch ? ` · Ronda ${activeMatch.round}` : ""}`
                    : "Ranking"}
          </h2>
        </div>
      </div>

      <p className="bf-rule">
        {"Jugadores -> Sorteo -> "}
        {getKillRaceGroupLabel(format)}
        {" -> Ronda -> Kills -> Ranking."}
      </p>

      <div className="bf-summary-strip">
        <span>{getKillRaceCounter(format, players.length)}</span>
        <span>
          {readyToDraw
            ? `${teams.length} ${getKillRaceGroupLabel(format)} listas`
            : getKillRaceMissingText(format, missingPlayers)}
        </span>
      </div>

      {stage === "players" || stage === "draw" ? (
        <>
          <form className="bf-form bf-form-inline" onSubmit={onCreatePlayer}>
            <label className="bf-field">
              <span>Alias del jugador</span>
              <input
                ref={playerInputRef}
                value={playerNickname}
                onChange={(event) => onPlayerNicknameChange(event.target.value)}
                placeholder="Vito"
              />
            </label>
            <button
              type="submit"
              className={`bf-button ${stage === "players" ? "bf-button-primary" : ""}`}
              disabled={submitting}
            >
              Anadir jugadores
            </button>
          </form>

          {playerFormError ? <p className="bf-inline-error">{playerFormError}</p> : null}

          {players.length > 0 ? (
            <div className="bf-tag-list">
              {players.map((player) => (
                <span key={player.id} className="bf-tag">
                  {player.nickname}
                </span>
              ))}
            </div>
          ) : (
            <p className="bf-empty">Todavia no hay jugadores cargados.</p>
          )}

          {stage === "draw" ? (
            <div className="bf-action-block">
              <label className="bf-field">
                <span>Seed opcional</span>
                <input
                  value={rouletteSeed}
                  onChange={(event) => onRouletteSeedChange(event.target.value)}
                  placeholder="wsow-seed-01"
                />
              </label>
              <button
                type="button"
                className="bf-button bf-button-primary"
                onClick={onGenerateRoulette}
                disabled={submitting}
              >
                {getKillRaceDrawLabel(format)}
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {teams.length > 0 && stage !== "players" && stage !== "draw" ? (
        <div className="bf-team-grid">
          {teams.map((team) => (
            <div key={team.id} className="bf-team-card">
              <div className="bf-team-head">
                <strong>{team.name}</strong>
                <span>{team.members.length} jugadores</span>
              </div>
              <div className="bf-tag-list">
                {team.members.map((member) => (
                  <span key={member.id} className="bf-tag">
                    {member.player.nickname}
                  </span>
                ))}
              </div>
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

              return (
                <div key={team.id} className="bf-result-row">
                  <div className="bf-result-copy">
                    <strong>{team.name}</strong>
                    <span>
                      {saved
                        ? `${saved.kills} kills · ${formatPoints(saved.total_points, format)} pts`
                        : "Placement interno fijo en 1."}
                    </span>
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
                </div>
              );
            })}
          </div>

          <button type="submit" className="bf-button bf-button-primary" disabled={submitting}>
            Guardar resultados de la ronda
          </button>
        </form>
      ) : null}

      {stage === "ranking" ? (
        leaderboard.length > 0 ? (
          <div className="bf-list">
            {leaderboard.map((entry, index) => (
              <ScoreRow
                key={entry.team_id}
                rank={index + 1}
                title={entry.team_name}
                metrics={[
                  `${entry.kills} kills`,
                  `${formatPoints(entry.total_points, format)} pts`,
                ]}
              />
            ))}
          </div>
        ) : (
          <p className="bf-empty">Todavia no hay ranking.</p>
        )
      ) : null}
    </div>
  );
}
