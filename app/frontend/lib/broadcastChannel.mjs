export function resolveBroadcastContext({ explicitTournamentId, explicitMatchId, channel }) {
  if (explicitMatchId !== null && explicitMatchId !== undefined) {
    return { tournamentId: explicitTournamentId, matchId: explicitMatchId, source: "explicit" };
  }
  if (explicitTournamentId !== null && explicitTournamentId !== undefined) {
    return { tournamentId: explicitTournamentId, matchId: null, source: "explicit" };
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

export function getTournamentOverlayUrl(origin, tournamentId, layout, matchId = null) {
  const query = new URLSearchParams({ tournamentId: String(tournamentId) });
  if (matchId !== null && matchId !== undefined) query.set("matchId", String(matchId));
  query.set("layout", layout);
  query.set("obs", "1");
  return `${origin}/stream?${query.toString()}`;
}

export function clearStreamSnapshot(current, {
  channel = null,
  resolvedMatchId = null,
  emptyReason,
} = {}) {
  return {
    ...current,
    tournament: null,
    matchCompletionPolicy: null,
    teams: [],
    matches: [],
    standings: [],
    results: [],
    afterGameNumber: 0,
    connected: true,
    hasLoadedOnce: true,
    channel,
    resolvedMatchId,
    emptyReason,
  };
}

export function isInvalidStreamReferenceError(error) {
  return Boolean(error && typeof error === "object" && error.status === 404);
}

export function reduceStreamFetchFailure(current, error, options = {}) {
  if (isInvalidStreamReferenceError(error)) {
    return clearStreamSnapshot(current, {
      ...options,
      emptyReason: options.emptyReason ?? "TORNEO NO DISPONIBLE",
    });
  }
  return {
    ...current,
    connected: false,
    emptyReason: current.tournament ? current.emptyReason : "RECONECTANDO",
  };
}

export function hasResolvedMatch(matches, matchId) {
  return matchId === null || matchId === undefined
    ? true
    : matches.some((match) => match.id === matchId);
}
