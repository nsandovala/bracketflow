import { WorldSeriesStanding } from "../lib/useWorldSeriesPractice";

type StreamStandingsBoardProps = {
  entries: WorldSeriesStanding[];
};

export default function StreamStandingsBoard({ entries }: StreamStandingsBoardProps) {
  if (entries.length === 0) {
    return <p className="bf-stream-empty">No hay standings todavia.</p>;
  }

  const visibleEntries = entries.slice(0, entries.length > 8 ? 16 : 8);

  return (
    <div className="bf-stream-board">
      {visibleEntries.map((entry, index) => (
        <article key={entry.team_id} className="bf-stream-card">
          <div className="bf-stream-card-top">
            <span className="bf-stream-rank">#{index + 1}</span>
            <div className="bf-stream-team-copy">
              <strong>{entry.team_name}</strong>
              <p>{entry.players.length > 0 ? entry.players.join(" / ") : "Roster pendiente"}</p>
            </div>
            <span className="bf-stream-points">{entry.total_points.toFixed(1)}</span>
          </div>
          <div className="bf-stream-meta">
            <span>{entry.kills} kills</span>
            <span>best {entry.best_placement ?? "-"}</span>
            <span>{entry.matches_played} games</span>
          </div>
        </article>
      ))}
    </div>
  );
}
