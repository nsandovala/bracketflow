import { WorldSeriesStanding } from "../lib/useWorldSeriesPractice";

type StandingsTableProps = {
  entries: WorldSeriesStanding[];
};

export default function StandingsTable({ entries }: StandingsTableProps) {
  if (entries.length === 0) {
    return <p className="bf-empty">Todavia no hay standings.</p>;
  }

  return (
    <div className="bf-standings-shell">
      <div className="bf-standings-head">
        <span>#</span>
        <span>Equipo</span>
        <span>Roster</span>
        <span>Puntos</span>
        <span>Kills</span>
        <span>Best Place</span>
        <span>Partidas</span>
      </div>

      {entries.map((entry, index) => (
        <article
          key={entry.team_id}
          className="bf-standings-row"
          data-rank={index + 1}
        >
          <span className="bf-standings-rank">#{index + 1}</span>
          <strong className="bf-standings-name">{entry.team_name}</strong>
          <span className="bf-standings-roster">
            {entry.players.length > 0 ? entry.players.join(" / ") : "Roster pendiente"}
          </span>
          <strong className="bf-standings-points">{entry.total_points.toFixed(1)}</strong>
          <span>{entry.kills}</span>
          <span>{entry.best_placement ?? "-"}</span>
          <span>{entry.matches_played}</span>
        </article>
      ))}
    </div>
  );
}
