import type { Tournament, TournamentConfig, TournamentEngineKey, TournamentFormat } from "./api";

export type { TournamentConfig, TournamentEngineKey } from "./api";

export type GameKey =
  | "warzone"
  | "fortnite"
  | "valorant"
  | "csgo"
  | "fifa"
  | "custom";

export type GameMode =
  | "br"
  | "rebirth"
  | "kill_race"
  | "head_to_head"
  | "round_based"
  | "custom";

export type ScoringProfile =
  | "wsow_like"
  | "kill_race"
  | "head_to_head"
  | "rounds"
  | "custom";

export type RosterPolicy = "fixed_squad" | "roulette";

export type TournamentStructure =
  | "cumulative"
  | "single_elim"
  | "double_elim";

export type TeamSize = 1 | 2 | 3 | 4;

export type EnginePreset = {
  engineKey: TournamentEngineKey;
  label: string;
  game: "Warzone";
  format: TournamentFormat;
  scoring_profile: "wsow_like" | "kill_race";
  game_mode: "br" | "rebirth" | "kill_race" | "custom";
  roster_policy: "fixed_squad" | "roulette";
  tournament_structure: "cumulative" | "single_elim" | "double_elim";
  team_size: TeamSize;
  requiresPlacement: boolean;
  requiresUniquePlacement: boolean;
  defaultLobbySize?: number;
  supportsMatchPoint: boolean;
  defaultMatchPoint?: number;
  bestOf?: number;
  primaryView: "standings" | "bracket";
};

export const TOURNAMENT_ENGINES: Record<TournamentEngineKey, EnginePreset> = {
  wsow_br: {
    engineKey: "wsow_br",
    label: "World Series BR",
    game: "Warzone",
    format: "battle_royale_points",
    scoring_profile: "wsow_like",
    game_mode: "br",
    roster_policy: "fixed_squad",
    tournament_structure: "cumulative",
    team_size: 4,
    requiresPlacement: true,
    requiresUniquePlacement: true,
    defaultLobbySize: 50,
    supportsMatchPoint: true,
    defaultMatchPoint: 125,
    primaryView: "standings",
  },
  rebirth_ws: {
    engineKey: "rebirth_ws",
    label: "Resurgence / Rebirth WS",
    game: "Warzone",
    format: "battle_royale_points",
    scoring_profile: "wsow_like",
    game_mode: "rebirth",
    roster_policy: "fixed_squad",
    tournament_structure: "cumulative",
    team_size: 3,
    requiresPlacement: true,
    requiresUniquePlacement: true,
    defaultLobbySize: 16,
    supportsMatchPoint: true,
    defaultMatchPoint: 125,
    primaryView: "standings",
  },
  roulette_ws: {
    engineKey: "roulette_ws",
    label: "Gedeon Roulette WS",
    game: "Warzone",
    format: "battle_royale_points",
    scoring_profile: "wsow_like",
    game_mode: "rebirth",
    roster_policy: "roulette",
    tournament_structure: "cumulative",
    team_size: 3,
    requiresPlacement: true,
    requiresUniquePlacement: true,
    defaultLobbySize: 16,
    supportsMatchPoint: true,
    defaultMatchPoint: 125,
    primaryView: "standings",
  },
  kill_race_bracket: {
    engineKey: "kill_race_bracket",
    label: "Kill Race Bracket",
    game: "Warzone",
    format: "roulette_2v2",
    scoring_profile: "kill_race",
    game_mode: "kill_race",
    roster_policy: "roulette",
    tournament_structure: "single_elim",
    team_size: 2,
    requiresPlacement: false,
    requiresUniquePlacement: false,
    supportsMatchPoint: false,
    bestOf: 3,
    primaryView: "bracket",
  },
};

export const ENGINE_PRESETS = TOURNAMENT_ENGINES;
export const ENGINE_PRESET_LIST = Object.values(ENGINE_PRESETS);

export type ResolvedTournamentEngine = {
  engineKey: TournamentEngineKey;
  label: string;
  game: GameKey;
  gameMode: GameMode;
  scoringProfile: ScoringProfile;
  rosterPolicy: RosterPolicy;
  tournamentStructure: TournamentStructure;
  teamSize: TeamSize;
  usesKills: boolean;
  usesPlacement: boolean;
  requiresUniquePlacement: boolean;
  legacyFormat: TournamentFormat;
  config: TournamentConfig;
  primaryView: "standings" | "bracket";
  supportsMatchPoint: boolean;
  matchPointThreshold?: number;
  bestOf?: number;
};

