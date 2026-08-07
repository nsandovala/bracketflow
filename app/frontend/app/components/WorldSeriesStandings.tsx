import StandingsTable from "./StandingsTable";
import BracketView from "./BracketView";
import ContextBar from "./ContextBar";
import KillRaceStandingsDetailed from "./KillRaceStandingsDetailed";

import {
  Match,
  MatchCompletionPolicy,
  Team,
  TeamResultDetail,
  Tournament,
} from "../../lib/api";
import { resolveTournamentEngine } from "../../lib/tournamentModel";
import {
  buildKillRaceStandings,
  resolveStandingsSurface,
} from "../../lib/killRaceStandings.mjs";
import {
  findChampion,
  getMatchPointStatusFromPolicy,
  getMatchPointStatusMessage,
  getTeamRosterText,
  isTournamentCompleted,
} from "../../lib/tournamentStatus";
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
  matchCompletionPolicy: MatchCompletionPolicy | null;
  broadcastMatchId?: number | null;
  results?: TeamResultDetail[];
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
  matchCompletionPolicy,
  broadcastMatchId = null,
  results,
  onSelectTournament,
}: WorldSeriesStandingsProps) {
  const selectedEngine = selectedTournament
    ? resolveTournamentEngine(selectedTournament)
    : null;
  const standingsSurface = resolveStandingsSurface(selectedEngine);
  const isKillRaceDetailed = standingsSurface === "kill-race-detailed";
  const isBracket = standingsSurface === "bracket" || isKillRaceDetailed;
  const killRaceViewModel = isKillRaceDetailed
    ? buildKillRaceStandings({
        tournament: selectedTournament,
        engine: selectedEngine,
        teams,
        matches,
        broadcastMatchId,
      })
    : null;
  const champion = isBracket ? findChampion(matches, teams) : null;
  const isCompleted = isBracket ? isTournamentCompleted(matches) : false;
  const matchPointStatus =
    selectedEngine && !isBracket
      ? getMatchPointStatusFromPolicy({
          policy: matchCompletionPolicy,
          teams,
        })
      : { state: "idle" as const };
  const matchPointMessage = isBracket ? null : getMatchPointStatusMessage(matchPointStatus);
  const matchPointRoster =
    matchPointStatus.state === "champion"
      ? getTeamRosterText(matchPointStatus.champion) || "Roster pendiente"
      : null;

  return (
    <main className="bf-shell-standings">
      <ContextBar
        engineKey={selectedEngine?.engineKey}
        tournamentName={selectedTournament?.name}
        tournamentId={selectedTournament?.id}
        matches={matches}
        teams={teams}
        tournamentStatus={selectedTournament?.status}
        currentView="standings"
      />

      <section className="bf-standings-toolbar">
        <div>
          <span className="bf-standings-kicker">
            {isKillRaceDetailed
              ? "KILL RACE · RENDIMIENTO"
              : isBracket
                ? "Bracket / Resultados"
                : "Clasificación general"}
          </span>
          <h2>
            {isKillRaceDetailed
              ? "RANKING DE RENDIMIENTO"
              : selectedTournament?.name ?? "Sin torneo activo"}
          </h2>
          <p>
            {isKillRaceDetailed
              ? "El ranking refleja rendimiento por kills confirmadas. El avance oficial lo determina el resultado de cada serie."
              : isBracket
              ? isCompleted
                ? `Campeón: ${champion?.displayName ?? "—"} · Serie final ${champion?.finalScore ?? "—"}.`
                : totalTeams > 0
                  ? `${teams.length} equipos sembrados. Bracket listo.`
                  : "Falta generar bracket. Carga participantes y confirma equipos."
              : matchPointMessage
                ? matchPointMessage
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

      {!isBracket && matchPointStatus.state !== "idle" ? (
        <section className={`bf-status-banner ${matchPointStatus.state === "champion" ? "is-success" : "is-warning"}`}>
          <span className="bf-status-banner-kicker">
            {matchPointStatus.state === "champion"
              ? "Campeon por Match Point"
              : matchPointStatus.state === "not_configured"
                ? "Configuración requerida"
                : "Estado Match Point"}
          </span>
          <strong className="bf-status-banner-title">
            {matchPointStatus.state === "champion"
              ? matchPointStatus.championLabel
              : matchPointStatus.state === "not_configured"
                ? "Match Point no configurado"
                : matchPointStatus.state === "threshold_reached"
                  ? "Match Point alcanzado"
                  : matchPointStatus.state === "disabled"
                    ? "Match Point desactivado"
                    : "Motor sin Match Point"}
          </strong>
          <span className="bf-status-banner-sub">
            {matchPointStatus.state === "champion" ? matchPointRoster : matchPointMessage}
          </span>
        </section>
      ) : null}

      <section className="bf-standings-panel">
        {!selectedTournament ? (
          <div className="kr-detailed-empty">
            <span>BRACKETFLOW · ARENA DIGITAL</span>
            <h3>SIN TORNEO SELECCIONADO</h3>
            <p>Selecciona un torneo para consultar sus resultados.</p>
          </div>
        ) : isKillRaceDetailed && selectedEngine && killRaceViewModel ? (
          <KillRaceStandingsDetailed
            key={selectedTournament.id}
            viewModel={killRaceViewModel}
            tournament={selectedTournament}
            engine={selectedEngine}
            teams={teams}
            matches={matches}
          />
        ) : standingsSurface === "bracket" ? (
          <BracketView
            tournament={selectedTournament}
            engine={selectedEngine}
            teams={teams}
            matches={matches}
            mode="standings"
          />
        ) : (
          <StandingsTable entries={standings} scoringProfile="wsow_like" results={results} />
        )}
      </section>
    </main>
  );
}
