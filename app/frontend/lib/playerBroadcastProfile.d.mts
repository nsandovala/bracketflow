import type {
  PlayerGameIdentity,
  PlayerProfile,
  TeamResultDetail,
} from "./api";
import type { MvpPlayerEntry } from "./mvp";

export type OfficialPlayerPerformance = {
  team: string;
  kills: number;
  reportedMatches: number;
  averageKills: number | null;
  mvpRank: number | null;
  perMatch: Array<{
    matchId: number;
    round: number;
    kills: number;
  }>;
  status: string;
};

export type PlayerBroadcastProfileView = {
  identityStatus: string;
  profileStatus: string;
  declared: {
    displayName: string;
    gameHandle: string;
    aliases: string[];
    declaredKd: number | null;
    declaredKdLabel: string;
    role: string;
    platform: string;
    input: string;
    country: string;
    shortBio: string;
    casterNote: string;
    socialHandle: string;
    avatarUrl: string | null;
  };
  official: OfficialPlayerPerformance;
};

export function getStableMvpRanks(
  players: MvpPlayerEntry[]
): Array<MvpPlayerEntry & { rank: number }>;

export function getOfficialPlayerPerformance(input: {
  playerName: string;
  teamId: number;
  teamName: string;
  results: TeamResultDetail[];
  mvpRank?: number | null;
}): OfficialPlayerPerformance;

export function createPlayerBroadcastProfileView(input: {
  playerName: string;
  teamId: number;
  teamName: string;
  profile: PlayerProfile | null;
  gameIdentities?: PlayerGameIdentity[];
  results?: TeamResultDetail[];
  mvpRank?: number | null;
}): PlayerBroadcastProfileView;
