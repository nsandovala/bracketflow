export type TournamentSwitchState = {
  loading: true;
  selectedTournamentId: number;
  selectedTournament: null;
  matchCompletionPolicy: null;
  teams: [];
  matches: [];
  leaderboard: [];
  tournamentResults: [];
  players: [];
  selectedMatchId: null;
  resultDrafts: Record<string, never>;
  killRaceMapDrafts: Record<string, never>;
  message: null;
};

export function createTournamentSwitchState(
  tournamentId: number
): TournamentSwitchState;
