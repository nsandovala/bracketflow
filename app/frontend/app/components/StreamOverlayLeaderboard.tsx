"use client";

import { StreamStanding } from "../lib/useStreamLeaderboard";

// Filas que entran en el safe-area de 1080p para la versión broadcast.
const MAX_ROWS = 16;

type Props = {
  standings: StreamStanding[];
  tournamentName: string | null;
  statusLine: string | null;
  afterGameNumber: number;
  connected: boolean;
  brand: string | null;
};

// Leaderboard broadcast a página completa: versión premium de la tabla del
// stream (rank / equipo / roster / pts / kills / best / partidas).
export default function StreamOverlayLeaderboard({
  standings,
  tournamentName,
  statusLine,
  afterGameNumber,
  connected,
  brand,
}: Props) {
  const visible = standings.slice(0, MAX_ROWS);

  return (
    <div className="bf-ov-board">
      <header className="bf-ov-board-head">
        <div className="bf-ov-board-brand">
          <span className="bf-ov-board-mark">BF</span>
          <div className="bf-ov-board-copy">
            <h1 className="bf-ov-board-title">{tournamentName ?? "BracketFlow"}</h1>
            <p className="bf-ov-board-sub">{statusLine ?? "World Series"}</p>
          </div>
        </div>
        <div className="bf-ov-board-status">
          {afterGameNumber > 0 && (
            <span className="bf-ov-board-game">Tras Partida {afterGameNumber}</span>
          )}
          <span className={`bf-ov-board-live${connected ? "" : " is-off"}`}>
            <span className="bf-ov-board-live-dot" />
            {connected ? "LIVE" : "RECONECTANDO"}
          </span>
        </div>
      </header>

      {visible.length === 0 || afterGameNumber === 0 ? (
        <div className="bf-ov-board-empty">
          <span className="bf-ov-board-empty-kicker">{tournamentName ?? "BracketFlow"}</span>
          <span className="bf-ov-board-empty-title">Esperando Partida 1</span>
        </div>
      ) : (
        <div className="bf-ov-board-table" data-density={visible.length > 10 ? "dense" : "comfortable"}>
          <div className="bf-ov-board-cols">
            <span>#</span>
            <span>Equipo</span>
            <span className="bf-ov-board-num">Pts</span>
            <span className="bf-ov-board-num">Kills</span>
            <span className="bf-ov-board-num">Best</span>
            <span className="bf-ov-board-num">Partidas</span>
          </div>
          <div className="bf-ov-board-rows">
            {visible.map((entry, index) => {
              const rank = index + 1;
              const tier = rank === 1 ? "gold" : rank <= 3 ? "top" : undefined;
              return (
                <div key={entry.team_id} className="bf-ov-board-row" data-tier={tier}>
                  <span className="bf-ov-board-rank">{rank}</span>
                  <div className="bf-ov-board-team">
                    <span className="bf-ov-board-team-name">{entry.team_name}</span>
                    <span className="bf-ov-board-roster">
                      {entry.players.length > 0 ? entry.players.join(" · ") : "Roster pendiente"}
                    </span>
                  </div>
                  <span className="bf-ov-board-pts">{entry.total_points.toFixed(1)}</span>
                  <span className="bf-ov-board-stat">{entry.kills}</span>
                  <span className="bf-ov-board-stat">{entry.best_placement ?? "—"}</span>
                  <span className="bf-ov-board-stat">{entry.matches_played}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <footer className="bf-ov-board-footer">
        <span>
          powered by <strong>BracketFlow</strong>
        </span>
        <span>{brand ?? "Gedeon Esport"}</span>
      </footer>
    </div>
  );
}
