import { TournamentFormat } from "./api";

export type TournamentMode =
  | "classic-bracket"
  | "kill-race-2v2"
  | "kill-race-3v3"
  | "world-series";

export type HubMode = TournamentMode | "league-round-robin";

export type ScoringField = "kills" | "placement";

export type HubModeOption = {
  id: HubMode;
  label: string;
  description: string;
  backendFormat?: TournamentFormat;
  disabled?: boolean;
  comingSoonLabel?: string;
};

export type PrimaryActionState = {
  playersCount: number;
  teamsCount: number;
  roundsCount: number;
  activeMatchComplete: boolean;
  hasLeaderboard: boolean;
  hasBracket: boolean;
};

export const HUB_MODE_OPTIONS: HubModeOption[] = [
  {
    id: "classic-bracket",
    label: "Bracket clasico",
    description: "Llaves, cruces y ganador.",
    backendFormat: "single_elimination",
  },
  {
    id: "kill-race-2v2",
    label: "Kill Race 2v2",
    description: "Parejas aleatorias y puntos por kills.",
    backendFormat: "roulette_2v2",
  },
  {
    id: "kill-race-3v3",
    label: "Kill Race 3v3",
    description: "Trios aleatorios y puntos por kills.",
    backendFormat: "roulette_3v3",
  },
  {
    id: "world-series",
    label: "World Series",
    description: "Rondas, kills, placement y leaderboard acumulado.",
    backendFormat: "battle_royale_points",
  },
  {
    id: "league-round-robin",
    label: "Liga / Round Robin",
    description: "Todos contra todos, calendario y tabla.",
    disabled: true,
    comingSoonLabel: "Proximamente",
  },
];

export function getTournamentMode(format: TournamentFormat): TournamentMode {
  switch (format) {
    case "roulette_2v2":
      return "kill-race-2v2";
    case "roulette_3v3":
      return "kill-race-3v3";
    case "battle_royale_points":
      return "world-series";
    default:
      return "classic-bracket";
  }
}

export function getModeLabel(format: TournamentFormat) {
  return HUB_MODE_OPTIONS.find((option) => option.backendFormat === format)?.label ?? format;
}

export function isKillRaceFormat(
  format: TournamentFormat
): format is "roulette_2v2" | "roulette_3v3" {
  return format === "roulette_2v2" || format === "roulette_3v3";
}

export function isWorldSeriesFormat(format: TournamentFormat) {
  return format === "battle_royale_points";
}

export function getDefaultTeamSize(format: TournamentFormat) {
  return format === "roulette_3v3" ? 3 : 2;
}

export function getRequiredPlayers(format: TournamentFormat) {
  if (format === "roulette_2v2") {
    return 4;
  }
  if (format === "roulette_3v3") {
    return 6;
  }
  return 0;
}

export function getRequiredTeams(format: TournamentFormat) {
  if (format === "single_elimination") {
    return 2;
  }
  if (format === "battle_royale_points") {
    return 1;
  }
  return 0;
}

export function getScoringFields(mode: TournamentMode): ScoringField[] {
  if (mode === "world-series") {
    return ["kills", "placement"];
  }
  if (mode === "kill-race-2v2" || mode === "kill-race-3v3") {
    return ["kills"];
  }
  return [];
}

export function getPrimaryAction(mode: TournamentMode, state: PrimaryActionState) {
  if (mode === "classic-bracket") {
    if (state.teamsCount < 1) {
      return "Anadir equipos";
    }
    if (!state.hasBracket) {
      return "Generar bracket";
    }
    return "Ver cruces";
  }

  if (mode === "kill-race-2v2" || mode === "kill-race-3v3") {
    const requiredPlayers = mode === "kill-race-3v3" ? 6 : 4;
    if (state.playersCount < requiredPlayers) {
      return "Anadir jugadores";
    }
    if (state.teamsCount === 0) {
      return mode === "kill-race-3v3" ? "Sortear trios" : "Sortear parejas";
    }
    if (state.roundsCount === 0) {
      return "Crear ronda";
    }
    if (!state.activeMatchComplete) {
      return "Cargar kills";
    }
    return "Ver ranking";
  }

  if (state.teamsCount < 1) {
    return "Anadir equipos";
  }
  if (state.roundsCount === 0) {
    return "Crear ronda";
  }
  if (!state.activeMatchComplete) {
    return "Cargar kills + placement";
  }
  if (!state.hasLeaderboard) {
    return "Actualizar leaderboard";
  }
  return "Ver leaderboard";
}

