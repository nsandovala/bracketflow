export function buildKillRaceCasterState({ matches = [], teams = [], broadcastMatchId = null }) {
  const teamKills = new Map();
  const playerKills = new Map();
  const seenMaps = new Set();
  let confirmedMapCount = 0;

  for (const match of matches) {
    for (const map of match.maps ?? []) {
      if (map.result_status !== "confirmed" || seenMaps.has(map.id)) continue;
      seenMaps.add(map.id);
      confirmedMapCount += 1;
      for (const stat of map.player_stats ?? []) {
        const teamId = stat.side === "left" ? match.team_a_id : match.team_b_id;
        if (teamId !== null) teamKills.set(teamId, (teamKills.get(teamId) ?? 0) + stat.kills);
        const key = `${teamId}:${stat.player_id}`;
        const current = playerKills.get(key) ?? {
          playerId: stat.player_id,
          playerName: stat.player_name,
          teamId,
          kills: 0,
        };
        current.kills += stat.kills;
        playerKills.set(key, current);
      }
    }
  }

  const playerRanking = [...playerKills.values()].sort(
    (a, b) => b.kills - a.kills || a.playerName.localeCompare(b.playerName)
  );
  const topKills = playerRanking[0]?.kills ?? null;
  const mvp = topKills === null ? [] : playerRanking.filter((player) => player.kills === topKills);
  const championId = teams.length
    ? matches.find((match) => match.next_match_id === null && match.winner_id !== null)?.winner_id ?? null
    : null;

  return {
    teamTotals: [...teamKills].map(([teamId, kills]) => ({ teamId, kills })),
    confirmedMapCount,
    playerRanking,
    mvp,
    broadcastMatch: matches.find((match) => match.id === broadcastMatchId) ?? null,
    champion: teams.find((team) => team.id === championId) ?? null,
    tournamentStatus: championId ? "completed" : "live",
    completedSeriesCount: matches.filter(
      (match) => match.status === "completed" || match.winner_id !== null
    ).length,
  };
}
