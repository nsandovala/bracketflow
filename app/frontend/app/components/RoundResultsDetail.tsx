import { TeamResultDetail, TournamentFormat } from "../../lib/api";
import { formatMultiplier, formatPoints, isWorldSeriesFormat } from "../lib/format";

type RoundResultsDetailProps = {
  sortedRounds: number[];
  roundResults: Record<number, TeamResultDetail[]>;
  tournamentFormat: TournamentFormat;
};

export default function RoundResultsDetail({
  sortedRounds,
  roundResults,
  tournamentFormat,
}: RoundResultsDetailProps) {
  if (sortedRounds.length === 0) {
    return null;
  }

  return (
    <section className="bf-secondary-section">
      <div className="bf-panel">
        <div className="bf-panel-header">
          <div>
            <p className="bf-eyebrow">Detalle</p>
            <h2>Resultados por ronda</h2>
          </div>
        </div>

        <div className="bf-stack">
          {sortedRounds.map((round) => (
            <div key={round} className="bf-round-card">
              <div className="bf-row">
                <strong>Ronda {round}</strong>
                <span>{roundResults[round][0]?.match_status ?? "pending"}</span>
              </div>
              {isWorldSeriesFormat(tournamentFormat) ? (
                <div className="bf-round-table is-world-series">
                  <div className="bf-round-head">Equipo</div>
                  <div className="bf-round-head">Kills</div>
                  <div className="bf-round-head">Place</div>
                  <div className="bf-round-head">Mult</div>
                  <div className="bf-round-head">Total</div>
                  {roundResults[round].map((result) => (
                    <div key={result.id} className="bf-round-row">
                      <strong>{result.team_name}</strong>
                      <span>{result.kills}</span>
                      <span>{result.placement}</span>
                      <span>x {formatMultiplier(result.placement_points)}</span>
                      <span>{formatPoints(result.total_points, tournamentFormat)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bf-round-table is-roulette">
                  <div className="bf-round-head">Equipo</div>
                  <div className="bf-round-head">Kills</div>
                  <div className="bf-round-head">Total</div>
                  {roundResults[round].map((result) => (
                    <div key={result.id} className="bf-round-row">
                      <strong>{result.team_name}</strong>
                      <span>{result.kills}</span>
                      <span>{formatPoints(result.total_points, tournamentFormat)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
