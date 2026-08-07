export function isBracketMatchSelectable(match, mode, hasHandler) {
  return (
    mode === "operator" &&
    hasHandler &&
    match.team_a_id !== null &&
    match.team_b_id !== null &&
    match.winner_id === null &&
    match.status !== "completed" &&
    match.status !== "waiting_opponent" &&
    match.status !== "pending"
  );
}

export function getActiveBracketSeedCount(rounds, activeMatchId) {
  if (activeMatchId == null) return 0;
  return rounds.flatMap((round) => round.seeds).filter((seed) => seed.matchId === activeMatchId).length;
}

export function getBracketFitScale(contentWidth, containerWidth) {
  if (contentWidth <= 0 || containerWidth <= 0 || contentWidth <= containerWidth) return 1;
  return Math.max(0.72, containerWidth / contentWidth);
}
