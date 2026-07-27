const ROLE_LABELS = Object.freeze({
  slayer: "Slayer",
  support: "Support",
  flex: "Flex",
  igl: "IGL",
  unknown: "Sin dato",
});

const PLATFORM_LABELS = Object.freeze({
  pc: "PC",
  console: "Consola",
  unknown: "Sin dato",
});

const INPUT_LABELS = Object.freeze({
  controller: "Controller",
  keyboard_mouse: "Teclado y mouse",
  unknown: "Sin dato",
});

function normalizeName(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function uniqueNonEmpty(values) {
  const seen = new Set();
  const output = [];
  for (const value of values) {
    const text = String(value ?? "").trim();
    const key = normalizeName(text);
    if (!text || !key || seen.has(key)) continue;
    seen.add(key);
    output.push(text);
  }
  return output;
}

export function getStableMvpRanks(players) {
  const sorted = [...players].sort(
    (left, right) =>
      right.kills - left.kills ||
      right.matches - left.matches ||
      left.playerName.localeCompare(right.playerName) ||
      left.teamName.localeCompare(right.teamName)
  );
  let previousKills = null;
  let previousRank = 0;
  return sorted.map((player, index) => {
    const rank =
      previousKills === player.kills ? previousRank : index + 1;
    previousKills = player.kills;
    previousRank = rank;
    return { ...player, rank };
  });
}

export function getOfficialPlayerPerformance({
  playerName,
  teamId,
  teamName,
  results,
  mvpRank = null,
}) {
  const normalizedPlayer = normalizeName(playerName);
  const perMatch = [];
  let kills = 0;

  for (const result of results) {
    if (result.team_id !== teamId) continue;
    const matchingStats = (result.player_stats ?? []).filter(
      (stat) => normalizeName(stat.player_name) === normalizedPlayer
    );
    if (matchingStats.length === 0) continue;
    const matchKills = matchingStats.reduce(
      (total, stat) => total + stat.kills,
      0
    );
    kills += matchKills;
    perMatch.push({
      matchId: result.match_id,
      round: result.round,
      kills: matchKills,
    });
  }

  perMatch.sort(
    (left, right) =>
      left.round - right.round || left.matchId - right.matchId
  );
  const reportedMatches = perMatch.length;
  return {
    team: teamName || "Sin dato",
    kills,
    reportedMatches,
    averageKills:
      reportedMatches > 0 ? kills / reportedMatches : null,
    mvpRank,
    perMatch,
    status:
      reportedMatches > 0
        ? "Rendimiento oficial disponible"
        : "Sin player stats oficiales",
  };
}

export function createPlayerBroadcastProfileView({
  playerName,
  teamId,
  teamName,
  profile,
  gameIdentities = [],
  results = [],
  mvpRank = null,
}) {
  const profileIdentities = profile
    ? gameIdentities.filter(
        (identity) => identity.player_profile_id === profile.id
      )
    : [];
  const aliases = uniqueNonEmpty([
    profile?.short_name,
    ...profileIdentities.flatMap((identity) => [
      identity.game_handle,
      identity.game_id,
    ]),
  ]).filter(
    (alias) =>
      normalizeName(alias) !== normalizeName(profile?.display_name)
  );
  const preferredIdentity =
    profileIdentities.find(
      (identity) =>
        normalizeName(identity.game_handle) === normalizeName(playerName)
    ) ?? profileIdentities[0] ?? null;
  const hasBroadcastProfile = Boolean(
    profile &&
      [
        profile.role,
        profile.declared_kd,
        profile.declared_platform,
        profile.preferred_input,
        profile.short_bio,
        profile.social_handle,
        profile.broadcast_notes,
      ].some((value) => value !== null && value !== undefined && value !== "")
  );

  return {
    identityStatus: profile
      ? "Identidad vinculada"
      : "Identidad no vinculada",
    profileStatus: !profile
      ? "Perfil broadcast no configurado"
      : hasBroadcastProfile
        ? "Perfil declarado disponible"
        : "Perfil broadcast no configurado",
    declared: {
      displayName: profile?.display_name ?? playerName,
      gameHandle: preferredIdentity?.game_handle ?? "Sin dato",
      aliases,
      declaredKd:
        profile?.declared_kd === null ||
        profile?.declared_kd === undefined
          ? null
          : profile.declared_kd,
      declaredKdLabel:
        profile?.declared_kd === null ||
        profile?.declared_kd === undefined
          ? "Sin K/D declarado"
          : String(profile.declared_kd),
      role: ROLE_LABELS[profile?.role] ?? "Sin dato",
      platform:
        PLATFORM_LABELS[profile?.declared_platform] ?? "Sin dato",
      input: INPUT_LABELS[profile?.preferred_input] ?? "Sin dato",
      country: profile?.country || "Sin dato",
      shortBio: profile?.short_bio || "Sin dato",
      casterNote: profile?.broadcast_notes || "Sin dato",
      socialHandle: profile?.social_handle || "Sin dato",
      avatarUrl: profile?.avatar_url || null,
    },
    official: getOfficialPlayerPerformance({
      playerName,
      teamId,
      teamName,
      results,
      mvpRank,
    }),
  };
}
