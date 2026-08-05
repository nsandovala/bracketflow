export function resolveStreamSurface(layout, { isKillRace, isBracket }) {
  if (layout === "scorebug") return isKillRace ? "scorebug" : "unsupported-scorebug";
  if (layout === "intermission") {
    return isKillRace === false ? "unsupported-intermission" : "intermission";
  }
  if (layout === "bracket" && isKillRace === null) return "bracket";
  if (isBracket && (layout === "full" || layout === "bracket")) return "bracket";
  return "standings";
}

export function getCompatibleOverlayLayouts({ isKillRace, supportsMatchPoint }) {
  if (isKillRace) return ["scorebug", "intermission", "bracket"];
  return ["sidebar", "lower-third", ...(supportsMatchPoint ? ["matchpoint"] : []), "mvp", "leaderboard"];
}

export function resolveBracketPresentation(scoringProfile) {
  return scoringProfile === null || scoringProfile === "kill_race"
    ? "kill-race-broadcast"
    : "bracket-view";
}