function normalizeGame(value: string): GameKey {
  const normalized = value.trim().toLocaleLowerCase();
  if (normalized.includes("warzone") || normalized.includes("cod")) {
    return "warzone";
  }
  if (normalized.includes("fortnite")) {
    return "fortnite";
  }
  if (normalized.includes("valorant")) {
    return "valorant";
  }
  if (normalized.includes("cs")) {
    return "csgo";
  }
  if (normalized.includes("fifa")) {
    return "fifa";
  }
  return "custom";
}

function normalizeTeamSize(value: number): TeamSize {
  if (value === 1 || value === 2 || value === 3 || value === 4) {
    return value;
  }
  return 2;
}

function normalizeScoringProfile(value: string): ScoringProfile {
  if (
    value === "wsow_like" ||
    value === "kill_race" ||
    value === "head_to_head" ||
    value === "rounds" ||
    value === "custom"
  ) {
    return value;
  }
  return "custom";
}

function readConfig(tournament: Tournament): TournamentConfig {
  const maybeConfig = (tournament as Tournament & { config?: unknown }).config;
  if (!maybeConfig || typeof maybeConfig !== "object") {
    return {};
  }

  const config = maybeConfig as Record<string, unknown>;
  const lobbySize = config.lobbySize;
  const teamSize = config.teamSize;
  const bestOf = config.bestOf;
  const matchPointThreshold = config.matchPointThreshold;
  const rouletteTeamSize = config.rouletteTeamSize;
  const rouletteBench = config.rouletteBench;
  const rawEngineKey =
    config.engine_key === "wsow_classic" ? "wsow_br" : config.engine_key;
  return {
    engine_key:
      typeof rawEngineKey === "string" && rawEngineKey in ENGINE_PRESETS
        ? (rawEngineKey as TournamentEngineKey)
        : undefined,
    game_mode:
      config.game_mode === "br" ||
      config.game_mode === "rebirth" ||
      config.game_mode === "kill_race" ||
      config.game_mode === "custom"
        ? config.game_mode
        : undefined,
    roster_policy:
      config.roster_policy === "fixed_squad" || config.roster_policy === "roulette"
        ? config.roster_policy
        : undefined,
    tournament_structure:
      config.tournament_structure === "cumulative" ||
      config.tournament_structure === "single_elim" ||
      config.tournament_structure === "double_elim"
        ? config.tournament_structure
        : undefined,
    lobbySize:
      typeof lobbySize === "number" && Number.isFinite(lobbySize) ? lobbySize : undefined,
    bracketMode:
      config.bracketMode === "single_elim" || config.bracketMode === "double_elim"
        ? config.bracketMode
        : undefined,
    teamSize:
      teamSize === 1 || teamSize === 2 || teamSize === 3 || teamSize === 4
        ? teamSize
        : undefined,
    bestOf:
      typeof bestOf === "number" && Number.isFinite(bestOf) && bestOf > 0
        ? bestOf
        : undefined,
    matchPointThreshold:
      typeof matchPointThreshold === "number" &&
      Number.isFinite(matchPointThreshold) &&
      matchPointThreshold > 0
        ? matchPointThreshold
        : undefined,
    rouletteGeneratedAt:
      typeof config.rouletteGeneratedAt === "string" ? config.rouletteGeneratedAt : undefined,
    rouletteSeed:
      typeof config.rouletteSeed === "string" ? config.rouletteSeed : undefined,
    rouletteTeamSize:
      rouletteTeamSize === 1 ||
      rouletteTeamSize === 2 ||
      rouletteTeamSize === 3 ||
      rouletteTeamSize === 4
        ? rouletteTeamSize
        : undefined,
    rouletteBench: Array.isArray(rouletteBench)
      ? rouletteBench.filter((value): value is string => typeof value === "string")
      : undefined,
    rouletteStatus:
      config.rouletteStatus === "generated" || config.rouletteStatus === "confirmed"
        ? config.rouletteStatus
        : undefined,
  };
}

function readEngineKey(
  tournament: Tournament,
  config: TournamentConfig
): TournamentEngineKey | undefined {
  const directEngineKey = (tournament as Record<string, unknown>).engine_key;
  if (directEngineKey === "wsow_classic") {
    return "wsow_br";
  }
  if (typeof directEngineKey === "string" && directEngineKey in ENGINE_PRESETS) {
    return directEngineKey as TournamentEngineKey;
  }
  return config.engine_key === "wsow_classic" ? "wsow_br" : config.engine_key;
}

