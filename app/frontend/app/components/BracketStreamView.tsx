"use client";

import BackgroundParticles from "./BackgroundParticles";
import BracketView from "./BracketView";
import type { Match, Team, Tournament } from "../../lib/api";
import type { ResolvedTournamentEngine } from "../../lib/tournamentModel";

type BracketStreamViewProps = {
  tournament: Tournament | null;
  engine: ResolvedTournamentEngine | null;
  teams: Team[];
  matches: Match[];
  connected: boolean;
  obs: boolean;
  transparent: boolean;
  brand: string | null;
};

export default function BracketStreamView({
  tournament,
  engine,
  teams,
  matches,
  connected,
  obs,
  transparent,
  brand,
}: BracketStreamViewProps) {
  const pageClassName = [
    "bf-stream-page",
    "bf-stream-bracket-page",
    obs ? "bf-stream-obs" : "",
    transparent ? "bf-stream-transparent" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main className={pageClassName}>
      {!transparent && <BackgroundParticles variant="graphite" />}

      <div className="bf-stream-stage bf-stream-bracket-stage">
        <header className="bf-stream-topbar">
          <div className="bf-stream-brand">
            <span className="bf-stream-mark">BF</span>
            <div className="bf-stream-brand-copy">
              <h1 className="bf-stream-title">{tournament?.name ?? "BracketFlow"}</h1>
              <p className="bf-stream-game">{tournament?.game ?? "Bracket"}</p>
            </div>
          </div>

          <div className="bf-stream-status">
            <div className="bf-stream-badge">
              <span>
                {matches.length > 0
                  ? "Bracket preparado"
                  : teams.length > 0
                    ? "Llave lista"
                    : "Llave pendiente"}
              </span>
              <strong>{matches.length > 0 ? matches.length : teams.length}</strong>
            </div>
            <div className={`bf-stream-live${connected ? "" : " is-off"}`}>
              <span className="bf-stream-live-dot" />
              {connected ? "Live" : "Reconectando"}
            </div>
          </div>
        </header>

        <BracketView tournament={tournament} engine={engine} teams={teams} matches={matches} mode="stream" />

        {!obs && (
          <footer className="bf-stream-strip">
            <span>
              powered by <strong>BracketFlow</strong>
            </span>
            <span className="bf-stream-brand-slot">{brand ?? "Bracket Stream"}</span>
          </footer>
        )}
      </div>
    </main>
  );
}
