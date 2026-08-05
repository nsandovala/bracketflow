export function resolveBroadcastContext({ explicitTournamentId, explicitMatchId, channel }) {
  if (explicitMatchId !== null && explicitMatchId !== undefined) {
    return { tournamentId: explicitTournamentId, matchId: explicitMatchId, source: "explicit" };
  }
  if (channel) {
    return {
      tournamentId: channel.activeTournamentId ?? null,
      matchId: channel.broadcastMatchId ?? null,
      source: "channel",
    };
  }
  return { tournamentId: explicitTournamentId, matchId: null, source: "fixed" };
}

export function getOperatorTransmissionState(selectedMatchId, channel) {
  const onAirMatchId = channel?.broadcastMatchId ?? null;
  return {
    onAirMatchId,
    isOnAir: selectedMatchId !== null && selectedMatchId === onAirMatchId,
    hasMismatch: selectedMatchId !== null && onAirMatchId !== null && selectedMatchId !== onAirMatchId,
    hasBroadcast: onAirMatchId !== null,
  };
}

export function getFollowOperatorOverlayUrl(
  origin,
  layout,
  channelKey = "main",
  transparent = true
) {
  const query = new URLSearchParams({ channel: channelKey, layout, obs: "1" });
  if (transparent) query.set("bg", "transparent");
  return `${origin}/stream?${query.toString()}`;
}
