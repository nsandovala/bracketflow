const EMPTY_SCORE = Object.freeze({ left: 0, right: 0 });

function teamView(team) {
  return team ? { id: team.id, name: team.name } : null;
}

function sortMaps(maps = []) {
  return [...maps].sort(
    (left, right) =>
      (left.map_number ?? 0) - (right.map_number ?? 0) || (left.id ?? 0) - (right.id ?? 0)
  );
}

function mapView(map, match, teams, label) {
  if (!map || !match) return null;
  const isConfirmed = map.result_status === "confirmed";
  const winner = isConfirmed
    ? teams.find((team) => team.id === map.map_winner_id) ?? null
    : null;
  const players = map.player_stats ?? [];
  return {
    mapNumber: map.map_number,
    label,
    status: map.result_status,
    killsLeft: map.kills_a,
    killsRight: map.kills_b,
    winnerName: winner?.name ?? null,
    winnerSide:
      isConfirmed && map.map_winner_id === match.team_a_id
        ? "left"
        : isConfirmed && map.map_winner_id === match.team_b_id
          ? "right"
          : null,
    leftPlayers: players
      .filter((player) => player.side === "left")
      .slice(0, 2)
      .map((player) => ({
        playerId: player.player_id,
        nickname: player.player_name,
        kills: player.kills,
      })),
    rightPlayers: players
      .filter((player) => player.side === "right")
      .slice(0, 2)
      .map((player) => ({
        playerId: player.player_id,
        nickname: player.player_name,
        kills: player.kills,
      })),
  };
}

function getChampion(tournament, teams, killRaceCasterState) {
  const casterChampion = killRaceCasterState?.champion ?? null;
  if (casterChampion) return casterChampion;
  const configuredChampionId = tournament?.config?.championTeamId;
  return teams.find((team) => team.id === configuredChampionId) ?? null;
}

function getFinalMatch(matches, championId) {
  return (
    [...matches]
      .filter(
        (match) =>
          match.winner_id === championId &&
          (match.next_match_id === null || match.status === "completed")
      )
      .sort((left, right) => left.round - right.round || left.id - right.id)
      .at(-1) ?? null
  );
}

