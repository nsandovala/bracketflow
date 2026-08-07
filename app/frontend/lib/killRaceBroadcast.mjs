export function calculatePlayerTotal(players = []) {
  return players.reduce((total, player) => total + player.kills, 0);
}

export function calculatePlayerTotalOrNull(players = []) {
  return players.length > 0 ? calculatePlayerTotal(players) : null;
}

export function getKillRaceBroadcastStatus(resultStatus, connected = true) {
  if (!connected) return "RECONECTANDO";
  switch (resultStatus) {
    case "confirmed":
      return "FINAL";
    case "provisional":
      return "PROVISIONAL";
    case "live":
    case "in_progress":
      return "LIVE";
    case "pending":
    default:
      return "POR COMENZAR";
  }
}

export function selectKillRaceScorebugMatch(matches) {
  return (
    matches.find((match) => match.maps.some((map) => map.result_status !== "confirmed")) ??
    matches.find(
      (match) =>
        match.winner_id === null && match.team_a_id !== null && match.team_b_id !== null
    ) ??
    null
  );
}

function isPlayable(match) {
  return Boolean(
    match &&
      match.team_a_id !== null &&
      match.team_b_id !== null &&
      match.winner_id === null &&
      match.status !== "completed" &&
      match.status !== "waiting"
  );
}

export function resolveKillRaceScorebugMatch(matches, explicitMatchId, broadcastMatchId) {
  if (explicitMatchId !== null && explicitMatchId !== undefined) {
    const explicit = matches.find((match) => match.id === explicitMatchId);
    return explicit && (isPlayable(explicit) || explicit.maps.length > 0) ? explicit : null;
  }
  const broadcast = matches.find((match) => match.id === broadcastMatchId);
  if (broadcast && (isPlayable(broadcast) || broadcast.maps.length > 0)) return broadcast;
  return null;
}

export function killRaceVisualKey(tournamentId, match) {
  return `${tournamentId ?? "-"}:${match?.id ?? "-"}:${match?.status ?? "-"}:${match?.maps_won_a ?? 0}-${match?.maps_won_b ?? 0}:${(match?.maps ?? [])
    .map((map) => `${map.map_number}:${map.result_status}:${map.kills_a}-${map.kills_b}:${(map.player_stats ?? [])
      .map((stat) => `${stat.player_id}=${stat.kills}`)
      .join(",")}`)
    .join("|")}`;
}
