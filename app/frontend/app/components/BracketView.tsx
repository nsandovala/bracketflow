import type { CSSProperties } from "react";

import type { Match, Team, Tournament } from "../../lib/api";
import { buildSingleElimBracket } from "../../lib/bracketDisplay";
import type { ResolvedTournamentEngine } from "../../lib/tournamentModel";

type BracketViewProps = {
  tournament: Tournament | null;
  engine: ResolvedTournamentEngine | null;
  teams: Team[];
  matches: Match[];
  mode: "setup" | "stream" | "operator" | "standings";
};

function getEmptyMeta(label: string) {
  if (label.startsWith("Ganador M")) {
    return "Slot futuro";
  }
  if (label === "BYE") {
    return "BYE";
  }
  return "Serie pendiente";
}

export default function BracketView({
  tournament,
  engine,
  teams,
  matches,
  mode,
}: BracketViewProps) {
  const rounds = buildSingleElimBracket(matches, teams, engine?.teamSize ?? 2);
  const hasTeams = teams.length > 0;
  const hasMatches = matches.length > 0;
  const title = hasMatches ? "Bracket" : "Falta generar bracket";
  const subtitle = hasMatches
    ? `${teams.length} equipos sembrados · ${engine?.tournamentStructure === "double_elim" ? "Double elim" : "Single elim"}.`
    : hasTeams
      ? "Los equipos ya existen. Genera la llave para empezar a operar el BO3."
      : "Carga participantes, gira la ruleta y confirma equipos para ver la llave.";

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
          <p>
            {hasTeams
              ? "Los equipos estan listos, pero la llave todavia no fue generada."
              : "Carga participantes y confirma equipos para pintar la llave."}
          </p>
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
                      <em>{match.leftMeta ?? getEmptyMeta(match.left)}</em>
                    </div>
                    <div className={`bf-bracket-slot${match.right === "BYE" ? " is-bye" : ""}`}>
                      <strong>{match.right}</strong>
                      <em>{match.rightMeta ?? getEmptyMeta(match.right)}</em>
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
