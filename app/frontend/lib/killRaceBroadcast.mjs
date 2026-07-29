export function calculatePlayerTotal(players = []) {
  return players.reduce((total, player) => total + player.kills, 0);
}

export function getKillRaceBroadcastStatus(resultStatus, connected = true) {
  if (!connected) return "RECONECTANDO";
  if (resultStatus === "confirmed") return "FINAL";
  if (resultStatus === "provisional") return "PROVISIONAL";
  return "LIVE";
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

export function killRaceVisualKey(tournamentId, match) {
  return `${tournamentId ?? "-"}:${match?.id ?? "-"}:${(match?.maps ?? [])
    .map((map) => `${map.map_number}:${map.result_status}:${map.kills_a}-${map.kills_b}`)
    .join("|")}`;
}
