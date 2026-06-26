import { Tournament, TournamentFormat } from "./api";

export type GameKey =
  | "warzone"
  | "fortnite"
  | "valorant"
  | "csgo"
  | "fifa"
  | "custom";

export type TournamentEngineKey =
  | "wsow_classic"
  | "rebirth_ws"
  | "roulette_ws"
  | "kill_race_bracket";

export type GameMode =
  | "br"
  | "rebirth"
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

export type TournamentConfig = {
  lobbySize?: number;
};

export type ResolvedTournamentEngine = {
  engineKey: TournamentEngineKey;
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

function readConfig(tournament: Tournament): TournamentConfig {
  const maybeConfig = (tournament as Tournament & { config?: unknown }).config;
  if (!maybeConfig || typeof maybeConfig !== "object") {
    return {};
  }

  const lobbySize = (maybeConfig as { lobbySize?: unknown }).lobbySize;
  return typeof lobbySize === "number" && Number.isFinite(lobbySize)
    ? { lobbySize }
    : {};
}

export function resolveTournamentEngine(
  tournament: Tournament
): ResolvedTournamentEngine {
  const game = normalizeGame(tournament.game);
  const config = readConfig(tournament);

  if (tournament.format === "battle_royale_points") {
    return {
      engineKey: "wsow_classic",
      game,
      gameMode: "br",
      scoringProfile: "wsow_like",
      rosterPolicy: "fixed_squad",
      tournamentStructure: "cumulative",
      teamSize: normalizeTeamSize(tournament.team_size),
      usesKills: true,
      usesPlacement: true,
      requiresUniquePlacement: true,
      legacyFormat: tournament.format,
      config,
    };
  }

  if (tournament.format === "roulette_2v2" || tournament.format === "roulette_3v3") {
    return {
      engineKey: "kill_race_bracket",
      game,
      gameMode: "custom",
      scoringProfile: "kill_race",
      rosterPolicy: "roulette",
      tournamentStructure: "single_elim",
      teamSize: tournament.format === "roulette_3v3" ? 3 : 2,
      usesKills: true,
      usesPlacement: false,
      requiresUniquePlacement: false,
      legacyFormat: tournament.format,
      config,
    };
  }

  return {
    engineKey: "kill_race_bracket",
    game,
    gameMode: "custom",
    scoringProfile: "kill_race",
    rosterPolicy: "fixed_squad",
    tournamentStructure: "single_elim",
    teamSize: normalizeTeamSize(tournament.team_size),
    usesKills: true,
    usesPlacement: false,
    requiresUniquePlacement: false,
    legacyFormat: tournament.format,
    config,
  };
}

export function isOperatorSupportedTournament(tournament: Tournament) {
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
  return engine.config.lobbySize ?? totalTeams;
}

export function getMissingReportsMessage(
  missingCount: number,
  roundNumber: number
) {
  return `Faltan ${missingCount} reportes para cerrar la Partida ${roundNumber}.`;
}