function resolveFromPreset(
  tournament: Tournament,
  preset: EnginePreset,
  config: TournamentConfig
): ResolvedTournamentEngine {
  return {
    engineKey: preset.engineKey,
    label: preset.label,
    game: normalizeGame(tournament.game || preset.game),
    gameMode: config.game_mode ?? preset.game_mode,
    scoringProfile: normalizeScoringProfile(tournament.scoring_profile || preset.scoring_profile),
    rosterPolicy: config.roster_policy ?? preset.roster_policy,
    tournamentStructure: config.tournament_structure ?? preset.tournament_structure,
    teamSize: normalizeTeamSize(config.teamSize ?? tournament.team_size ?? preset.team_size),
    usesKills: true,
    usesPlacement: preset.requiresPlacement,
    requiresUniquePlacement: preset.requiresUniquePlacement,
    legacyFormat: tournament.format,
    config,
    primaryView: preset.primaryView,
    supportsMatchPoint: preset.supportsMatchPoint,
    matchPointThreshold: config.matchPointThreshold ?? preset.defaultMatchPoint,
    bestOf: config.bestOf ?? preset.bestOf,
  };
}

export function resolveTournamentEngine(
  tournament: Tournament
): ResolvedTournamentEngine {
  const game = normalizeGame(tournament.game);
  const config = readConfig(tournament);
  const engineKey = readEngineKey(tournament, config);

  if (engineKey) {
    return resolveFromPreset(tournament, ENGINE_PRESETS[engineKey], config);
  }

  if (tournament.format === "battle_royale_points") {
    return {
      engineKey: "wsow_br",
      label: ENGINE_PRESETS.wsow_br.label,
      game,
      gameMode: "br",
      scoringProfile: normalizeScoringProfile(tournament.scoring_profile),
      rosterPolicy: "fixed_squad",
      tournamentStructure: "cumulative",
      teamSize: normalizeTeamSize(tournament.team_size),
      usesKills: true,
      usesPlacement: true,
      requiresUniquePlacement: true,
      legacyFormat: tournament.format,
      config,
      primaryView: "standings",
      supportsMatchPoint: true,
      matchPointThreshold: config.matchPointThreshold ?? ENGINE_PRESETS.wsow_br.defaultMatchPoint,
    };
  }

  if (tournament.format === "roulette_2v2" || tournament.format === "roulette_3v3") {
    return {
      engineKey: "kill_race_bracket",
      label: ENGINE_PRESETS.kill_race_bracket.label,
      game,
      gameMode: "kill_race",
      scoringProfile: normalizeScoringProfile(tournament.scoring_profile),
      rosterPolicy: "roulette",
      tournamentStructure: "single_elim",
      teamSize: tournament.format === "roulette_3v3" ? 3 : 2,
      usesKills: true,
      usesPlacement: false,
      requiresUniquePlacement: false,
      legacyFormat: tournament.format,
      config,
      primaryView: "bracket",
      supportsMatchPoint: false,
      bestOf: config.bestOf ?? ENGINE_PRESETS.kill_race_bracket.bestOf,
    };
  }

  return {
    engineKey: "kill_race_bracket",
    label: ENGINE_PRESETS.kill_race_bracket.label,
    game,
    gameMode: "kill_race",
    scoringProfile: normalizeScoringProfile(tournament.scoring_profile),
    rosterPolicy: "fixed_squad",
    tournamentStructure: "single_elim",
    teamSize: normalizeTeamSize(tournament.team_size),
    usesKills: true,
    usesPlacement: false,
    requiresUniquePlacement: false,
    legacyFormat: tournament.format,
    config,
    primaryView: "bracket",
    supportsMatchPoint: false,
    bestOf: config.bestOf ?? ENGINE_PRESETS.kill_race_bracket.bestOf,
  };
}

export function isOperatorSupportedTournament(tournament: Tournament) {
  const config = readConfig(tournament);
  if (readEngineKey(tournament, config)) {
    return true;
  }

  return (
    tournament.format === "battle_royale_points" ||
    tournament.format === "roulette_2v2" ||
    tournament.format === "roulette_3v3"
  );
}

export function getEffectiveLobbySize(
  engine: ResolvedTournamentEngine,
  totalTeams: number
) {
  return engine.config.lobbySize ?? ENGINE_PRESETS[engine.engineKey].defaultLobbySize ?? totalTeams;
}

export function getMissingReportsMessage(
  missingCount: number,
  roundNumber: number
) {
  return `Faltan ${missingCount} reportes para cerrar la Partida ${roundNumber}.`;
}
