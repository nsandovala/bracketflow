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
export type StreamSnapshotLike = {
  tournament: unknown | null;
  matchCompletionPolicy: unknown | null;
  teams: unknown[];
  matches: unknown[];
  standings: unknown[];
  results: unknown[];
  afterGameNumber: number;
  connected: boolean;
  hasLoadedOnce: boolean;
  channel: unknown | null;
  resolvedMatchId: number | null;
  emptyReason: string | null;
};
export function clearStreamSnapshot<T extends StreamSnapshotLike>(
  current: T,
  options: {
    channel?: unknown | null;
    resolvedMatchId?: number | null;
    emptyReason: string;
  }
): T;
export function reduceStreamFetchFailure<T extends StreamSnapshotLike>(
  current: T,
  error: unknown,
  options?: {
    channel?: unknown | null;
    resolvedMatchId?: number | null;
    emptyReason?: string;
  }
): T;
export function isInvalidStreamReferenceError(error: unknown): boolean;
export function hasResolvedMatch(
  matches: Array<{ id: number }>,
  matchId: number | null | undefined
): boolean;
