import type { Match, Team } from "./api";

export type KillRaceCasterPlayer = {
  playerId: number;
  playerName: string;
  teamId: number | null;
  kills: number;
};

export function buildKillRaceCasterState(input: {
  matches?: Match[];
  teams?: Team[];
  broadcastMatchId?: number | null;
}): {
  teamTotals: Array<{ teamId: number; kills: number }>;
  confirmedMapCount: number;
  playerRanking: KillRaceCasterPlayer[];
  mvp: KillRaceCasterPlayer[];
  broadcastMatch: Match | null;
  champion: Team | null;
  tournamentStatus: "completed" | "live";
  completedSeriesCount: number;
};
