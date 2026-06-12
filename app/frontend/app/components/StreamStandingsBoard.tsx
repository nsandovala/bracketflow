"use client";

import { StreamStanding } from "../lib/useStreamLeaderboard";

type StreamStandingsBoardProps = {
  entries: StreamStanding[];
  tournamentName: string | null;
  afterGameNumber: number;
  obs: boolean;
};

// Cuantas filas se muestran en OBS (las que entran en el safe-area de 1080p).
const OBS_MAX_ROWS = 14;
// A partir de aqui (fuera de OBS) el board habilita scroll interno sin scrollbar.
const SCROLL_THRESHOLD = 16;

function formatPoints(value: number) {
  return value.toFixed(1);
}

export default function StreamStandingsBoard({
  entries,
  tournamentName,
  afterGameNumber,
  obs,
}: StreamStandingsBoardProps) {
  const visible = obs ? entries.slice(0, OBS_MAX_ROWS) : entries;

  // Estado vacio / pre-show: sin games reportados todavia.
  if (afterGameNumber === 0 || visible.length === 0) {
    return (
      <div className="bf-stream-board is-empty">
        <div className="bf-stream-empty">
          <span className="bf-stream-empty-kicker">{tournamentName ?? "BracketFlow"}</span>
          <h2 className="bf-stream-empty-title">Esperando Game 1</h2>
          <span className="bf-stream-empty-sub">El leaderboard aparecera al cargar el primer reporte.</span>
        </div>
      </div>
    );
  }

  const density = visible.length > 10 ? "dense" : "comfortable";
  const isScroll = !obs && entries.length > SCROLL_THRESHOLD;
  const boardClassName = ["bf-stream-board", isScroll ? "is-scroll" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={boardClassName} data-density={density}>
      <div className="bf-stream-head">
        <span>#</span>
        <span>Equipo</span>
        <span className="bf-stream-num">Pts</span>
        <span className="bf-stream-num">Kills</span>
        <span className="bf-stream-num">Best</span>
        <span className="bf-stream-num">Games</span>
      </div>

      <div className="bf-stream-rows">
        {visible.map((entry, index) => {
          const rank = index + 1;
          return (
            <div
              key={entry.team_id}
              className="bf-stream-row"
              data-rank={rank <= 3 ? rank : undefined}
            >
              <div className="bf-stream-row-inner">
                <div className="bf-stream-rk">
                  <span className="bf-stream-rk-num">{rank}</span>
                </div>

                <div className="bf-stream-team">
                  <span className="bf-stream-team-name">{entry.team_name}</span>
                  <span className="bf-stream-roster">
                    {entry.players.length > 0 ? entry.players.join(" · ") : "Roster pendiente"}
                  </span>
                </div>

                <span className="bf-stream-pts">{formatPoints(entry.total_points)}</span>
                <span className="bf-stream-stat">{entry.kills}</span>
                <span className="bf-stream-stat">{entry.best_placement ?? "—"}</span>
                <span className="bf-stream-stat">{entry.matches_played}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