export function getRequiredParticipantsLabel(format: TournamentFormat) {
  if (format === "roulette_2v2") {
    return "4 jugadores minimo";
  }
  if (format === "roulette_3v3") {
    return "6 jugadores minimo";
  }
  if (format === "battle_royale_points") {
    return "Equipos reales";
  }
  return "2 equipos minimo";
}

export function getKillRaceGroupLabel(format: "roulette_2v2" | "roulette_3v3") {
  return format === "roulette_3v3" ? "trios" : "parejas";
}

export function getKillRaceDrawLabel(format: "roulette_2v2" | "roulette_3v3") {
  return format === "roulette_3v3" ? "Sortear trios" : "Sortear parejas";
}

export function getKillRaceCounter(
  format: "roulette_2v2" | "roulette_3v3",
  playersCount: number
) {
  return `Jugadores ${playersCount}/${getRequiredPlayers(format)}`;
}

export function getKillRaceMissingText(
  format: "roulette_2v2" | "roulette_3v3",
  missingPlayers: number
) {
  return format === "roulette_3v3"
    ? `Faltan ${missingPlayers} jugadores para sortear trios.`
    : `Faltan ${missingPlayers} jugadores para sortear parejas.`;
}

export function getModeRule(format: TournamentFormat) {
  if (format === "battle_royale_points") {
    return "1 kill = 1 punto · placement entrega bonus.";
  }
  if (isKillRaceFormat(format)) {
    return "Kill race: el ranking prioriza kills.";
  }
  return "Llaves de eliminacion directa.";
}

export function formatPoints(totalPoints: number, format: TournamentFormat) {
  return isWorldSeriesFormat(format) ? totalPoints.toFixed(1) : String(Math.round(totalPoints));
}

// Tabla oficial WSOW por bandas — DEBE mantenerse sincronizada con
// backend/app/crud.py (WSOW_PLACEMENT_BANDS / get_placement_multiplier).
// 1 punto por kill x multiplicador por banda de placement.
const WSOW_PLACEMENT_BANDS: ReadonlyArray<readonly [number, number]> = [
  [1, 2.0], // 1°
  [5, 1.8], // 2°-5°
  [10, 1.6], // 6°-10°
  [20, 1.4], // 11°-20°
  [35, 1.2], // 21°-35°
];
const WSOW_MIN_MULTIPLIER = 1.0; // 36°+ — clamp: jamas 0 ni negativo
const REBIRTH_PLACEMENT_BANDS: ReadonlyArray<readonly [number, number]> = [
  [1, 1.6],
  [5, 1.4],
  [10, 1.2],
];
const REBIRTH_MIN_MULTIPLIER = 1.0;

export function getPlacementMultiplier(placement: number): number {
  for (const [maxPlace, multiplier] of WSOW_PLACEMENT_BANDS) {
    if (placement <= maxPlace) {
      return multiplier;
    }
  }
  return WSOW_MIN_MULTIPLIER;
}

export function getRebirthPlacementMultiplier(placement: number): number {
  for (const [maxPlace, multiplier] of REBIRTH_PLACEMENT_BANDS) {
    if (placement <= maxPlace) {
      return multiplier;
    }
  }
  return REBIRTH_MIN_MULTIPLIER;
}

export function estimateWorldSeriesPoints(
  killsValue: string,
  placementValue: string,
  gameMode: "br" | "rebirth" = "br"
) {
  const kills = Number(killsValue);
  const placement = Number(placementValue);

  if (!Number.isFinite(kills) || kills < 0 || !Number.isFinite(placement) || placement < 1) {
    return null;
  }

  const multiplier =
    gameMode === "rebirth"
      ? getRebirthPlacementMultiplier(placement)
      : getPlacementMultiplier(placement);
  return (Math.round(kills * multiplier * 10) / 10).toFixed(1);
}
