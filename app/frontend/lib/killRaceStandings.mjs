import { buildKillRaceCasterState } from "./killRaceCasterState.mjs";

export const KILL_RACE_STANDINGS_TABS = Object.freeze([
  { key: "performance", label: "RENDIMIENTO" },
  { key: "players", label: "JUGADORES" },
  { key: "matches", label: "PARTIDAS" },
  { key: "bracket", label: "BRACKET" },
]);

function normalizeName(value) {
  return String(value ?? "").trim().toLocaleLowerCase("es").replace(/\s+/g, " ");
}

function sortedMatches(matches) {
  return [...matches].sort((left, right) => left.round - right.round || left.id - right.id);
}

function sortedMaps(maps) {
  return [...(maps ?? [])].sort(
    (left, right) => left.map_number - right.map_number || left.id - right.id
  );
}

function getFinalMatch(matches) {
  if (matches.length === 0) return null;
  const maximumRound = Math.max(...matches.map((match) => match.round));
  return (
    sortedMatches(matches)
      .filter((match) => match.round === maximumRound)
      .sort(
        (left, right) =>
          Number(right.next_match_id === null) - Number(left.next_match_id === null) ||
          left.id - right.id
      )[0] ?? null
  );
}

function phaseLabel(round, finalRound) {
  const distance = finalRound - round;
  if (distance === 0) return "Final";
  if (distance === 1) return "Semifinal";
  if (distance === 2) return "Cuartos";
  return `Ronda ${round}`;
}

function otherTeamId(match, teamId) {
  if (match.team_a_id === teamId) return match.team_b_id;
  if (match.team_b_id === teamId) return match.team_a_id;
  return null;
}

function teamSide(match, teamId) {
  if (match.team_a_id === teamId) return "left";
  if (match.team_b_id === teamId) return "right";
  return null;
}

function losingTeamId(match) {
  if (match.winner_id === null) return null;
  if (match.winner_id === match.team_a_id) return match.team_b_id;
  if (match.winner_id === match.team_b_id) return match.team_a_id;
  return null;
}

function teamRoster(team) {
  return (team.members ?? [])
    .map((member) => member.player?.nickname?.trim())
    .filter(Boolean);
}

function getCompetitiveState(teamId, matches, finalMatch) {
  if (!finalMatch) return "POR DISPUTAR";
  const championId = finalMatch.winner_id;
  const runnerUpId = finalMatch.status === "completed" ? losingTeamId(finalMatch) : null;
  if (teamId === championId) return "CAMPEÓN";
  if (teamId === runnerUpId) return "SUBCAMPEÓN";

  const semifinalRound = finalMatch.round - 1;
  const semifinals = matches.filter((match) => match.round === semifinalRound);
  const eliminatedInSemifinal = semifinals.some(
    (match) =>
      match.status === "completed" &&
      losingTeamId(match) === teamId
  );
  if (eliminatedInSemifinal) return "ELIMINADO EN SEMIFINAL";

  const openMatches = matches.filter(
    (match) =>
      match.winner_id === null &&
      match.status !== "completed" &&
      (match.team_a_id === teamId || match.team_b_id === teamId)
  );
  if (openMatches.some((match) => otherTeamId(match, teamId) === null)) {
    return "ESPERANDO RIVAL";
  }
  if (
    finalMatch.winner_id === null &&
    finalMatch.team_a_id !== null &&
    finalMatch.team_b_id !== null &&
    (finalMatch.team_a_id === teamId || finalMatch.team_b_id === teamId)
  ) {
    return "EN FINAL";
  }
  if (
    openMatches.some(
      (match) =>
        match.round === semifinalRound &&
        match.team_a_id !== null &&
        match.team_b_id !== null
    )
  ) {
    return "EN SEMIFINAL";
  }
  return "POR DISPUTAR";
}

