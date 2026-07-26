export const CASTER_CONTEXT_KEYS = Object.freeze([
  "leader",
  "kills",
  "mvp",
  "definition",
  "matches",
]);

export function getDefaultCasterContext(standingsCount, resultsCount) {
  if (standingsCount > 0) return "leader";
  if (resultsCount > 0) return "matches";
  return "definition";
}

export function createCasterInspectorSelection(
  tournamentId,
  standingsCount,
  resultsCount
) {
  return {
    tournamentId,
    selected: getDefaultCasterContext(standingsCount, resultsCount),
  };
}

export function reconcileCasterInspectorSelection(
  current,
  tournamentId,
  standingsCount,
  resultsCount
) {
  if (current.tournamentId === tournamentId) return current;
  return createCasterInspectorSelection(
    tournamentId,
    standingsCount,
    resultsCount
  );
}

export function toggleCasterInspectorContext(current, contextKey) {
  if (!CASTER_CONTEXT_KEYS.includes(contextKey)) {
    throw new Error(`Unknown Caster context: ${contextKey}`);
  }
  return {
    ...current,
    selected: current.selected === contextKey ? null : contextKey,
  };
}

export function getMatchPointDefinitionSummary({
  policy,
  status,
  isBracket,
  bracketChampionLabel,
  tournamentCompleted,
}) {
  let label = isBracket ? "Serie abierta" : "Competencia abierta";
  if (status.state === "champion" || bracketChampionLabel) {
    label = "Campeón confirmado";
  }
  else if (tournamentCompleted) label = "Campeón confirmado";
  else if (status.state === "threshold_reached") {
    label = status.reason === "tie" ? "Empate sin resolver" : "Umbral alcanzado";
  } else if (policy?.state === "match_point_not_configured") {
    label = "Match Point no configurado";
  } else if (policy?.state === "disabled") {
    label = "Match Point desactivado";
  } else if (policy?.state === "unsupported") {
    label = "Motor sin Match Point";
  }

  const threshold = policy?.matchPointThreshold ?? null;
  const detail =
    policy?.state === "match_point_not_configured"
      ? "Requiere configuración persistida"
      : policy?.state === "disabled"
        ? "Desactivado explícitamente"
        : policy?.state === "unsupported"
          ? "Motor sin Match Point"
          : threshold
            ? `Umbral configurado: ${threshold} pts`
            : "Política pendiente";

  return {
    label,
    detail,
    threshold,
    reason: policy?.reason ?? null,
  };
}
