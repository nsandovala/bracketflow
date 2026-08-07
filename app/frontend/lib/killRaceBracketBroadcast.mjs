function asNumber(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export const KILL_RACE_DENSE_MATCH_GAP = 10;

function normalizeId(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getVisibleMap(match) {
  const maps = [...(match.maps ?? [])].sort(
    (left, right) => asNumber(left.map_number) - asNumber(right.map_number)
  );
  const active = maps.filter(
    (map) => map.result_status === "live" || map.result_status === "provisional"
  );
  const selected = active.at(-1) ?? maps.at(-1) ?? null;
  if (!selected) return null;
  return {
    mapNumber: asNumber(selected.map_number, 1),
    status: selected.result_status ?? "pending",
    statusLabel:
      selected.result_status === "confirmed"
        ? "FINAL"
        : selected.result_status === "provisional"
          ? "PROVISIONAL"
          : selected.result_status === "live"
            ? "EN JUEGO"
            : "PENDIENTE",
    killsA: asNumber(selected.kills_a),
    killsB: asNumber(selected.kills_b),
  };
}

function getSeriesStatus({ isBroadcast, isLive, isCompleted, isFuture, isBye }) {
  if (isBye) return { statusLabel: "BYE", statusTone: "bye" };
  if (isBroadcast) return { statusLabel: "EN TRANSMISIÓN", statusTone: "broadcast" };
  if (isLive) return { statusLabel: "EN JUEGO", statusTone: "live" };
  if (isCompleted) return { statusLabel: "COMPLETADA", statusTone: "completed" };
  if (isFuture) return { statusLabel: "ESPERANDO GANADOR", statusTone: "future" };
  return { statusLabel: "PRÓXIMA", statusTone: "ready" };
}

function findChampion(rounds, matchesById) {
  const finalRound = rounds.at(-1);
  if (!finalRound || finalRound.seeds.length !== 1) return null;
  const finalSeries = finalRound.seeds[0];
  const finalMatch = matchesById.get(finalSeries.matchId);
  if (
    !finalMatch ||
    finalMatch.status !== "completed" ||
    finalMatch.winner_id == null
  ) {
    return null;
  }
  const winnerId = normalizeId(finalMatch.winner_id);
  const winner = finalSeries.teams.find((team) => normalizeId(team.id) === winnerId);
  if (!winner) return null;
  return {
    teamId: winnerId,
    name: winner.name,
    score: `${asNumber(finalMatch.maps_won_a)}–${asNumber(finalMatch.maps_won_b)}`,
    matchId: finalMatch.id,
  };
}

function getSceneState(tournament, teams, matches, champion) {
  if (!tournament) return "no-tournament";
  if (teams.length === 0 || matches.length === 0) return "tournament-prepared";
  if (champion) return "completed";
  if (matches.every((match) => match.status === "pending" || match.status === "waiting_opponent" || match.status === "ready")) {
    return "bracket-prepared";
  }
  return "active";
}

function getPhaseLabel(rounds, champion) {
  if (champion) return "TORNEO COMPLETADO";
  const activeRound = [...rounds]
    .reverse()
    .find((round) => round.seeds.some((seed) => seed.isLive || seed.isPlayable));
  return String(activeRound?.title ?? rounds[0]?.title ?? "BRACKET PREPARADO").toLocaleUpperCase("es");
}

function buildVisualKey({ tournament, matches, rounds, broadcastMatchId }) {
  const matchRows = [...matches]
    .sort((left, right) => left.id - right.id)
    .map((match) => {
      const maps = [...(match.maps ?? [])]
        .sort((left, right) => asNumber(left.map_number) - asNumber(right.map_number))
        .map(
          (map) =>
            `${map.id ?? "-"}:${map.map_number ?? "-"}:${map.result_status ?? "-"}:${map.map_winner_id ?? "-"}:${map.kills_a ?? 0}-${map.kills_b ?? 0}`
        )
        .join("/");
      return [
        match.id,
        match.round,
        match.status,
        match.team_a_id ?? "-",
        match.team_b_id ?? "-",
        match.winner_id ?? "-",
        `${match.maps_won_a ?? 0}-${match.maps_won_b ?? 0}`,
        match.next_match_id ?? "-",
        match.next_slot ?? "-",
        maps,
      ].join(":");
    })
    .join("|");
  const visibleTeams = rounds
    .flatMap((round) => round.seeds)
    .flatMap((seed) => seed.teams)
    .map((team) => `${team.id}:${team.name}:${team.score ?? "-"}`)
    .join("|");
  return [
    tournament?.id ?? "-",
    tournament?.name ?? "-",
    tournament?.status ?? "-",
    broadcastMatchId ?? "-",
    matchRows,
    visibleTeams,
  ].join("::");
}

export function getKillRaceBracketLayout({
  roundCount,
  maxMatchesInRound,
  viewportWidth,
  viewportHeight,
}) {
  const safeRounds = Math.max(1, asNumber(roundCount, 1));
  const safeMaxMatches = Math.max(1, asNumber(maxMatchesInRound, 1));
  const safeWidth = Math.max(640, asNumber(viewportWidth, 1920));
  const safeHeight = Math.max(480, asNumber(viewportHeight, 1080));
  const isShowcase = safeRounds <= 2 && safeMaxMatches <= 2;
  const isStandard = safeRounds <= 3 && safeMaxMatches <= 4;
  const cardWidth = isShowcase ? 390 : isStandard ? 342 : 304;
  const roundGap = isShowcase ? 118 : isStandard ? 82 : 58;
  const seedSlotHeight = isShowcase ? 244 : isStandard ? 146 : 116;
  const matchHeight = isShowcase ? 244 : isStandard ? 146 : 122;
  const matchGap = isShowcase || isStandard ? 0 : KILL_RACE_DENSE_MATCH_GAP;
  const verticalChrome = isShowcase || isStandard ? 48 : 76;
  const baseWidth = safeRounds * cardWidth + Math.max(0, safeRounds - 1) * roundGap + 44;
  const requiredHeight = Math.max(
    380,
    safeMaxMatches * matchHeight + Math.max(0, safeMaxMatches - 1) * matchGap + verticalChrome
  );
  const baseHeight = isShowcase || isStandard
    ? Math.max(380, safeMaxMatches * seedSlotHeight + 48)
    : requiredHeight;
  const availableWidth = Math.max(560, safeWidth - Math.max(56, safeWidth * 0.075));
  const heightReservation = !isShowcase && !isStandard && safeHeight <= 800
    ? 144
    : safeHeight <= 800
      ? 174
      : 208;
  const availableHeight = Math.max(330, safeHeight - heightReservation);
  const widthFit = availableWidth / baseWidth;
  const heightFit = availableHeight / baseHeight;
  const preferredScale = isShowcase ? 1.2 : isStandard ? (safeWidth < 1500 ? 0.9 : 1) : 0.82;
  const minimumScale = 0.72;
  const scale = Math.max(minimumScale, Math.min(preferredScale, widthFit, heightFit));
  const scaledWidth = Math.round(baseWidth * scale);
  const scaledHeight = Math.round(baseHeight * scale);

  return {
    density: isShowcase ? "showcase" : isStandard ? "standard" : "fallback",
    scale: Number(scale.toFixed(3)),
    minimumScale,
    cardWidth,
    roundGap,
    matchHeight,
    matchGap,
    requiredHeight,
    availableWidth,
    availableHeight,
    baseWidth,
    baseHeight,
    scaledWidth,
    scaledHeight,
    requestsOverflow: scaledWidth > availableWidth + 1 || scaledHeight > availableHeight + 1,
  };
}

export function buildKillRaceBracketBroadcast({
  tournament,
  matches = [],
  teams = [],
  broadcastMatchId = null,
  sourceRounds = [],
}) {
  const matchesById = new Map(matches.map((match) => [match.id, match]));
  const normalizedBroadcastId = normalizeId(broadcastMatchId);
  let broadcastWasMatched = false;

  const rounds = sourceRounds.map((round, roundIndex) => ({
    ...round,
    round: roundIndex + 1,
    roundLabel: String(round.title ?? `Ronda ${roundIndex + 1}`),
    seeds: round.seeds.map((seed) => {
      const match = matchesById.get(seed.matchId) ?? {};
      const hasLeftTeam = match.team_a_id != null;
      const hasRightTeam = match.team_b_id != null;
      const isBye = Boolean(seed.teams?.some((team) => team.isBye));
      const isCompleted = match.status === "completed" && match.winner_id != null;
      const isLive = match.status === "in_progress";
      const isBroadcast = normalizedBroadcastId !== null && match.id === normalizedBroadcastId;
      const isFuture = !isBye && (!hasLeftTeam || !hasRightTeam || match.status === "pending" || match.status === "waiting_opponent");
      const isPlayable = !isBye && hasLeftTeam && hasRightTeam && !isCompleted && !isFuture;
      const statusMeta = getSeriesStatus({ isBroadcast, isLive, isCompleted, isFuture, isBye });
      if (isBroadcast) broadcastWasMatched = true;
      return {
        ...seed,
        matchId: match.id ?? seed.matchId,
        round: match.round ?? roundIndex + 1,
        roundLabel: String(round.title ?? `Ronda ${roundIndex + 1}`),
        bestOf: match.best_of ?? seed.bestOf ?? 3,
        status: match.status ?? seed.status ?? "pending",
        statusLabel: statusMeta.statusLabel,
        statusTone: statusMeta.statusTone,
        isBroadcast,
        isLive,
        isCompleted,
        isFuture,
        isPlayable,
        isBye,
        leftTeam: seed.teams?.[0] ?? null,
        rightTeam: seed.teams?.[1] ?? null,
        mapsWonA: asNumber(match.maps_won_a),
        mapsWonB: asNumber(match.maps_won_b),
        winnerId: normalizeId(match.winner_id),
        visibleMap: getVisibleMap(match),
      };
    }),
  }));

  const allSeries = rounds.flatMap((round) => round.seeds);
  const champion = findChampion(rounds, matchesById);
  const state = getSceneState(tournament, teams, matches, champion);
  const realSeries = allSeries.filter((series) => !series.isBye);
  const resolvedBroadcastMatchId = broadcastWasMatched ? normalizedBroadcastId : null;
  const broadcastSeries =
    resolvedBroadcastMatchId === null
      ? null
      : allSeries.find((series) => series.matchId === resolvedBroadcastMatchId) ?? null;
  const maxMatchesInRound = Math.max(1, ...rounds.map((round) => round.seeds.length));

  return {
    state,
    tournamentName: tournament?.name ?? null,
    tournamentStatus: tournament?.status ?? null,
    phaseLabel: getPhaseLabel(rounds, champion),
    rounds,
    broadcastMatchId: resolvedBroadcastMatchId,
    requestedBroadcastMatchId: normalizedBroadcastId,
    broadcastSeries,
    totalSeries: realSeries.length,
    completedSeries: realSeries.filter((series) => series.isCompleted).length,
    activeSeries: realSeries.filter((series) => series.isLive).length,
    champion,
    layoutDensity:
      rounds.length <= 2 && maxMatchesInRound <= 2
        ? "showcase"
        : rounds.length <= 3 && maxMatchesInRound <= 4
          ? "standard"
          : "fallback",
    maxMatchesInRound,
    visualKey: buildVisualKey({ tournament, matches, rounds, broadcastMatchId: normalizedBroadcastId }),
  };
}