function buildPlayerRanking(casterState) {
  const ranking = casterState.playerRanking
    .filter((player) => player.teamId !== null)
    .map((player) => ({
      rank: 0,
      playerKey: player.playerKey,
      playerId: player.playerId,
      nickname: player.nickname,
      teamId: player.teamId,
      teamName: player.teamName,
      confirmedKills: player.confirmedKills,
      confirmedMapCount: player.confirmedMapCount,
      averageKills: player.confirmedMapCount > 0 ? player.averageKills : null,
      isMvp: false,
      isTiedMvp: false,
      mapBreakdown: [...player.mapBreakdown].sort(
        (left, right) => left.matchId - right.matchId || left.mapNumber - right.mapNumber
      ),
    }))
    .sort(
      (left, right) =>
        right.confirmedKills - left.confirmedKills ||
        left.nickname.localeCompare(right.nickname, "es") ||
        left.playerKey.localeCompare(right.playerKey)
    );
  const topKills = ranking[0]?.confirmedKills ?? null;
  const topCount =
    topKills === null ? 0 : ranking.filter((player) => player.confirmedKills === topKills).length;
  ranking.forEach((player, index) => {
    player.rank =
      index > 0 && player.confirmedKills === ranking[index - 1].confirmedKills
        ? ranking[index - 1].rank
        : index + 1;
    player.isMvp = topKills !== null && player.confirmedKills === topKills;
    player.isTiedMvp = player.isMvp && topCount > 1;
  });
  return ranking;
}

function mapOutcome(map, match, teamId) {
  if (map.result_status === "provisional") return "EN REVISIÓN";
  if (map.result_status !== "confirmed" || map.map_winner_id === null) return "PENDIENTE";
  return map.map_winner_id === teamId ? "VICTORIA" : "DERROTA";
}

function buildTeamMapRows(teamId, matches, teamsById, finalRound) {
  return sortedMatches(matches).flatMap((match) => {
    const side = teamSide(match, teamId);
    if (!side) return [];
    const opponentId = otherTeamId(match, teamId);
    return sortedMaps(match.maps)
      .filter((map) => map.result_status === "confirmed" || map.result_status === "provisional")
      .map((map) => ({
        matchId: match.id,
        phaseLabel: phaseLabel(match.round, finalRound),
        mapId: map.id,
        mapNumber: map.map_number,
        resultStatus: map.result_status,
        killsFor: side === "left" ? map.kills_a : map.kills_b,
        killsAgainst: side === "left" ? map.kills_b : map.kills_a,
        outcome: mapOutcome(map, match, teamId),
        opponentTeamId: opponentId,
        opponentTeamName: teamsById.get(opponentId)?.name ?? "Rival por definir",
      }));
  });
}

function buildTeamSeriesRows(teamId, matches, teamsById, finalRound) {
  return sortedMatches(matches)
    .filter((match) => match.team_a_id === teamId || match.team_b_id === teamId)
    .map((match) => {
      const side = teamSide(match, teamId);
      const opponentId = otherTeamId(match, teamId);
      const hasOfficialWinner = match.winner_id !== null;
      return {
        matchId: match.id,
        phaseLabel: phaseLabel(match.round, finalRound),
        opponentTeamId: opponentId,
        opponentTeamName: teamsById.get(opponentId)?.name ?? "Rival por definir",
        scoreFor: side === "left" ? match.maps_won_a : match.maps_won_b,
        scoreAgainst: side === "left" ? match.maps_won_b : match.maps_won_a,
        outcome: hasOfficialWinner
          ? match.winner_id === teamId
            ? "VICTORIA"
            : "DERROTA"
          : "PENDIENTE",
        status: match.status,
      };
    });
}

function buildMatchHistory(matches, teamsById, finalRound, broadcastMatchId) {
  return sortedMatches(matches).map((match) => ({
    matchId: match.id,
    round: match.round,
    phaseLabel: phaseLabel(match.round, finalRound),
    bestOf: match.best_of,
    status: match.status,
    leftTeam: teamsById.get(match.team_a_id) ?? null,
    rightTeam: teamsById.get(match.team_b_id) ?? null,
    seriesScore: { left: match.maps_won_a, right: match.maps_won_b },
    winner: teamsById.get(match.winner_id) ?? null,
    maps: sortedMaps(match.maps).map((map) => ({
      mapId: map.id,
      mapNumber: map.map_number,
      resultStatus: map.result_status,
      leftKills: map.kills_a,
      rightKills: map.kills_b,
      winnerTeamId: map.result_status === "confirmed" ? map.map_winner_id : null,
      playerStats: [...(map.player_stats ?? [])]
        .sort(
          (left, right) =>
            left.side.localeCompare(right.side) ||
            (left.player_id ?? Number.MAX_SAFE_INTEGER) -
              (right.player_id ?? Number.MAX_SAFE_INTEGER) ||
            left.player_name.localeCompare(right.player_name, "es")
        )
        .map((stat) => ({
          playerId: stat.player_id ?? null,
          nickname: stat.player_name,
          side: stat.side,
          teamId: stat.side === "left" ? match.team_a_id : match.team_b_id,
          teamName:
            teamsById.get(stat.side === "left" ? match.team_a_id : match.team_b_id)?.name ??
            "Equipo",
          kills: stat.kills,
        })),
    })),
    isBroadcast: match.id === broadcastMatchId,
  }));
}

