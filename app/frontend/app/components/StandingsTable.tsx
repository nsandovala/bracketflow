import { WorldSeriesStanding } from "../lib/useWorldSeriesPractice";

type StandingsTableProps = {
  entries: WorldSeriesStanding[];
  scoringProfile: "wsow_like" | "kill_race";
};

export default function StandingsTable({ entries, scoringProfile }: StandingsTableProps) {
  if (entries.length === 0) {
    return (
      <p className="bf-empty">
        {scoringProfile === "kill_race"
          ? "Vista bracket pendiente. Los resultados aparecerán cuando se implemente la llave de eliminación."
          : "Todavia no hay standings."}
      </p>
    );
  }

  if (scoringProfile === "kill_race") {
    return (
      <div className="bf-standings-shell is-kill-race">
        <div className="bf-standings-head">
          <span>#</span>
          <span>Equipo</span>
          <span>Roster</span>
          <span>Kills</span>
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
            <strong className="bf-standings-points">{entry.kills}</strong>
            <span>{entry.matches_played}</span>
          </article>
        ))}
      </div>
    );
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
