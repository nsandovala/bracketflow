import { Match, Team, TeamResultDetail, TournamentFormat } from "../../lib/api";
import { formatMultiplier, formatPoints, isWorldSeriesFormat } from "../lib/format";

type ResultDraft = {
  kills: string;
  placement: string;
};

type ResultsEditorProps = {
  teams: Team[];
  activeBattleRoyaleMatch: Match | null;
  battleRoyaleMatches: Match[];
  selectedMatchId: number | null;
  selectedMatchResults: TeamResultDetail[];
  resultDrafts: Record<string, ResultDraft>;
  submitting: boolean;
  tournamentFormat: TournamentFormat;
  onSelectMatch: (matchId: number) => void;
  onSaveResult: (teamId: number) => void;
  onUpdateDraft: (
    matchId: number,
    teamId: number,
    patch: Partial<ResultDraft>
  ) => void;
};

export default function ResultsEditor({
  teams,
  activeBattleRoyaleMatch,
  battleRoyaleMatches,
  selectedMatchId,
  selectedMatchResults,
  resultDrafts,
  submitting,
  tournamentFormat,
  onSelectMatch,
  onSaveResult,
  onUpdateDraft,
}: ResultsEditorProps) {
  if (teams.length === 0 || activeBattleRoyaleMatch === null) {
    return <p className="bf-empty">Necesitas equipos y una ronda activa.</p>;
  }

  return (
    <>
      <div className="bf-round-switcher">
        {battleRoyaleMatches.map((match) => (
          <button
            key={match.id}
            type="button"
            className={`bf-round-pill ${selectedMatchId === match.id ? "is-active" : ""}`}
            onClick={() => onSelectMatch(match.id)}
          >
            <strong>R{match.round}</strong>
            <span>{match.status}</span>
          </button>
        ))}
      </div>

      <div className="bf-stack">
        {teams.map((team) => {
          const savedResult = selectedMatchResults.find((result) => result.team_id === team.id);
          const draftKey = `${activeBattleRoyaleMatch.id}:${team.id}`;
          const killsValue =
            resultDrafts[draftKey]?.kills ?? (savedResult ? String(savedResult.kills) : "");
          const placementValue =
            resultDrafts[draftKey]?.placement ??
            (savedResult ? String(savedResult.placement) : "");

          return (
            <div key={team.id} className="bf-result-card">
              <div className="bf-result-head">
                <div>
                  <strong>{team.name}</strong>
                  <span>
                    {savedResult
                      ? isWorldSeriesFormat(tournamentFormat)
                        ? `${savedResult.kills} kills x ${formatMultiplier(savedResult.placement_points)} = ${formatPoints(savedResult.total_points, tournamentFormat)} pts`
                        : `${savedResult.kills} kills = ${formatPoints(savedResult.total_points, tournamentFormat)} pts`
                      : "Pendiente"}
                  </span>
                </div>
                <button
                  type="button"
                  className="bf-button bf-button-primary"
                  onClick={() => onSaveResult(team.id)}
                  disabled={submitting}
                >
                  {savedResult ? "Actualizar" : "Guardar"}
                </button>
              </div>
              <div className="bf-form-inline bf-inline-grid">
                <label>
                  Kills
                  <input
                    type="number"
                    min="0"
                    value={killsValue}
                    onChange={(event) =>
                      onUpdateDraft(activeBattleRoyaleMatch.id, team.id, {
                        kills: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Placement
                  <input
                    type="number"
                    min="1"
                    value={placementValue}
                    onChange={(event) =>
                      onUpdateDraft(activeBattleRoyaleMatch.id, team.id, {
                        placement: event.target.value,
                      })
                    }
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
