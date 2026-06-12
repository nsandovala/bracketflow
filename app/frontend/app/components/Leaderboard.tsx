import { LeaderboardEntry, TournamentFormat } from "../../lib/api";
import { formatMultiplier, formatPoints, isWorldSeriesFormat } from "../lib/format";

type LeaderboardProps = {
  leaderboard: LeaderboardEntry[];
  tournamentFormat: TournamentFormat;
};

export default function Leaderboard({
  leaderboard,
  tournamentFormat,
}: LeaderboardProps) {
  if (leaderboard.length === 0) {
    return <p className="bf-empty">Todavia no hay leaderboard.</p>;
  }

  return (
    <div className="bf-stack">
      {leaderboard.map((entry, index) => (
        <div key={entry.team_id} className="bf-score-row">
          <div className="bf-score-identity">
            <span className="bf-rank">#{index + 1}</span>
            <strong>{entry.team_name}</strong>
          </div>
          <div className="bf-score-metrics">
            <small>{entry.kills} kills</small>
            {isWorldSeriesFormat(tournamentFormat) ? (
              <>
                <small>x {formatMultiplier(entry.placement_points)}</small>
                <small>{formatPoints(entry.total_points, tournamentFormat)} pts</small>
              </>
            ) : (
              <small>{formatPoints(entry.total_points, tournamentFormat)} pts</small>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
