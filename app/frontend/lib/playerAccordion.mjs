export function togglePlayerAccordionSelection(currentKey, requestedKey) {
  return currentKey === requestedKey ? null : requestedKey;
}

export function getInlinePlayerRenderOrder(playerKeys, selectedPlayerKey) {
  return playerKeys.flatMap((key) => [
    { type: "row", key },
    ...(key === selectedPlayerKey ? [{ type: "detail", key }] : []),
  ]);
}

export function getTournamentScopedPlayerSelection(
  selectedPlayerKey,
  selectedTournamentId,
  tournamentId
) {
  return selectedTournamentId === tournamentId ? selectedPlayerKey : null;
}
