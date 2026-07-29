import type { Match, Team } from "./api";

export type KillRaceCasterPlayer = {
  key: string;
  playerKey: string;
  playerId: number | null;
  nickname: string;
  playerName: string;
  teamId: number | null;
  teamName: string;
  confirmedKills: number;
  kills: number;
  confirmedMapCount: number;
  averageKills: number;
  rank: number;
  isMvp: boolean;
  isTiedMvp: boolean;
  mapBreakdown: Array<{
    matchId: number;
    mapNumber: number;
    kills: number;
  }>;
};

export function buildKillRaceCasterState(input: {
  matches?: Match[];
  teams?: Team[];
  broadcastMatchId?: number | null;
}): {
  teamTotals: Array<{
    teamId: number;
    teamName: string;
    kills: number;
    confirmedMaps: number;
  }>;
  confirmedMapCount: number;
  playerRanking: KillRaceCasterPlayer[];
  mvp: KillRaceCasterPlayer[];
  broadcastMatch: Match | null;
  champion: Team | null;
  tournamentStatus: "completed" | "live";
  completedSeriesCount: number;
};