function visualSignature(tournament, engine, teams, matches) {
  const teamRows = [...teams]
    .sort((left, right) => left.id - right.id)
    .map(
      (team) =>
        `${team.id}:${team.name}:${(team.members ?? [])
          .map((member) => `${member.player_id}:${member.player?.nickname ?? ""}`)
          .sort()
          .join(",")}`
    )
    .join("|");
  const matchRows = sortedMatches(matches)
    .map(
      (match) =>
        `${match.id}:${match.round}:${match.status}:${match.team_a_id ?? "-"}:${match.team_b_id ?? "-"}:${match.winner_id ?? "-"}:${match.maps_won_a}-${match.maps_won_b}:${match.next_match_id ?? "-"}:${sortedMaps(match.maps)
          .map(
            (map) =>
              `${map.id}:${map.map_number}:${map.result_status}:${map.kills_a}-${map.kills_b}:${map.map_winner_id ?? "-"}:${[...(map.player_stats ?? [])]
                .sort(
                  (left, right) =>
                    left.side.localeCompare(right.side) ||
                    (left.player_id ?? Number.MAX_SAFE_INTEGER) -
                      (right.player_id ?? Number.MAX_SAFE_INTEGER) ||
                    left.player_name.localeCompare(right.player_name, "es")
                )
                .map(
                  (stat) =>
                    `${stat.side}:${stat.player_id ?? normalizeName(stat.player_name)}:${stat.player_name}:${stat.kills}`
                )
                .join(",")}`
          )
          .join("/")}`
    )
    .join("|");
  return [
    tournament?.id ?? "-",
    tournament?.name ?? "-",
    tournament?.status ?? "-",
    tournament?.bracket_status ?? "-",
    engine?.engineKey ?? "-",
    teamRows,
    matchRows,
  ].join("::");
}

