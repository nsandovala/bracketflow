export function createTournamentSwitchState(tournamentId) {
  return {
    loading: true,
    selectedTournamentId: tournamentId,
    selectedTournament: null,
    matchCompletionPolicy: null,
    teams: [],
    matches: [],
    leaderboard: [],
    tournamentResults: [],
    players: [],
    selectedMatchId: null,
    resultDrafts: {},
    killRaceMapDrafts: {},
    message: null,
  };
}
