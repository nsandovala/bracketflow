function asFiniteNumber(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function normalizeKillRacePlayerName(value) {
  return String(value ?? "").trim().toLocaleLowerCase("es").replace(/\s+/g, " ");
}

export function getKillRacePlayerKey(teamId, player) {
  const playerId = player?.player_id ?? player?.playerId ?? null;
  const nickname = player?.player_name ?? player?.nickname ?? "";
  return `${teamId ?? "unknown"}:${playerId ?? normalizeKillRacePlayerName(nickname)}`;
}

function sortMatches(matches = []) {
  return [...matches].sort(
    (left, right) =>
      asFiniteNumber(left.round) - asFiniteNumber(right.round) ||
      asFiniteNumber(left.id) - asFiniteNumber(right.id)
  );
}

function sortMaps(maps = []) {
  return [...maps].sort(
    (left, right) =>
      asFiniteNumber(left.map_number) - asFiniteNumber(right.map_number) ||
      asFiniteNumber(left.id) - asFiniteNumber(right.id)
  );
}

function teamRoster(team) {
  return (team?.members ?? [])
    .map((member) => member.player?.nickname?.trim())
    .filter(Boolean);
}

function teamView(team) {
  return team
    ? { id: team.id, name: team.name, roster: teamRoster(team) }
    : null;
}

function mapIdentity(map, match) {
  return map.id == null
    ? `${match.id}:${map.map_number ?? "-"}`
    : `map:${map.id}`;
}

export function getConfirmedKillRaceMaps(matches = []) {
  const seen = new Set();
  const rows = [];
  for (const match of sortMatches(matches)) {
    for (const map of sortMaps(match.maps)) {
      if (map.result_status !== "confirmed") continue;
      const key = mapIdentity(map, match);
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ match, map, key });
    }
  }
  return rows;
}

export function resolveKillRaceFinalMatch(matches = []) {
  const ordered = sortMatches(matches);
  if (ordered.length === 0) return null;
  const maximumRound = Math.max(...ordered.map((match) => asFiniteNumber(match.round)));
  const candidates = ordered.filter(
    (match) => asFiniteNumber(match.round) === maximumRound && match.next_match_id == null
  );
  return candidates.length === 1 ? candidates[0] : null;
}

export function resolveKillRaceChampionTeam({ matches = [], teams = [] } = {}) {
  const finalMatch = resolveKillRaceFinalMatch(matches);
  if (
    !finalMatch ||
    finalMatch.status !== "completed" ||
    finalMatch.winner_id == null ||
    finalMatch.team_a_id == null ||
    finalMatch.team_b_id == null ||
    (finalMatch.winner_id !== finalMatch.team_a_id &&
      finalMatch.winner_id !== finalMatch.team_b_id)
  ) {
    return null;
  }
  return teams.find((team) => team.id === finalMatch.winner_id) ?? null;
}

function aggregatePlayers(mapRows, teamsById) {
  const players = new Map();
  for (const { match, map, key: confirmedMapKey } of mapRows) {
    for (const stat of map.player_stats ?? []) {
      if (!Number.isFinite(stat.kills)) continue;
      const teamId = stat.side === "left" ? match.team_a_id : match.team_b_id;
      const nickname = String(stat.player_name ?? "").trim() || "Jugador";
      const key = getKillRacePlayerKey(teamId, stat);
      const current = players.get(key) ?? {
        key,
        playerId: stat.player_id ?? null,
        nickname,
        normalizedNickname: normalizeKillRacePlayerName(nickname),
        teamId,
        teamName: teamsById.get(teamId)?.name ?? "Equipo",
        confirmedKills: 0,
        confirmedMaps: 0,
        averageKills: 0,
        rank: 0,
        isMvp: false,
        isTiedMvp: false,
        mapKeys: new Set(),
      };
      current.confirmedKills += stat.kills;
      current.mapKeys.add(confirmedMapKey);
      current.confirmedMaps = current.mapKeys.size;
      current.averageKills = current.confirmedKills / current.confirmedMaps;
      players.set(key, current);
    }
  }

  const ranking = [...players.values()]
    .map((player) => ({
      key: player.key,
      playerId: player.playerId,
      nickname: player.nickname,
      normalizedNickname: player.normalizedNickname,
      teamId: player.teamId,
      teamName: player.teamName,
      confirmedKills: player.confirmedKills,
      confirmedMaps: player.confirmedMaps,
      averageKills: player.averageKills,
      rank: player.rank,
      isMvp: player.isMvp,
      isTiedMvp: player.isTiedMvp,
    }))
    .sort(
      (left, right) =>
        right.confirmedKills - left.confirmedKills ||
        left.teamName.localeCompare(right.teamName, "es") ||
        left.normalizedNickname.localeCompare(right.normalizedNickname, "es") ||
        left.key.localeCompare(right.key)
    );
  const topKills = ranking[0]?.confirmedKills ?? null;
  const tied =
    topKills !== null && ranking.filter((player) => player.confirmedKills === topKills).length > 1;
  let previousKills = null;
  let previousRank = 0;
  ranking.forEach((player, index) => {
    player.rank = previousKills === player.confirmedKills ? previousRank : index + 1;
    previousKills = player.confirmedKills;
    previousRank = player.rank;
    player.isMvp = topKills !== null && player.confirmedKills === topKills;
    player.isTiedMvp = player.isMvp && tied;
  });
  return ranking;
}