function rosterIndex(team, playerId) {
  const index = (team?.members ?? []).findIndex(
    (member) => member.player_id === playerId || member.player?.id === playerId
  );
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function getConfirmedMapFeature(map, match, leftTeam, rightTeam) {
  if (!map || map.result_status !== "confirmed" || !match) {
    return { featuredPlayer: null, featuredTiedPlayers: [], featuredIsTied: false };
  }

  const candidates = (map.player_stats ?? [])
    .filter((player) => Number.isFinite(player.kills))
    .map((player) => {
      const team = player.side === "left" ? leftTeam : rightTeam;
      return {
        playerId: player.player_id,
        nickname: player.player_name,
        teamId: team?.id ?? null,
        teamName: team?.name ?? "Equipo sin identificar",
        side: player.side,
        confirmedKills: player.kills,
        confirmedMaps: 1,
        averageKills: null,
        isMvp: false,
        rosterIndex: rosterIndex(team, player.player_id),
      };
    });
  if (candidates.length === 0) {
    return { featuredPlayer: null, featuredTiedPlayers: [], featuredIsTied: false };
  }

  const maximumKills = Math.max(...candidates.map((player) => player.confirmedKills));
  const winnerSide =
    map.map_winner_id === match.team_a_id
      ? "left"
      : map.map_winner_id === match.team_b_id
        ? "right"
        : null;
  const tiedPlayers = candidates
    .filter((player) => player.confirmedKills === maximumKills)
    .sort(
      (left, right) =>
        Number(right.side === winnerSide) - Number(left.side === winnerSide) ||
        left.rosterIndex - right.rosterIndex ||
        left.playerId - right.playerId ||
        left.nickname.localeCompare(right.nickname)
    )
    .map((player) => ({
      playerId: player.playerId,
      nickname: player.nickname,
      teamId: player.teamId,
      teamName: player.teamName,
      confirmedKills: player.confirmedKills,
      confirmedMaps: player.confirmedMaps,
      averageKills: player.averageKills,
      isMvp: player.isMvp,
    }));

  return {
    featuredPlayer: tiedPlayers[0] ?? null,
    featuredTiedPlayers: tiedPlayers,
    featuredIsTied: tiedPlayers.length > 1,
  };
}

function getTournamentFeaturedPlayer(killRaceCasterState) {
  const player = killRaceCasterState?.mvp?.[0] ?? null;
  if (!player) return null;
  return {
    playerId: player.playerId,
    nickname: player.nickname,
    teamId: player.teamId,
    teamName: player.teamName,
    confirmedKills: player.confirmedKills,
    confirmedMaps: player.confirmedMapCount,
    averageKills: Number.isFinite(player.averageKills) ? player.averageKills : null,
    isMvp: true,
  };
}

function visualKey({
  tournament,
  match,
  state,
  mapNumber,
  seriesScore,
  seriesWinner,
  champion,
  featuredTiedPlayers,
}) {
  const featuredSignature = featuredTiedPlayers
    .map((player) => `${player.playerId}:${player.confirmedKills}`)
    .join(",");
  return [
    tournament?.id ?? "-",
    match?.id ?? "-",
    state,
    mapNumber ?? "-",
    `${seriesScore.left}-${seriesScore.right}`,
    seriesWinner?.id ?? "-",
    champion?.id ?? "-",
    featuredSignature || "-",
  ].join(":");
}

function baseViewModel({
  state,
  tournament,
  match,
  leftTeam,
  rightTeam,
  mapNumber = null,
  nextMapNumber = null,
  seriesScore = EMPTY_SCORE,
  lastConfirmedMap = null,
  currentProvisional = null,
  featuredPlayer = null,
  featuredTiedPlayers = [],
  featuredIsTied = false,
  seriesWinner = null,
  champion = null,
  title,
  headerMeta,
  message,
  detailMessage = null,
  featureLabel = null,
  featuredEmptyMessage = null,
  winnerAnnouncement = null,
  heroVariant = "matchup",
}) {
  return {
    state,
    tournamentName: tournament?.name ?? null,
    matchId: match?.id ?? null,
    mapNumber,
    nextMapNumber,
    bestOf: match?.best_of ?? null,
    leftTeam: teamView(leftTeam),
    rightTeam: teamView(rightTeam),
    seriesScore,
    lastConfirmedMap,
    currentProvisional,
    featuredPlayer,
    featuredTiedPlayers,
    featuredIsTied,
    seriesWinner: teamView(seriesWinner),
    champion: teamView(champion),
    title,
    headerMeta,
    message,
    detailMessage,
    featureLabel,
    featuredEmptyMessage,
    winnerAnnouncement,
    heroVariant,
    visualKey: visualKey({
      tournament,
      match,
      state,
      mapNumber,
      seriesScore,
      seriesWinner,
      champion,
      featuredTiedPlayers,
    }),
  };
}

export function buildKillRaceIntermission({
  tournament = null,
  broadcastChannel = null,
  broadcastMatch = null,
  teams = [],
  matches = [],
  killRaceCasterState = null,
} = {}) {
  const hasChannelWithoutTournament =
    broadcastChannel !== null && broadcastChannel.activeTournamentId === null;
  if (!tournament || hasChannelWithoutTournament) {
    return baseViewModel({
      state: "NO_TOURNAMENT",
      tournament: null,
      match: null,
      leftTeam: null,
      rightTeam: null,
      title: "SIN TORNEO EN TRANSMISIÓN",
      headerMeta: "ARENA PREPARADA",
      message: "La arena está lista.",
      detailMessage: "Selecciona un torneo desde Operator.",
      heroVariant: "empty",
    });
  }

  const champion = getChampion(tournament, teams, killRaceCasterState);
  const tournamentIsComplete = Boolean(
    champion &&
      (tournament.status === "completed" || tournament.bracket_status === "completed")
  );
  const finalMatch = tournamentIsComplete ? getFinalMatch(matches, champion.id) : null;
  const tournamentMatch =
    tournamentIsComplete && broadcastMatch?.winner_id === champion.id
      ? broadcastMatch
      : finalMatch;

  if (tournamentIsComplete) {
    const finalMaps = sortMaps(tournamentMatch?.maps).filter(
      (map) => map.result_status === "confirmed"
    );
    const lastMap = finalMaps.at(-1) ?? null;
    const leftTeam = teams.find((team) => team.id === tournamentMatch?.team_a_id) ?? null;
    const rightTeam = teams.find((team) => team.id === tournamentMatch?.team_b_id) ?? null;
    const seriesScore = tournamentMatch
      ? { left: tournamentMatch.maps_won_a, right: tournamentMatch.maps_won_b }
      : { left: null, right: null };
    return baseViewModel({
      state: "TOURNAMENT_COMPLETE",
      tournament,
      match: tournamentMatch,
      leftTeam,
      rightTeam,
      mapNumber: lastMap?.map_number ?? null,
      seriesScore,
      lastConfirmedMap: mapView(lastMap, tournamentMatch, teams, "ÚLTIMO MAPA"),
      featuredPlayer: getTournamentFeaturedPlayer(killRaceCasterState),
      champion,
      seriesWinner: champion,
      title: "CAMPEÓN CORONADO",
      headerMeta: "TORNEO FINALIZADO",
      message: "Torneo finalizado",
      featureLabel: "MVP DEL TORNEO",
      featuredEmptyMessage: "Sin desglose individual",
      winnerAnnouncement: "Campeón de Bracketflow Arena",
      heroVariant: "champion",
    });
  }

  if (!broadcastMatch || broadcastMatch.tournament_id !== tournament.id) {
    return baseViewModel({
      state: "NO_MATCH",
      tournament,
      match: null,
      leftTeam: null,
      rightTeam: null,
      title: "TORNEO PREPARADO",
      headerMeta: "SIN SERIE AL AIRE",
      message: "Selecciona una serie y envíala a transmisión.",
      heroVariant: "empty",
    });
  }

  const leftTeam = teams.find((team) => team.id === broadcastMatch.team_a_id) ?? null;
  const rightTeam = teams.find((team) => team.id === broadcastMatch.team_b_id) ?? null;
  const sortedMaps = sortMaps(broadcastMatch.maps);
  const confirmedMaps = sortedMaps.filter((map) => map.result_status === "confirmed");
  const provisionalMap = sortedMaps
    .filter((map) => map.result_status === "provisional")
    .at(-1) ?? null;
  const lastConfirmed = confirmedMaps.at(-1) ?? null;
  const seriesScore = {
    left: broadcastMatch.maps_won_a,
    right: broadcastMatch.maps_won_b,
  };
  const seriesWinner =
    teams.find((team) => team.id === broadcastMatch.winner_id) ?? null;
  const seriesIsComplete = Boolean(
    seriesWinner && broadcastMatch.status === "completed"
  );
  const confirmedMapFeature = getConfirmedMapFeature(
    lastConfirmed,
    broadcastMatch,
    leftTeam,
    rightTeam
  );

  if (provisionalMap && !seriesIsComplete) {
    return baseViewModel({
      state: "PROVISIONAL_REVIEW",
      tournament,
      match: broadcastMatch,
      leftTeam,
      rightTeam,
      mapNumber: provisionalMap.map_number,
      nextMapNumber: provisionalMap.map_number,
      seriesScore,
      lastConfirmedMap: mapView(lastConfirmed, broadcastMatch, teams, "ÚLTIMO MAPA"),
      currentProvisional: mapView(
        provisionalMap,
        broadcastMatch,
        teams,
        `PARTIDA ${provisionalMap.map_number} · PROVISIONAL`
      ),
      ...confirmedMapFeature,
      title: "RESULTADO EN REVISIÓN",
      headerMeta: `PARTIDA ${provisionalMap.map_number} · BO${broadcastMatch.best_of}`,
      message: "Pendiente de confirmación oficial",
      detailMessage: "PROVISIONAL",
    });
  }

  if (seriesIsComplete) {
    return baseViewModel({
      state: "SERIES_COMPLETE",
      tournament,
      match: broadcastMatch,
      leftTeam,
      rightTeam,
      mapNumber: lastConfirmed?.map_number ?? null,
      seriesScore,
      lastConfirmedMap: mapView(lastConfirmed, broadcastMatch, teams, "ÚLTIMO MAPA"),
      ...confirmedMapFeature,
      seriesWinner,
      title: "SERIE FINALIZADA",
      headerMeta: "SERIE FINALIZADA",
      message: "Esperando próximo enfrentamiento",
      featureLabel: "JUGADOR DESTACADO",
      featuredEmptyMessage: "Sin desglose individual",
      winnerAnnouncement: `${seriesWinner.name} avanza`,
    });
  }

  if (confirmedMaps.length === 0) {
    return baseViewModel({
      state: "UPCOMING",
      tournament,
      match: broadcastMatch,
      leftTeam,
      rightTeam,
      mapNumber: 1,
      nextMapNumber: 1,
      seriesScore,
      title: "PRÓXIMO ENFRENTAMIENTO",
      headerMeta: `PARTIDA 1 · BO${broadcastMatch.best_of}`,
      message: "Preparando la arena",
    });
  }

  const nextMapNumber = (lastConfirmed?.map_number ?? 0) + 1;
  return baseViewModel({
    state: "BETWEEN_MAPS",
    tournament,
    match: broadcastMatch,
    leftTeam,
    rightTeam,
    mapNumber: lastConfirmed?.map_number ?? null,
    nextMapNumber,
    seriesScore,
    lastConfirmedMap: mapView(lastConfirmed, broadcastMatch, teams, "ÚLTIMO MAPA"),
    ...confirmedMapFeature,
    title: `PREPARANDO PARTIDA ${nextMapNumber}`,
    headerMeta: `PARTIDA ${nextMapNumber} · BO${broadcastMatch.best_of}`,
    message: "Siguiente partida en breve",
    featureLabel: "JUGADOR DESTACADO",
    featuredEmptyMessage: "Sin desglose individual",
  });
}
