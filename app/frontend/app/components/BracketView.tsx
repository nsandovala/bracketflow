"use client";

import type { ReactNode } from "react";
import {
  Bracket,
  Seed,
  SeedItem,
  type IRenderSeedProps,
} from "react-brackets";

import type { Match, Team, Tournament } from "../../lib/api";
import type { ResolvedTournamentEngine } from "../../lib/tournamentModel";
import {
  type ReactBracketSeed,
  toBracketRounds,
} from "../../lib/toBracketRounds";

type BracketViewProps = {
  tournament: Tournament | null;
  engine: ResolvedTournamentEngine | null;
  teams: Team[];
  matches: Match[];
  mode: "setup" | "stream" | "operator" | "standings";
};

function SeedContent({ seed }: { seed: ReactBracketSeed }) {
  return (
    <div className={`bf-rb-seed bf-rb-seed--${seed.statusTone}`}>
      <header className="bf-rb-seed-head">
        <div className="bf-rb-seed-copy">
          <span className="bf-rb-seed-match">{seed.matchLabel}</span>
          <strong className="bf-rb-seed-format">BO{seed.bestOf}</strong>
        </div>
        <span className={`bf-rb-status bf-rb-status--${seed.statusTone}`}>
          {seed.statusLabel}
        </span>
      </header>

      <div className="bf-rb-team-list">
        {seed.teams.map((team) => (
          <div
            key={team.id}
            className={[
              "bf-rb-team",
              team.isWinner ? "is-winner" : "",
              team.isLoser ? "is-loser" : "",
              team.isFuture || team.isEmpty || team.isBye ? "is-neutral" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className="bf-rb-team-main">
              <div className="bf-rb-team-name-row">
                <span className="bf-rb-team-name">{team.name}</span>
                {team.badge ? <span className="bf-rb-team-badge">{team.badge}</span> : null}
              </div>
              <span className="bf-rb-team-roster">{team.roster}</span>
            </div>

            <div className="bf-rb-team-side">
              {team.score !== null ? <strong className="bf-rb-team-score">{team.score}</strong> : null}
              <span className="bf-rb-team-state">{team.stateLabel}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderSeed(props: IRenderSeedProps) {
  const seed = props.seed as ReactBracketSeed;

  return (
    <Seed
      className="bf-rb-seed-shell"
      mobileBreakpoint={props.breakpoint}
      style={{ padding: "14px 18px" }}
    >
      <SeedItem style={{ background: "transparent", boxShadow: "none" }}>
        <SeedContent seed={seed} />
      </SeedItem>
    </Seed>
  );
}

function renderRoundTitle(title: ReactNode) {
  return <div className="bf-rb-round-title">{title}</div>;
}

export default function BracketView({
  tournament,
  engine,
  teams,
  matches,
  mode,
}: BracketViewProps) {
  const rounds = toBracketRounds(matches, teams, engine?.teamSize ?? 2);
  const hasTeams = teams.length > 0;
  const hasMatches = matches.length > 0;
  const title = hasMatches ? "Bracket" : "Falta generar bracket";
  const subtitle = hasMatches
    ? `${teams.length} equipos sembrados - ${engine?.tournamentStructure === "double_elim" ? "Double elim" : "Single elim"}.`
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
        <div className="bf-bracket-board">
          <Bracket
            rounds={rounds}
            mobileBreakpoint={0}
            bracketClassName="bf-rb-root"
            roundClassName="bf-rb-round"
            roundTitleComponent={renderRoundTitle}
            renderSeedComponent={renderSeed}
          />
        </div>
      )}
    </section>
  );
}
