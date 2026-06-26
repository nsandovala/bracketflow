import StandingsTable from "./StandingsTable";

import { Tournament } from "../../lib/api";
import { resolveTournamentEngine } from "../../lib/tournamentModel";
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
  const selectedEngine = selectedTournament
    ? resolveTournamentEngine(selectedTournament)
    : null;
  const isKillRace = selectedEngine?.scoringProfile === "kill_race";

  return (
    <main className="bf-shell-standings">
      <section className="bf-standings-toolbar">
        <div>
          <span className="bf-standings-kicker">
            {isKillRace ? "Bracket / Resultados" : "Clasificación general"}
          </span>
          <h2>{selectedTournament?.name ?? "Sin torneo activo"}</h2>
          <p>
            {isKillRace
              ? standings.length > 0
                ? "Kill Race se resolverá por llaves. La tabla actual es solo resumen temporal por kills."
                : "Vista bracket pendiente. Los resultados aparecerán cuando se implemente la llave de eliminación."
              : afterGameNumber > 0
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
        <StandingsTable
          entries={standings}
          scoringProfile={isKillRace ? "kill_race" : "wsow_like"}
        />
      </section>
    </main>
  );
}
