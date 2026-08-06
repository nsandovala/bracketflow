export type BroadcastChannelLike = {
  activeTournamentId?: number | null;
  broadcastMatchId?: number | null;
};
export function resolveBroadcastContext(input: {
  explicitTournamentId: number | null;
  explicitMatchId: number | null;
  channel?: BroadcastChannelLike | null;
}): { tournamentId: number | null; matchId: number | null; source: string };
export function getOperatorTransmissionState(selectedMatchId: number | null, channel?: BroadcastChannelLike | null): {
  onAirMatchId: number | null;
  isOnAir: boolean;
  hasMismatch: boolean;
  hasBroadcast: boolean;
};
export function getFollowOperatorOverlayUrl(
  origin: string,
  layout: string,
  channelKey?: string,
  transparent?: boolean
): string;
export function getTournamentOverlayUrl(
  origin: string,
  tournamentId: number,
  layout: string,
  matchId?: number | null
): string;
