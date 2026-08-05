import type { BroadcastChannel, Match, Team, Tournament } from "./api";
import type { KillRaceCasterPlayer } from "./killRaceCasterState.mjs";
import type { ResolvedTournamentEngine } from "./tournamentModel";

export type KillRaceIntermissionState =
  | "NO_TOURNAMENT"
  | "NO_MATCH"
  | "UPCOMING"
  | "BETWEEN_MAPS"
  | "PROVISIONAL_REVIEW"
  | "SERIES_COMPLETE"
  | "TOURNAMENT_COMPLETE";

export type KillRaceIntermissionTeam = { id: number; name: string };

export type KillRaceIntermissionMap = {
  mapNumber: number;
  label: string;
  status: "pending" | "live" | "provisional" | "confirmed";
  killsLeft: number;
  killsRight: number;
  winnerName: string | null;
  winnerSide: "left" | "right" | null;
  leftPlayers: Array<{ playerId: number; nickname: string; kills: number }>;
  rightPlayers: Array<{ playerId: number; nickname: string; kills: number }>;
};

export type KillRaceIntermissionFeaturedPlayer = {
  playerId: number;
  nickname: string;
  teamId: number | null;
  teamName: string;
  confirmedKills: number;
  confirmedMaps: number;
  averageKills: number | null;
  isMvp: boolean;
};

export type KillRaceIntermissionViewModel = {
  state: KillRaceIntermissionState;
  tournamentName: string | null;
  matchId: number | null;
  mapNumber: number | null;
  nextMapNumber: number | null;
  bestOf: number | null;
  leftTeam: KillRaceIntermissionTeam | null;
  rightTeam: KillRaceIntermissionTeam | null;
  seriesScore: { left: number | null; right: number | null };
  lastConfirmedMap: KillRaceIntermissionMap | null;
  currentProvisional: KillRaceIntermissionMap | null;
  featuredPlayer: KillRaceIntermissionFeaturedPlayer | null;
  featuredTiedPlayers: KillRaceIntermissionFeaturedPlayer[];
  featuredIsTied: boolean;
  seriesWinner: KillRaceIntermissionTeam | null;
  champion: KillRaceIntermissionTeam | null;
  title: string;
  headerMeta: string;
  message: string;
  detailMessage: string | null;
  featureLabel: string | null;
  featuredEmptyMessage: string | null;
  winnerAnnouncement: string | null;
  heroVariant: "empty" | "matchup" | "champion";
  visualKey: string;
};

type KillRaceCasterState = {
  playerRanking: KillRaceCasterPlayer[];
  mvp: KillRaceCasterPlayer[];
  champion: Team | null;
};

export function buildKillRaceIntermission(input?: {
  tournament?: Tournament | null;
  selectedEngine?: ResolvedTournamentEngine | null;
  broadcastChannel?: BroadcastChannel | null;
  broadcastMatch?: Match | null;
  teams?: Team[];
  matches?: Match[];
  killRaceCasterState?: KillRaceCasterState | null;
}): KillRaceIntermissionViewModel;
