// Clasifica filas extraidas por OCR contra el resolver de equipos y las
// reglas de torneo ya usadas por CSV/TXT (statsDraftImport.ts reusa el mismo
// teamResolution.mjs), sin reimplementar el matching. Nunca escribe reportes
// oficiales: solo produce el estado de revision que la UI y "Crear drafts
// válidos" consumen. Modulo plano (.mjs) a proposito: testeable directo con
// `node --test` (mismo patron que lib/playerBroadcastProfile.mjs).
import { buildTeamResolutionIndex, resolveTeamCandidate } from "./teamResolution.mjs";

export const OCR_REVIEW_STATUS_LABELS = {
  valida: "Resultado detectado",
  equipo_no_reconocido: "Equipo no reconocido",
  equipo_ambiguo: "Equipo ambiguo",
  datos_incompletos: "Datos incompletos",
  conflicto: "Conflicto / revisar",
  reporte_oficial_existente: "Reporte oficial existente",
  draft_duplicado: "Draft duplicado",
  baja_confianza: "Baja confianza",
};

// Estados que SI pueden convertirse en draft local via "Crear drafts válidos".
// El resto siempre requiere correccion humana primero.
export const OCR_REVIEW_CREATABLE_STATUSES = new Set(["valida"]);

const DEFAULT_LOW_CONFIDENCE_THRESHOLD = 0.6;

let rowKeySeed = 0;
export function createOcrCandidateKey() {
  rowKeySeed += 1;
  return `ocr-row-${Date.now()}-${rowKeySeed}`;
}

export function createOcrCandidateRow(row) {
  return {
    key: createOcrCandidateKey(),
    rawTeamName: row.rawTeamName,
    // Eleccion explicita del operador. Una vez fijada, gana siempre sobre la
    // resolucion automatica (nunca se pisa sola).
    teamOverrideId: null,
    killsInput: row.kills === null ? "" : String(row.kills),
    placementInput: row.placement === null ? "" : String(row.placement),
    playerStats: row.playerStats
      ? row.playerStats.map((stat) => ({
          playerName: stat.playerName,
          killsInput: stat.kills === null ? "" : String(stat.kills),
        }))
      : null,
    confidence: row.confidence,
    extractionWarnings: row.warnings ?? [],
    included: true,
    edited: { team: false, kills: false, placement: false, players: false },
  };
}

function parseNonNegativeInteger(value) {
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }
  if (!/^\d+$/.test(trimmed)) {
    return Number.NaN;
  }
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : Number.NaN;
}

function hasUncertainDigitWarning(warnings, field) {
  return warnings.includes(`uncertain_digit:${field}`);
}

// Evalua una fila candidata contra el estado ACTUAL del resto del lote (para
// detectar duplicados dentro de la misma extraccion) y el contexto de
// torneo/partida. Funcion pura: no muta candidate ni context.
export function evaluateOcrCandidate(candidate, context, resolutionIndex, teamIdsAlreadyValidInBatch) {
  const warnings = [...candidate.extractionWarnings];

  let team = null;
  let ambiguousCandidates = [];
  let teamBlockStatus = null;

  if (candidate.teamOverrideId !== null) {
    team = context.teams.find((item) => item.id === candidate.teamOverrideId) ?? null;
    if (!team) {
      teamBlockStatus = "equipo_no_reconocido";
      warnings.push("La selección manual de equipo ya no es válida.");
    }
  } else {
    const outcome = resolveTeamCandidate(candidate.rawTeamName, resolutionIndex);
    if (outcome.kind === "found") {
      team = outcome.team;
    } else if (outcome.kind === "ambiguous") {
      teamBlockStatus = "equipo_ambiguo";
      ambiguousCandidates = outcome.candidates.map((item) => ({ id: item.id, name: item.name }));
      warnings.push("El texto detectado coincide con más de un equipo del torneo.");
    } else if (outcome.kind === "not_found") {
      teamBlockStatus = "equipo_no_reconocido";
      warnings.push("El texto detectado no coincide con ningún equipo del torneo.");
    } else {
      teamBlockStatus = "datos_incompletos";
      warnings.push("No se detectó nombre de equipo en la imagen.");
    }
  }

  const teamName = team ? team.name : candidate.rawTeamName;

  const kills = parseNonNegativeInteger(candidate.killsInput);
  const killsInvalid = typeof kills === "number" && Number.isNaN(kills);
  if (killsInvalid) {
    warnings.push("Kills inválidas: deben ser un entero ≥ 0.");
  } else if (kills === null) {
    warnings.push("No se detectaron kills para este equipo.");
  }
  if (hasUncertainDigitWarning(candidate.extractionWarnings, "kills")) {
    warnings.push("Dígito de kills incierto: confirma el valor contra la imagen.");
  }

  let placement = null;
  let placementInvalid = false;
  if (context.usesPlacement) {
    const parsedPlacement = parseNonNegativeInteger(candidate.placementInput);
    if (parsedPlacement === null) {
      placement = null;
      placementInvalid = true;
      warnings.push("No se detectó placement para este equipo.");
    } else if (Number.isNaN(parsedPlacement) || parsedPlacement < 1) {
      placement = null;
      placementInvalid = true;
      warnings.push("Placement inválido.");
    } else if (parsedPlacement > context.effectiveLobbySize) {
      placement = null;
      placementInvalid = true;
      warnings.push(`Placement fuera del rango del lobby (1–${context.effectiveLobbySize}).`);
    } else {
      placement = parsedPlacement;
    }
    if (hasUncertainDigitWarning(candidate.extractionWarnings, "placement")) {
      warnings.push("Dígito de placement incierto: confirma el valor contra la imagen.");
    }
  } else {
    placement = "";
  }

  let playerStats = null;
  let playerStatsInvalid = false;
  if (candidate.playerStats && candidate.playerStats.length > 0) {
    const parsed = [];
    for (const player of candidate.playerStats) {
      const playerKills = parseNonNegativeInteger(player.killsInput);
      if (playerKills === null || Number.isNaN(playerKills)) {
        playerStatsInvalid = true;
        warnings.push(`Kills de ${player.playerName} inválidas o faltantes.`);
        continue;
      }
      parsed.push({ playerName: player.playerName, kills: playerKills });
    }
    if (!playerStatsInvalid) {
      playerStats = parsed;
      if (typeof kills === "number" && !killsInvalid) {
        const sum = parsed.reduce((total, player) => total + player.kills, 0);
        if (sum !== kills) {
          playerStatsInvalid = true;
          warnings.push(
            `Las kills por jugador suman ${sum} y no coinciden con las ${kills} del equipo.`
          );
        }
      }
    }
  }

  const official = team ? context.officialResults.find((r) => r.team_id === team.id) : undefined;
  const isLowConfidence =
    candidate.confidence !== null && candidate.confidence < context.lowConfidenceThreshold;
  // Un digito incierto (1 vs 7, 0 vs 8, 5 vs 6) nunca se normaliza en
  // silencio: aunque la confianza numerica sea alta, la fila baja a revision.
  const hasUncertainDigit =
    hasUncertainDigitWarning(candidate.extractionWarnings, "kills") ||
    hasUncertainDigitWarning(candidate.extractionWarnings, "placement");

  let status;
  if (teamBlockStatus) {
    status = teamBlockStatus;
  } else if (killsInvalid || placementInvalid || playerStatsInvalid || kills === null) {
    status = "datos_incompletos";
  } else if (official && team) {
    const officialMatches =
      official.kills === kills && (!context.usesPlacement || official.placement === placement);
    status = officialMatches ? "reporte_oficial_existente" : "conflicto";
  } else if (team && teamIdsAlreadyValidInBatch.has(team.id)) {
    status = "draft_duplicado";
    warnings.push("Este equipo ya aparece en otra fila válida de la misma imagen.");
  } else if (team && context.existingDraftTeamIds.has(team.id)) {
    status = "draft_duplicado";
    warnings.push("Ya existe un borrador local para este equipo en esta partida.");
  } else if (isLowConfidence || hasUncertainDigit) {
    status = "baja_confianza";
    if (isLowConfidence) {
      warnings.push("Confianza de extracción baja: revisa contra la imagen original.");
    }
  } else {
    status = "valida";
  }

  return {
    status,
    teamId: team ? team.id : null,
    teamName,
    ambiguousCandidates,
    kills: killsInvalid ? null : kills,
    placement,
    playerStats,
    warnings,
  };
}