export function buildKillRaceStandings({
  tournament = null,
  engine = null,
  teams = [],
  matches = [],
  broadcastMatchId = null,
} = {}) {
  const orderedMatches = sortedMatches(matches);
  const finalMatch = getFinalMatch(orderedMatches);
  const finalRound = finalMatch?.round ?? Math.max(0, ...orderedMatches.map((match) => match.round));
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const casterState = buildKillRaceCasterState({ matches: orderedMatches, teams, broadcastMatchId });
  const playerRanking = buildPlayerRanking(casterState);
  const teamTotals = new Map(casterState.teamTotals.map((team) => [team.teamId, team]));

  const teamRanking = teams
    .map((team) => {
      const confirmed = teamTotals.get(team.id);
      const officialSeries = orderedMatches.filter(
        (match) =>
          match.winner_id !== null &&
          (match.team_a_id === team.id || match.team_b_id === team.id)
      );
      let mapsWon = 0;
      let mapsLost = 0;
      for (const match of orderedMatches) {
        if (match.team_a_id !== team.id && match.team_b_id !== team.id) continue;
        for (const map of sortedMaps(match.maps)) {
          if (map.result_status !== "confirmed" || map.map_winner_id === null) continue;
          if (map.map_winner_id === team.id) mapsWon += 1;
          else mapsLost += 1;
        }
      }
      const confirmedKills = confirmed?.kills ?? 0;
      const confirmedMaps = confirmed?.confirmedMaps ?? 0;
      return {
        rank: 0,
        teamId: team.id,
        teamName: team.name,
        roster: teamRoster(team),
        confirmedKills,
        confirmedMaps,
        averageKills: confirmedMaps > 0 ? confirmedKills / confirmedMaps : null,
        mapsWon,
        mapsLost,
        seriesPlayed: officialSeries.length,
        seriesWins: officialSeries.filter((match) => match.winner_id === team.id).length,
        seriesLosses: officialSeries.filter((match) => match.winner_id !== team.id).length,
        gapToLeader: null,
        competitiveState: getCompetitiveState(team.id, orderedMatches, finalMatch),
        isChampion: finalMatch?.winner_id === team.id,
        isEliminated:
          getCompetitiveState(team.id, orderedMatches, finalMatch) === "SUBCAMPEÓN" ||
          getCompetitiveState(team.id, orderedMatches, finalMatch) ===
            "ELIMINADO EN SEMIFINAL",
        playerRows: playerRanking.filter((player) => player.teamId === team.id),
        mapRows: buildTeamMapRows(team.id, orderedMatches, teamsById, finalRound),
        seriesRows: buildTeamSeriesRows(team.id, orderedMatches, teamsById, finalRound),
      };
    })
    .sort(
      (left, right) =>
        right.confirmedKills - left.confirmedKills ||
        right.confirmedMaps - left.confirmedMaps ||
        left.teamName.localeCompare(right.teamName, "es")
    );
  const leaderKills = teamRanking[0]?.confirmedKills ?? 0;
  teamRanking.forEach((team, index) => {
    team.rank = index + 1;
    team.gapToLeader = index === 0 ? null : team.confirmedKills - leaderKills;
  });

  const championTeam = teamsById.get(finalMatch?.winner_id) ?? null;
  const hasFinalParticipant = Boolean(finalMatch?.team_a_id || finalMatch?.team_b_id);
  const currentPhase = championTeam
    ? "Finalizado"
    : orderedMatches.length === 0
      ? "Por comenzar"
      : hasFinalParticipant
        ? "Final"
        : "Semifinales";
  const confirmedMapCount = casterState.confirmedMapCount;
  const completedSeriesCount = orderedMatches.filter(
    (match) => match.winner_id !== null
  ).length;
  const matchHistory = buildMatchHistory(
    orderedMatches,
    teamsById,
    finalRound,
    broadcastMatchId
  );

  return {
    summary: {
      tournamentId: tournament?.id ?? null,
      tournamentName: tournament?.name ?? null,
      tournamentStatus: tournament?.status ?? null,
      leader:
        confirmedMapCount > 0 && teamRanking[0]
          ? {
              teamId: teamRanking[0].teamId,
              teamName: teamRanking[0].teamName,
              confirmedKills: teamRanking[0].confirmedKills,
              confirmedMaps: teamRanking[0].confirmedMaps,
            }
          : null,
      topPlayers: playerRanking.filter((player) => player.isMvp),
      confirmedMapCount,
      completedSeriesCount,
      totalSeriesCount: orderedMatches.length,
      currentPhase,
      champion: championTeam
        ? { teamId: championTeam.id, teamName: championTeam.name }
        : null,
    },
    teamRanking,
    playerRanking,
    matchHistory,
    bracketSummary: {
      totalMatches: orderedMatches.length,
      completedMatches: completedSeriesCount,
      openMatches: orderedMatches.length - completedSeriesCount,
      finalMatchId: finalMatch?.id ?? null,
      championTeamId: championTeam?.id ?? null,
    },
    visualKey: visualSignature(tournament, engine, teams, orderedMatches),
  };
}

export function resolveStandingsSurface(engine) {
  if (engine?.scoringProfile === "kill_race") return "kill-race-detailed";
  if (engine && engine.tournamentStructure !== "cumulative") return "bracket";
  return "standings";
}

export function toggleStandingsSelection(currentKey, requestedKey) {
  return currentKey === requestedKey ? null : requestedKey;
}

export function reconcileStandingsSelection(currentKey, availableKeys) {
  return currentKey !== null && availableKeys.includes(currentKey) ? currentKey : null;
}

export function createKillRaceStandingsUiState(tournamentId) {
  return {
    tournamentId,
    activeTab: "performance",
    expandedTeamId: null,
    expandedPlayerKey: null,
  };
}

export function reconcileKillRaceStandingsUiState(
  current,
  tournamentId,
  availableTeamIds,
  availablePlayerKeys
) {
  if (current.tournamentId !== tournamentId) {
    return createKillRaceStandingsUiState(tournamentId);
  }
  const expandedTeamId = reconcileStandingsSelection(
    current.expandedTeamId,
    availableTeamIds
  );
  const expandedPlayerKey = reconcileStandingsSelection(
    current.expandedPlayerKey,
    availablePlayerKeys
  );
  if (
    expandedTeamId === current.expandedTeamId &&
    expandedPlayerKey === current.expandedPlayerKey
  ) {
    return current;
  }
  return { ...current, expandedTeamId, expandedPlayerKey };
}

export function normalizeStandingsPollMs(options) {
  const pollMs = options?.pollMs;
  return Number.isFinite(pollMs) && pollMs > 0 ? pollMs : null;
}

export async function runSequentialPollCycle({
  fetchOnce,
  isActive,
  schedule,
  delayMs,
}) {
  try {
    await fetchOnce();
  } finally {
    if (isActive()) schedule(delayMs);
  }
}
