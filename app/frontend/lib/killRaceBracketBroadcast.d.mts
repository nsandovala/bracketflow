export type KillRaceBroadcastTeam = {
  id: string;
  name: string;
  roster: string;
  score: number | null;
  badge?: string;
  stateLabel: string;
  isBye: boolean;
  isEmpty: boolean;
  isFuture: boolean;
  isWinner: boolean;
  isLoser: boolean;
};

export type KillRaceBroadcastSeries = {
  id: number | string;
  matchId: number;
  matchLabel: string;
  round: number;
  roundLabel: string;
  bestOf: number;
  status: string;
  statusLabel: string;
  statusTone: "broadcast" | "live" | "completed" | "future" | "ready" | "bye";
  teams: [KillRaceBroadcastTeam, KillRaceBroadcastTeam];
  leftTeam: KillRaceBroadcastTeam | null;
  rightTeam: KillRaceBroadcastTeam | null;
  mapsWonA: number;
  mapsWonB: number;
  winnerId: number | null;
  isBroadcast: boolean;
  isLive: boolean;
  isCompleted: boolean;
  isFuture: boolean;
  isPlayable: boolean;
  isBye: boolean;
  visibleMap: null | {
    mapNumber: number;
    status: string;
    statusLabel: string;
    killsA: number;
    killsB: number;
  };
};

export type KillRaceBracketBroadcastModel = {
  state: "no-tournament" | "tournament-prepared" | "bracket-prepared" | "active" | "completed";
  tournamentName: string | null;
  tournamentStatus: string | null;
  phaseLabel: string;
  rounds: Array<{ title: string; round: number; roundLabel: string; seeds: KillRaceBroadcastSeries[] }>;
  broadcastMatchId: number | null;
  requestedBroadcastMatchId: number | null;
  broadcastSeries: KillRaceBroadcastSeries | null;
  totalSeries: number;
  completedSeries: number;
  activeSeries: number;
  champion: null | { teamId: number | null; name: string; score: string; matchId: number };
  layoutDensity: "showcase" | "standard" | "fallback";
  maxMatchesInRound: number;
  visualKey: string;
};

export function buildKillRaceBracketBroadcast(input: {
  tournament: Tournament | null;
  matches?: Match[];
  teams?: Team[];
  broadcastMatchId?: number | null;
  sourceRounds?: IRoundProps[];
}): KillRaceBracketBroadcastModel;

export function getKillRaceBracketLayout(input: {
  roundCount: number;
  maxMatchesInRound: number;
  viewportWidth: number;
  viewportHeight: number;
}): {
  density: "showcase" | "standard" | "fallback";
  scale: number;
  minimumScale: number;
  cardWidth: number;
  roundGap: number;
  matchHeight: number;
  matchGap: number;
  requiredHeight: number;
  availableWidth: number;
  availableHeight: number;
  baseWidth: number;
  baseHeight: number;
  scaledWidth: number;
  scaledHeight: number;
  requestsOverflow: boolean;
};
export const KILL_RACE_DENSE_MATCH_GAP: number;
import type { IRoundProps } from "react-brackets";
import type { Match, Team, Tournament } from "./api";
