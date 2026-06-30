import StandingsTable from "./StandingsTable";
import BracketView from "./BracketView";

import { Team, Tournament } from "../../lib/api";
import { resolveTournamentEngine } from "../../lib/tournamentModel";
import { WorldSeriesStanding } from "../lib/useWorldSeriesPractice";

type WorldSeriesStandingsProps = {
  tournaments: Tournament[];
  selectedTournamentId: number | null;
  selectedTournament: Tournament | null;
  standings: WorldSeriesStanding[];
  afterGameNumber: number;
  totalTeams: number;
  teams: Team[];
  onSelectTournament: (tournamentId: number) => void;
};

export default function WorldSeriesStandings({
  tournaments,
  selectedTournamentId,
  selectedTournament,
  standings,
  afterGameNumber,
  totalTeams,
  teams,
  onSelectTournament,
}: WorldSeriesStandingsProps) {
  const selectedEngine = selectedTournament
    ? resolveTournamentEngine(selectedTournament)
    : null;
  const isBracket = selectedEngine
    ? selectedEngine.scoringProfile === "kill_race" ||
      selectedEngine.tournamentStructure !== "cumulative"
    : false;

  return (
    <main className="bf-shell-standings">
      <section className="bf-standings-toolbar">
        <div>
          <span className="bf-standings-kicker">
            {isBracket ? "Bracket / Resultados" : "Clasificación general"}
          </span>
          <h2>{selectedTournament?.name ?? "Sin torneo activo"}</h2>
          <p>
            {isBracket
              ? totalTeams > 0
                ? "Seed listo. La llave BO3 se construye en el siguiente sprint."
                : "Falta generar bracket. Genera equipos por ruleta para preparar el seed."
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
        {isBracket ? (
          <BracketView
            tournament={selectedTournament}
            engine={selectedEngine}
            teams={teams}
            mode="standings"
          />
        ) : (
          <StandingsTable entries={standings} scoringProfile="wsow_like" />
        )}
      </section>
    </main>
  );
}
