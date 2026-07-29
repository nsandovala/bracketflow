export function buildKillRaceCasterState({ matches = [], teams = [], broadcastMatchId = null }) {
  const teamKills = new Map();
  const teamMaps = new Map();
  const playerKills = new Map();
  const seenMaps = new Set();
  let confirmedMapCount = 0;

  for (const match of matches) {
    for (const map of match.maps ?? []) {
      if (map.result_status !== "confirmed" || seenMaps.has(map.id)) continue;
      seenMaps.add(map.id);
      confirmedMapCount += 1;
      if (match.team_a_id !== null) {
        teamKills.set(match.team_a_id, (teamKills.get(match.team_a_id) ?? 0) + map.kills_a);
        teamMaps.set(match.team_a_id, (teamMaps.get(match.team_a_id) ?? 0) + 1);
      }
      if (match.team_b_id !== null) {
        teamKills.set(match.team_b_id, (teamKills.get(match.team_b_id) ?? 0) + map.kills_b);
        teamMaps.set(match.team_b_id, (teamMaps.get(match.team_b_id) ?? 0) + 1);
      }
      for (const stat of map.player_stats ?? []) {
        const teamId = stat.side === "left" ? match.team_a_id : match.team_b_id;
        const nickname = stat.player_name;
        const playerId = stat.player_id ?? null;
        const fallback = nickname.trim().toLocaleLowerCase().replace(/\s+/g, " ");
        const key = `${teamId ?? "unknown"}:${playerId ?? fallback}`;
        const current = playerKills.get(key) ?? {
          key,
          playerKey: key,
          playerId,
          nickname,
          playerName: nickname,
          teamId,
          teamName: teams.find((team) => team.id === teamId)?.name ?? "Equipo",
          confirmedKills: 0,
          kills: 0,
          confirmedMapCount: 0,
          averageKills: 0,
          rank: 0,
          isMvp: false,
          isTiedMvp: false,
          mapBreakdown: [],
        };
        current.confirmedKills += stat.kills;
        current.kills += stat.kills;
        current.confirmedMapCount += 1;
        current.averageKills = current.confirmedKills / current.confirmedMapCount;
        current.mapBreakdown.push({
          matchId: match.id,
          mapNumber: map.map_number,
          kills: stat.kills,
        });
        playerKills.set(key, current);
      }
    }
  }

  const playerRanking = [...playerKills.values()].sort(
    (a, b) => b.confirmedKills - a.confirmedKills || a.nickname.localeCompare(b.nickname)
  );
  const topKills = playerRanking[0]?.confirmedKills ?? null;
  const tiedMvp = topKills !== null &&
    playerRanking.filter((player) => player.confirmedKills === topKills).length > 1;
  playerRanking.forEach((player, index) => {
    player.rank =
      index > 0 && player.confirmedKills === playerRanking[index - 1].confirmedKills
        ? playerRanking[index - 1].rank
        : index + 1;
    player.isMvp = topKills !== null && player.confirmedKills === topKills;
    player.isTiedMvp = player.isMvp && tiedMvp;
  });
  const mvp = playerRanking.filter((player) => player.isMvp);
  const championId = teams.length
    ? matches.find((match) => match.next_match_id === null && match.winner_id !== null)?.winner_id ?? null
    : null;

  return {
    teamTotals: [...teamKills].map(([teamId, kills]) => ({
      teamId,
      teamName: teams.find((team) => team.id === teamId)?.name ?? "Equipo",
      kills,
      confirmedMaps: teamMaps.get(teamId) ?? 0,
    })).sort((a, b) => b.kills - a.kills || a.teamName.localeCompare(b.teamName)),
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
