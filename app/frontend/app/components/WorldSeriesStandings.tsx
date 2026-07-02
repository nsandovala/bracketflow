import StandingsTable from "./StandingsTable";
import BracketView from "./BracketView";
import ContextBar from "./ContextBar";

import { Match, Team, Tournament } from "../../lib/api";
import { resolveTournamentEngine } from "../../lib/tournamentModel";
import { findChampion, isTournamentCompleted } from "../../lib/tournamentStatus";
import { WorldSeriesStanding } from "../lib/useWorldSeriesPractice";

type WorldSeriesStandingsProps = {
  tournaments: Tournament[];
  selectedTournamentId: number | null;
  selectedTournament: Tournament | null;
  standings: WorldSeriesStanding[];
  afterGameNumber: number;
  totalTeams: number;
  teams: Team[];
  matches: Match[];
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
  matches,
  onSelectTournament,
}: WorldSeriesStandingsProps) {
  const selectedEngine = selectedTournament
    ? resolveTournamentEngine(selectedTournament)
    : null;
  const isBracket = selectedEngine
    ? selectedEngine.scoringProfile === "kill_race" ||
      selectedEngine.tournamentStructure !== "cumulative"
    : false;
  const champion = isBracket ? findChampion(matches, teams) : null;
  const isCompleted = isBracket ? isTournamentCompleted(matches) : false;

  return (
    <main className="bf-shell-standings">
      <ContextBar
        engineKey={selectedEngine?.engineKey}
        tournamentName={selectedTournament?.name}
        tournamentId={selectedTournament?.id}
        matches={matches}
        teams={teams}
        tournamentStatus={selectedTournament?.status}
      />

      <section className="bf-standings-toolbar">
        <div>
          <span className="bf-standings-kicker">
            {isBracket ? "Bracket / Resultados" : "Clasificación general"}
          </span>
          <h2>{selectedTournament?.name ?? "Sin torneo activo"}</h2>
          <p>
            {isBracket
              ? isCompleted
                ? `Campeón: ${champion?.team.name ?? "—"} · Serie final ${champion?.finalScore ?? "—"}.`
                : totalTeams > 0
                  ? `${teams.length} equipos sembrados. Bracket listo.`
                  : "Falta generar bracket. Carga participantes y confirma equipos."
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
            matches={matches}
            mode="standings"
          />
        ) : (
          <StandingsTable entries={standings} scoringProfile="wsow_like" />
        )}
      </section>
    </main>
  );
}