function hasConfirmedTeamResult(mapRows) {
  return mapRows.some(
    ({ map }) => Number.isFinite(map.kills_a) || Number.isFinite(map.kills_b)
  );
}

function mvpVisualKey(model) {
  const playerRows = model.ranking
    .map(
      (player) =>
        `${player.key}:${player.nickname}:${player.teamName}:${player.confirmedKills}:${player.confirmedMaps}`
    )
    .join("|");
  return [
    model.tournamentId ?? "-",
    model.requestedMatchId ?? "-",
    model.matchId ?? "-",
    model.scope ?? "-",
    model.state,
    model.matchStatus ?? "-",
    model.mapNumber ?? "-",
    model.seriesScore ? `${model.seriesScore.left}-${model.seriesScore.right}` : "-",
    model.confirmedMapCount,
    model.hasConfirmedTeamResults ? 1 : 0,
    playerRows || "-",
  ].join("::");
}

function baseMvpModel(overrides) {
  const model = {
    state: "waiting",
    tournamentId: null,
    tournamentName: null,
    requestedMatchId: null,
    matchId: null,
    matchStatus: null,
    scope: null,
    title: "JUGADOR DESTACADO",
    contextLabel: "DATOS CONFIRMADOS",
    mapNumber: null,
    seriesScore: null,
    confirmedMapCount: 0,
    hasConfirmedTeamResults: false,
    ranking: [],
    leaders: [],
    isTied: false,
    message: "Esperando resultados confirmados.",
    ...overrides,
  };
  return { ...model, visualKey: mvpVisualKey(model) };
}

export function buildKillRaceMvpOverlay({
  tournament = null,
  teams = [],
  matches = [],
  broadcastMatchId = null,
} = {}) {
  if (!tournament) {
    return baseMvpModel({
      state: "no-tournament",
      requestedMatchId: broadcastMatchId,
      message: "SIN TORNEO EN TRANSMISIÓN",
    });
  }

  const tournamentMatches = matches.filter(
    (match) => match.tournament_id === tournament.id
  );
  const tournamentTeams = teams.filter(
    (team) => team.tournament_id === tournament.id
  );
  const champion = resolveKillRaceChampionTeam({
    matches: tournamentMatches,
    teams: tournamentTeams,
  });
  const requestedMatch =
    broadcastMatchId == null
      ? null
      : tournamentMatches.find((match) => match.id === broadcastMatchId) ?? null;
  const tournamentCompleted =
    tournament.status === "completed" || tournament.bracket_status === "completed";
  let scope;
  let selectedMatch = requestedMatch;
  let mapRows;
  let title;
  let contextLabel;
  let mapNumber = null;

  if (broadcastMatchId != null && !requestedMatch) {
    return baseMvpModel({
      state: "no-match",
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      requestedMatchId: broadcastMatchId,
      message: "LA SERIE SOLICITADA NO PERTENECE A ESTE TORNEO",
    });
  }

  if (broadcastMatchId == null && (tournamentCompleted || champion)) {
    scope = "tournament";
    selectedMatch = null;
    mapRows = getConfirmedKillRaceMaps(tournamentMatches);
    title = "MVP DEL TORNEO";
    contextLabel = "TORNEO FINALIZADO · BAJAS CONFIRMADAS";
  } else if (!requestedMatch) {
    return baseMvpModel({
      state: "no-match",
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      requestedMatchId: broadcastMatchId,
      message: "SIN SERIE AL AIRE",
    });
  } else if (requestedMatch.status === "completed") {
    scope = "series";
    mapRows = getConfirmedKillRaceMaps([requestedMatch]);
    title = "MVP DE LA SERIE";
    contextLabel = "SERIE COMPLETADA · BAJAS CONFIRMADAS";
  } else {
    scope = "map";
    const confirmed = getConfirmedKillRaceMaps([requestedMatch]);
    mapRows = confirmed.length > 0 ? [confirmed.at(-1)] : [];
    mapNumber = mapRows[0]?.map.map_number ?? null;
    title = mapNumber === null ? "JUGADOR DESTACADO" : `JUGADOR DESTACADO · PARTIDA ${mapNumber}`;
    contextLabel = "ÚLTIMO MAPA CONFIRMADO";
  }

  const teamsById = new Map(tournamentTeams.map((team) => [team.id, team]));
  const ranking = aggregatePlayers(mapRows, teamsById);
  const topKills = ranking[0]?.confirmedKills ?? null;
  const leaders = topKills === null
    ? []
    : ranking.filter((player) => player.confirmedKills === topKills);
  const hasTeamResults = hasConfirmedTeamResult(mapRows);
  const common = {
    tournamentId: tournament.id,
    tournamentName: tournament.name,
    requestedMatchId: broadcastMatchId,
    matchId: selectedMatch?.id ?? null,
    matchStatus: selectedMatch?.status ?? null,
    scope,
    title,
    contextLabel,
    mapNumber,
    seriesScore:
      scope === "series" && selectedMatch
        ? { left: selectedMatch.maps_won_a, right: selectedMatch.maps_won_b }
        : null,
    confirmedMapCount: mapRows.length,
    hasConfirmedTeamResults: hasTeamResults,
    ranking,
    leaders,
    isTied: leaders.length > 1,
  };

  if (ranking.length === 0) {
    return baseMvpModel({
      ...common,
      state: hasTeamResults ? "no-player-stats" : "waiting",
      message: hasTeamResults
        ? "SIN DESGLOSE INDIVIDUAL CONFIRMADO"
        : "Esperando un mapa confirmado con estadísticas individuales.",
    });
  }

  return baseMvpModel({
    ...common,
    state: "ready",
    message: leaders.length > 1 ? "MVP EMPATADO" : "MVP CONFIRMADO",
  });
}

