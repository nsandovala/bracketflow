import { Tournament } from "../../lib/api";
import { WorldSeriesStanding } from "../lib/useWorldSeriesPractice";

import StreamStandingsBoard from "./StreamStandingsBoard";

type WorldSeriesStreamViewProps = {
  tournament: Tournament | null;
  afterGameNumber: number;
  standings: WorldSeriesStanding[];
};

export default function WorldSeriesStreamView({
  tournament,
  afterGameNumber,
  standings,
}: WorldSeriesStreamViewProps) {
  return (
    <main className="bf-stream-page">
      <div className="bf-stream-frame">
        <header className="bf-stream-header">
          <p className="bf-stream-kicker">STANDINGS</p>
          <h1>{tournament?.name ?? "BracketFlow"}</h1>
          <p className="bf-stream-subtitle">{`After Game ${afterGameNumber}`}</p>
        </header>

        <StreamStandingsBoard entries={standings} />
      </div>
    </main>
  );
}
