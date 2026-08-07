import type { Match, Team, Tournament } from "./api";

export type KillRaceAwardPlayer = {
  key: string;
  playerId: number | null;
  nickname: string;
  normalizedNickname: string;
  teamId: number | null;
  teamName: string;
  confirmedKills: number;
  confirmedMaps: number;
  averageKills: number;
  rank: number;
  isMvp: boolean;
  isTiedMvp: boolean;
};

export type KillRaceMvpOverlayViewModel = {
  state: "no-tournament" | "no-match" | "waiting" | "no-player-stats" | "ready";
  tournamentId: number | null;
  tournamentName: string | null;
  requestedMatchId: number | null;
  matchId: number | null;
  matchStatus: string | null;
  scope: "map" | "series" | "tournament" | null;
  title: string;
  contextLabel: string;
  mapNumber: number | null;
  seriesScore: { left: number; right: number } | null;
  confirmedMapCount: number;
  hasConfirmedTeamResults: boolean;
  ranking: KillRaceAwardPlayer[];
  leaders: KillRaceAwardPlayer[];
  isTied: boolean;
  message: string;
  visualKey: string;
};

export type KillRaceChampionTeam = {
  id: number;
  name: string;
  roster: string[];
};

export type KillRaceChampionOverlayViewModel = {
  state: "no-tournament" | "pending" | "ready";
  tournamentId: number | null;
  tournamentName: string | null;
  finalMatchId: number | null;
  finalStatus: string | null;
  champion: KillRaceChampionTeam | null;
  finalist: KillRaceChampionTeam | null;
  finalScore: {
    left: number;
    right: number;
    champion: number;
    finalist: number;
  } | null;
  bestOf: number | null;
  seriesWins: number;
  confirmedKills: number;
  message: string;
  visualKey: string;
};

export function normalizeKillRacePlayerName(value: unknown): string;
export function getKillRacePlayerKey(
  teamId: number | null,
  player: { player_id?: number | null; playerId?: number | null; player_name?: string; nickname?: string }
): string;
export function getConfirmedKillRaceMaps(matches?: Match[]): Array<{
  match: Match;
  map: Match["maps"][number];
  key: string;
}>;
export function resolveKillRaceFinalMatch(matches?: Match[]): Match | null;
export function resolveKillRaceChampionTeam(input?: { matches?: Match[]; teams?: Team[] }): Team | null;
export function buildKillRaceMvpOverlay(input?: {
  tournament?: Tournament | null;
  teams?: Team[];
  matches?: Match[];
  broadcastMatchId?: number | null;
}): KillRaceMvpOverlayViewModel;
export function buildKillRaceChampionOverlay(input?: {
  tournament?: Tournament | null;
  teams?: Team[];
  matches?: Match[];
}): KillRaceChampionOverlayViewModel;
