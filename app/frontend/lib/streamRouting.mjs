export function resolveStreamSurface(layout, { isKillRace, isBracket }) {
  if (layout === "scorebug") return isKillRace ? "scorebug" : "unsupported-scorebug";
  if (isBracket && (layout === "full" || layout === "bracket")) return "bracket";
  return "standings";
}

export function getCompatibleOverlayLayouts({ isKillRace, supportsMatchPoint }) {
  if (isKillRace) return ["scorebug", "bracket"];
  return ["sidebar", "lower-third", ...(supportsMatchPoint ? ["matchpoint"] : []), "mvp", "leaderboard"];
}
