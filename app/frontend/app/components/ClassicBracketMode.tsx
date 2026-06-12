import { FormEventHandler, RefObject } from "react";

import { Match, Team } from "../../lib/api";

type ClassicBracketModeProps = {
  teams: Team[];
  matches: Match[];
  teamName: string;
  teamFormError: string | null;
  submitting: boolean;
  teamInputRef: RefObject<HTMLInputElement | null>;
  onTeamNameChange: (value: string) => void;
  onCreateTeam: FormEventHandler<HTMLFormElement>;
  onGenerateBracket: () => void;
};

function getMatchLabel(teamId: number | null, teams: Team[]) {
  if (teamId === null) {
    return "Pendiente";
  }

  return teams.find((team) => team.id === teamId)?.name ?? `Equipo ${teamId}`;
}

export default function ClassicBracketMode({
  teams,
  matches,
  teamName,
  teamFormError,
  submitting,
  teamInputRef,
  onTeamNameChange,
  onCreateTeam,
  onGenerateBracket,
}: ClassicBracketModeProps) {
  const stage = teams.length === 0 ? "teams" : matches.length === 0 ? "bracket" : "matches";

  return (
    <div className="bf-stack">
      <div className="bf-panel-head">
        <div>
          <p className="bf-kicker">Classic Bracket</p>
          <h2>
            {stage === "teams"
              ? "Cargar equipos"
              : stage === "bracket"
                ? "Generar bracket"
                : "Cruces activos"}
          </h2>
        </div>
      </div>

      <p className="bf-rule">{"Equipos -> Generar bracket -> Cruces -> Ganador."}</p>

      {teams.length > 0 ? (
        <div className="bf-summary-strip">
          <span>{teams.length} equipos cargados</span>
          {matches.length > 0 ? <span>{matches.length} cruces generados</span> : null}
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

      {stage === "bracket" ? (
        <button
          type="button"
          className="bf-button bf-button-primary"
          onClick={onGenerateBracket}
          disabled={submitting}
        >
          Generar bracket
        </button>
      ) : null}

      {stage === "matches" ? (
        <div className="bf-bracket-list">
          {matches.map((match) => (
            <div key={match.id} className="bf-bracket-match">
              <span className="bf-bracket-round">Ronda {match.round}</span>
              <strong>
                {getMatchLabel(match.team_a_id, teams)} vs {getMatchLabel(match.team_b_id, teams)}
              </strong>
              <span>
                {match.winner_id
                  ? `Avanza ${getMatchLabel(match.winner_id, teams)}`
                  : "Ganador pendiente"}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
