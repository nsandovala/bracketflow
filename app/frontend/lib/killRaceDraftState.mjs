export function getManualKillsFromMap(map) {
  if (map?.result_status !== "provisional") return {};
  return Object.fromEntries(
    (map.player_stats ?? []).map((stat) => [stat.player_id, String(stat.kills)])
  );
}

export function clearKillRaceDraft() {
  return { manualKills: {}, content: "", preview: null };
}