// Evalua el lote completo de una sola pasada, para que los duplicados DENTRO
// de la misma imagen se detecten en orden (primera fila valida "gana", las
// siguientes con el mismo equipo quedan draft_duplicado).
export function evaluateOcrBatch(candidates, context) {
  const resolutionIndex = buildTeamResolutionIndex(context.teams);
  const seenValidTeamIds = new Set();
  const rows = [];

  for (const candidate of candidates) {
    const evaluation = evaluateOcrCandidate(candidate, context, resolutionIndex, seenValidTeamIds);
    if (evaluation.status === "valida" && evaluation.teamId !== null) {
      seenValidTeamIds.add(evaluation.teamId);
    }
    const team =
      evaluation.teamId !== null
        ? context.teams.find((item) => item.id === evaluation.teamId) ?? null
        : null;
    rows.push({ candidate, evaluation, team });
  }

  return rows;
}

export function getOcrLowConfidenceThreshold() {
  return DEFAULT_LOW_CONFIDENCE_THRESHOLD;
}

function toDraftPlayerStats(playerStats) {
  if (!playerStats || playerStats.length === 0) {
    return undefined;
  }
  return playerStats.map((stat) => ({ playerName: stat.playerName, kills: stat.kills }));
}

function createDraftId() {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Convierte filas revisadas + incluidas + validas en OcrDraftReport, el
// MISMO contrato que usa CSV/TXT (ver lib/ocrDraftIntake.ts /
// lib/statsDraftImport.ts). No crea un modelo de draft paralelo para OCR.
export function buildOcrDraftReports(rows, params) {
  const timestamp = new Date().toISOString();
  const creatable = rows.filter(
    (row) =>
      row.candidate.included &&
      OCR_REVIEW_CREATABLE_STATUSES.has(row.evaluation.status) &&
      row.evaluation.teamId !== null &&
      typeof row.evaluation.kills === "number"
  );

  return creatable.map((row) => {
    const noteParts = [
      `OCR imagen · ${params.imageFileName ?? "captura sin nombre"}`,
      `texto detectado: "${row.candidate.rawTeamName || "—"}"`,
    ];
    const edited = row.candidate.edited;
    if (edited.team || edited.kills || edited.placement || edited.players) {
      noteParts.push("corregido manualmente por el operador");
    }

    const playerStats = toDraftPlayerStats(row.evaluation.playerStats);

    return {
      id: createDraftId(),
      tournamentId: params.tournamentId,
      matchNumber: params.matchNumber,
      activeMatchKey: params.activeMatchKey,
      teamId: row.evaluation.teamId,
      teamName: row.evaluation.teamName,
      kills: row.evaluation.kills,
      placement: row.evaluation.placement === null ? "" : row.evaluation.placement,
      ...(playerStats ? { playerStats } : {}),
      source: "OCR_DRAFT",
      note: noteParts.join(" · "),
      status: "pending",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  });
}
