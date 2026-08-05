import type { Match, Team, Tournament } from "./api";
import type { ResolvedTournamentEngine } from "./tournamentModel";

export type KillRaceCompetitiveState =
  | "POR DISPUTAR"
  | "EN SEMIFINAL"
  | "ESPERANDO RIVAL"
  | "EN FINAL"
  | "ELIMINADO EN SEMIFINAL"
  | "SUBCAMPEÓN"
  | "CAMPEÓN";

export type KillRaceStandingsPlayer = {
  rank: number;
  playerKey: string;
  playerId: number | null;
  nickname: string;
  teamId: number;
  teamName: string;
  confirmedKills: number;
  confirmedMapCount: number;
  averageKills: number | null;
  isMvp: boolean;
  isTiedMvp: boolean;
  mapBreakdown: Array<{ matchId: number; mapNumber: number; kills: number }>;
};

export type KillRaceTeamMapRow = {
  matchId: number;
  phaseLabel: string;
  mapId: number;
  mapNumber: number;
  resultStatus: "pending" | "live" | "provisional" | "confirmed";
  killsFor: number;
  killsAgainst: number;
  outcome: "VICTORIA" | "DERROTA" | "EN REVISIÓN" | "PENDIENTE";
  opponentTeamId: number | null;
  opponentTeamName: string;
};

export type KillRaceTeamSeriesRow = {
  matchId: number;
  phaseLabel: string;
  opponentTeamId: number | null;
  opponentTeamName: string;
  scoreFor: number;
  scoreAgainst: number;
  outcome: "VICTORIA" | "DERROTA" | "PENDIENTE";
  status: string;
};

export type KillRaceStandingsTeam = {
  rank: number;
  teamId: number;
  teamName: string;
  roster: string[];
  confirmedKills: number;
  confirmedMaps: number;
  averageKills: number | null;
  mapsWon: number;
  mapsLost: number;
  seriesPlayed: number;
  seriesWins: number;
  seriesLosses: number;
  gapToLeader: number | null;
  competitiveState: KillRaceCompetitiveState;
  isChampion: boolean;
  isEliminated: boolean;
  playerRows: KillRaceStandingsPlayer[];
  mapRows: KillRaceTeamMapRow[];
  seriesRows: KillRaceTeamSeriesRow[];
};

export type KillRaceStandingsMatch = {
  matchId: number;
  round: number;
  phaseLabel: string;
  bestOf: number;
  status: string;
  leftTeam: Team | null;
  rightTeam: Team | null;
  seriesScore: { left: number; right: number };
  winner: Team | null;
  maps: Array<{
    mapId: number;
    mapNumber: number;
    resultStatus: "pending" | "live" | "provisional" | "confirmed";
    leftKills: number;
    rightKills: number;
    winnerTeamId: number | null;
    playerStats: Array<{
      playerId: number | null;
      nickname: string;
      side: "left" | "right";
      teamId: number | null;
      teamName: string;
      kills: number;
    }>;
  }>;
  isBroadcast: boolean;
};

export type KillRaceStandingsViewModel = {
  summary: {
    tournamentId: number | null;
    tournamentName: string | null;
    tournamentStatus: string | null;
    leader: {
      teamId: number;
      teamName: string;
      confirmedKills: number;
      confirmedMaps: number;
    } | null;
    topPlayers: KillRaceStandingsPlayer[];
    confirmedMapCount: number;
    completedSeriesCount: number;
    totalSeriesCount: number;
    currentPhase: "Por comenzar" | "Semifinales" | "Final" | "Finalizado";
    champion: { teamId: number; teamName: string } | null;
  };
  teamRanking: KillRaceStandingsTeam[];
  playerRanking: KillRaceStandingsPlayer[];
  matchHistory: KillRaceStandingsMatch[];
  bracketSummary: {
    totalMatches: number;
    completedMatches: number;
    openMatches: number;
    finalMatchId: number | null;
    championTeamId: number | null;
  };
  visualKey: string;
};

export const KILL_RACE_STANDINGS_TABS: ReadonlyArray<{
  key: "performance" | "players" | "matches" | "bracket";
  label: string;
}>;

export function buildKillRaceStandings(input?: {
  tournament?: Tournament | null;
  engine?: ResolvedTournamentEngine | null;
  teams?: Team[];
  matches?: Match[];
  broadcastMatchId?: number | null;
}): KillRaceStandingsViewModel;

export function resolveStandingsSurface(
  engine: ResolvedTournamentEngine | null
): "kill-race-detailed" | "bracket" | "standings";
export function toggleStandingsSelection<T>(currentKey: T | null, requestedKey: T): T | null;
export function reconcileStandingsSelection<T>(currentKey: T | null, availableKeys: T[]): T | null;

export type KillRaceStandingsUiState = {
  tournamentId: number | null;
  activeTab: "performance" | "players" | "matches" | "bracket";
  expandedTeamId: number | null;
  expandedPlayerKey: string | null;
};
export function createKillRaceStandingsUiState(
  tournamentId: number | null
): KillRaceStandingsUiState;
export function reconcileKillRaceStandingsUiState(
  current: KillRaceStandingsUiState,
  tournamentId: number | null,
  availableTeamIds: number[],
  availablePlayerKeys: string[]
): KillRaceStandingsUiState;

export function normalizeStandingsPollMs(options?: { pollMs?: number } | null): number | null;
export function runSequentialPollCycle(input: {
  fetchOnce: () => Promise<unknown>;
  isActive: () => boolean;
  schedule: (delayMs: number) => void;
  delayMs: number;
}): Promise<void>;
