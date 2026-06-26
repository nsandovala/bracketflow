import StandingsTable from "./StandingsTable";

import { Tournament } from "../../lib/api";
import { WorldSeriesStanding } from "../lib/useWorldSeriesPractice";

type WorldSeriesStandingsProps = {
  tournaments: Tournament[];
  selectedTournamentId: number | null;
  selectedTournament: Tournament | null;
  standings: WorldSeriesStanding[];
  afterGameNumber: number;
  onSelectTournament: (tournamentId: number) => void;
};

export default function WorldSeriesStandings({
  tournaments,
  selectedTournamentId,
  selectedTournament,
  standings,
  afterGameNumber,
  onSelectTournament,
}: WorldSeriesStandingsProps) {
  return (
    <main className="bf-shell-standings">
      <section className="bf-standings-toolbar">
        <div>
          <span className="bf-standings-kicker">Clasificación general</span>
          <h2>{selectedTournament?.name ?? "Sin torneo activo"}</h2>
          <p>
            {afterGameNumber > 0
              ? `Resultados acumulados después de la Partida ${afterGameNumber}.`
              : "Los resultados aparecerán al reportar la primera partida."}
          </p>
        </div>

        <label className="bf-standings-selector">
          <span>Torneo</span>
          <select
            value={selectedTournamentId ?? ""}
            onChange={(event) => onSelectTournament(Number(event.target.value))}
            disabled={tournaments.length === 0}
          >
            {tournaments.map((tournament) => (
              <option key={tournament.id} value={tournament.id}>
                {tournament.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="bf-standings-panel">
        <StandingsTable entries={standings} />
      </section>
    </main>
  );
}
