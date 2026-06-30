import type { CSSProperties } from "react";

import type { Team, Tournament } from "../../lib/api";
import { buildSingleElimBracket } from "../../lib/bracketDisplay";
import type { ResolvedTournamentEngine } from "../../lib/tournamentModel";

type BracketViewProps = {
  tournament: Tournament | null;
  engine: ResolvedTournamentEngine | null;
  teams: Team[];
  mode: "setup" | "stream" | "operator" | "standings";
};

export default function BracketView({ tournament, engine, teams, mode }: BracketViewProps) {
  const rounds = buildSingleElimBracket(teams, engine?.teamSize ?? 2);
  const hasTeams = teams.length > 0;
  const title = hasTeams ? "Bracket preparado" : "Falta generar bracket";
  const subtitle = hasTeams
    ? `${teams.length} equipos sembrados. Ganadores y BO3 llegan en el siguiente sprint.`
    : "Importa participantes para crear el seed.";

  return (
    <section className={`bf-bracket-view is-${mode}`}>
      <div className="bf-bracket-head">
        <div>
          <span className="opr-eyebrow">{tournament?.name ?? "BracketFlow"}</span>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <span className="bf-bracket-badge">
          {engine?.tournamentStructure === "double_elim" ? "Double elim pendiente" : "Single elim"}
        </span>
      </div>

      {rounds.length === 0 ? (
        <div className="bf-bracket-empty">
          <strong>Seed pendiente</strong>
          <p>Carga participantes y confirma equipos para pintar la llave.</p>
        </div>
      ) : (
        <div
          className="bf-bracket-board"
          style={{ "--rounds": rounds.length } as CSSProperties & Record<"--rounds", number>}
        >
          {rounds.map((round) => (
            <div key={round.title} className="bf-bracket-round">
              <div className="bf-bracket-round-title">{round.title}</div>
              <div className="bf-bracket-match-list">
                {round.matches.map((match) => (
                  <article key={match.id} className="bf-bracket-match">
                    <span className="bf-bracket-match-label">{match.label}</span>
                    <div className="bf-bracket-slot">
                      <strong>{match.left}</strong>
                      {match.leftMeta ? <em>{match.leftMeta}</em> : <em>Ganador pendiente</em>}
                    </div>
                    <div className={`bf-bracket-slot${match.status === "bye" ? " is-bye" : ""}`}>
                      <strong>{match.right}</strong>
                      {match.rightMeta ? <em>{match.rightMeta}</em> : <em>{match.status === "bye" ? "BYE" : "Ganador pendiente"}</em>}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