function championVisualKey(model) {
  return [
    model.tournamentId ?? "-",
    model.finalMatchId ?? "-",
    model.finalStatus ?? "-",
    model.champion?.id ?? "-",
    model.finalist?.id ?? "-",
    model.finalScore ? `${model.finalScore.left}-${model.finalScore.right}` : "-",
    model.champion?.roster.join("|") ?? "-",
    model.confirmedKills,
    model.seriesWins,
  ].join("::");
}

function pendingChampionModel(tournament, finalMatch = null) {
  const model = {
    state: tournament ? "pending" : "no-tournament",
    tournamentId: tournament?.id ?? null,
    tournamentName: tournament?.name ?? null,
    finalMatchId: finalMatch?.id ?? null,
    finalStatus: finalMatch?.status ?? null,
    champion: null,
    finalist: null,
    finalScore: null,
    bestOf: finalMatch?.best_of ?? null,
    seriesWins: 0,
    confirmedKills: 0,
    message: tournament
      ? "La final debe completarse antes de coronar al ganador."
      : "SIN TORNEO EN TRANSMISIÓN",
  };
  return { ...model, visualKey: championVisualKey(model) };
}

export function buildKillRaceChampionOverlay({
  tournament = null,
  teams = [],
  matches = [],
} = {}) {
  if (!tournament) return pendingChampionModel(null);
  const tournamentMatches = matches.filter(
    (match) => match.tournament_id === tournament.id
  );
  const tournamentTeams = teams.filter(
    (team) => team.tournament_id === tournament.id
  );
  const finalMatch = resolveKillRaceFinalMatch(tournamentMatches);
  const championTeam = resolveKillRaceChampionTeam({
    matches: tournamentMatches,
    teams: tournamentTeams,
  });
  if (!finalMatch || !championTeam) return pendingChampionModel(tournament, finalMatch);

  const finalistId =
    finalMatch.winner_id === finalMatch.team_a_id
      ? finalMatch.team_b_id
      : finalMatch.team_a_id;
  const finalistTeam = tournamentTeams.find((team) => team.id === finalistId) ?? null;
  if (!finalistTeam) return pendingChampionModel(tournament, finalMatch);

  const confirmedMaps = getConfirmedKillRaceMaps(tournamentMatches);
  const confirmedKills = confirmedMaps.reduce((total, { match, map }) => {
    if (match.team_a_id === championTeam.id) return total + asFiniteNumber(map.kills_a);
    if (match.team_b_id === championTeam.id) return total + asFiniteNumber(map.kills_b);
    return total;
  }, 0);
  const seriesWins = tournamentMatches.filter(
    (match) =>
      match.status === "completed" &&
      match.winner_id === championTeam.id &&
      match.team_a_id != null &&
      match.team_b_id != null
  ).length;
  const model = {
    state: "ready",
    tournamentId: tournament.id,
    tournamentName: tournament.name,
    finalMatchId: finalMatch.id,
    finalStatus: finalMatch.status,
    champion: teamView(championTeam),
    finalist: teamView(finalistTeam),
    finalScore: {
      left: asFiniteNumber(finalMatch.maps_won_a),
      right: asFiniteNumber(finalMatch.maps_won_b),
      champion:
        finalMatch.winner_id === finalMatch.team_a_id
          ? asFiniteNumber(finalMatch.maps_won_a)
          : asFiniteNumber(finalMatch.maps_won_b),
      finalist:
        finalMatch.winner_id === finalMatch.team_a_id
          ? asFiniteNumber(finalMatch.maps_won_b)
          : asFiniteNumber(finalMatch.maps_won_a),
    },
    bestOf: finalMatch.best_of,
    seriesWins,
    confirmedKills,
    message: "CAMPEÓN CORONADO",
  };
  return { ...model, visualKey: championVisualKey(model) };
}
