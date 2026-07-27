import type { OcrDraftReport } from "./ocrDraftIntake";
import {
  buildTeamResolutionIndex,
  normalizeTeamName,
  resolveTeamCandidate,
} from "./teamResolution.mjs";
import type { TeamResolutionIndex, TeamResolutionOutcome } from "./teamResolution.d.mts";

export { buildTeamResolutionIndex, resolveTeamCandidate };
export type { TeamResolutionIndex, TeamResolutionOutcome };
// Alias historico: el resto del archivo (y consumidores existentes) usan este
// nombre para la normalizacion de nombre de equipo.
export const normalizeStatsDraftTeamName = normalizeTeamName;

export type StatsDraftImportStatus =
  | "valid"
  | "invalid_missing_team"
  | "invalid_unknown_team"
  | "invalid_kills"
  | "invalid_placement"
  | "invalid_player_kills"
  | "player_kills_mismatch"
  | "duplicate_existing_draft"
  | "official_report_exists"
  | "official_conflict";

export type StatsDraftImportPlayerStat = {
  playerName: string;
  kills: number;
};

export type StatsDraftImportRow = {
  rowNumber: number;
  teamInput: string;
  teamId: number | null;
  teamName: string;
  kills: number | null;
  placement: number | "";
  // Desglose opcional por player cuando el CSV trae columnas playerN /
  // playerN_kills. null = formato team-level clasico.
  playerStats: StatsDraftImportPlayerStat[] | null;
  note: string;
  status: StatsDraftImportStatus;
};

export type StatsDraftImportResult = {
  delimiter: "," | ";" | "\t" | null;
  rows: StatsDraftImportRow[];
  missingColumns: Array<"team" | "kills" | "placement">;
};

type StatsDraftImportTeam = {
  id: number;
  name: string;
  members?: Array<{ player: { nickname: string } }>;
};

type StatsDraftOfficialResult = {
  team_id: number;
  kills: number;
  placement: number;
};

type ParseStatsDraftImportOptions = {
  teams: StatsDraftImportTeam[];
  existingDrafts: OcrDraftReport[];
  // Reportes oficiales ya guardados para la partida activa. Un equipo presente
  // aqui nunca vuelve a ser "valid": mismo valor = reporte existente, valor
  // distinto = conflicto que requiere revision humana (sin sobreescritura).
  officialResults?: StatsDraftOfficialResult[];
  tournamentId: number;
  matchNumber: number;
  usesPlacement: boolean;
  effectiveLobbySize: number;
};

const COLUMN_ALIASES = {
  team: new Set(["team", "equipo", "roster", "name", "nombre"]),
  kills: new Set(["kills", "kill", "bajas", "eliminaciones"]),
  placement: new Set(["placement", "place", "pos", "posicion", "puesto"]),
  note: new Set(["note", "nota", "evidencia", "source_note"]),
};

// Columnas opcionales de desglose por player: playerN + playerN_kills
// (tambien jugadorN). Hasta 4 slots, el maximo de teamSize soportado.
const MAX_PLAYER_COLUMNS = 4;

function findPlayerColumnPairs(headers: string[]) {
  const pairs: Array<{ nameIndex: number; killsIndex: number }> = [];
  for (let slot = 1; slot <= MAX_PLAYER_COLUMNS; slot += 1) {
    const nameAliases = new Set([`player${slot}`, `jugador${slot}`]);
    const killsAliases = new Set([
      `player${slot}_kills`,
      `jugador${slot}_kills`,
      `player${slot}kills`,
    ]);
    const nameIndex = headers.findIndex((header) => nameAliases.has(header));
    const killsIndex = headers.findIndex((header) => killsAliases.has(header));
    if (nameIndex >= 0) {
      pairs.push({ nameIndex, killsIndex });
    }
  }
  return pairs;
}

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("es")
    .replace(/[\s-]+/g, "_");
}

function countUnquotedDelimiter(line: string, delimiter: "," | ";" | "\t") {
  let count = 0;
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '"') {
      if (quoted && line[index + 1] === '"') {
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && line[index] === delimiter) {
      count += 1;
    }
  }

  return count;
}

export function detectDelimiter(value: string): "," | ";" | "\t" | null {
  const headerLine = value
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .find((line) => line.trim() !== "");

  if (!headerLine) {
    return null;
  }

  const candidates: Array<"," | ";" | "\t"> = ["\t", ";", ","];
  let selected: "," | ";" | "\t" | null = null;
  let selectedCount = 0;

  for (const candidate of candidates) {
    const count = countUnquotedDelimiter(headerLine, candidate);
    if (count > selectedCount) {
      selected = candidate;
      selectedCount = count;
    }
  }

  return selected;
}

export function parseDelimitedTable(value: string, delimiter: "," | ";" | "\t") {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const input = value.replace(/^\uFEFF/, "");

  function finishField() {
    row.push(field);
    field = "";
  }

  function finishRow() {
    finishField();
    if (row.some((cell) => cell.trim() !== "")) {
      rows.push(row);
    }
    row = [];
  }

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (character === '"') {
      if (quoted && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (!quoted && character === delimiter) {
      finishField();
      continue;
    }

    if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && input[index + 1] === "\n") {
        index += 1;
      }
      finishRow();
      continue;
    }

    field += character;
  }

  if (field !== "" || row.length > 0) {
    finishRow();
  }

  return rows;
}

function findColumnIndex(headers: string[], aliases: Set<string>) {
  return headers.findIndex((header) => aliases.has(header));
}

function parseInteger(value: string) {
  if (value.trim() === "") {
    return null;
  }

  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function parseStatsDraftImport(
  value: string,
  options: ParseStatsDraftImportOptions
): StatsDraftImportResult {
  const delimiter = detectDelimiter(value);
  if (!delimiter) {
    return {
      delimiter: null,
      rows: [],
      missingColumns: options.usesPlacement
        ? ["team", "kills", "placement"]
        : ["team", "kills"],
    };
  }

  const table = parseDelimitedTable(value, delimiter);
  const [rawHeaders = [], ...dataRows] = table;
  const headers = rawHeaders.map(normalizeHeader);
  const teamIndex = findColumnIndex(headers, COLUMN_ALIASES.team);
  const killsIndex = findColumnIndex(headers, COLUMN_ALIASES.kills);
  const placementIndex = findColumnIndex(headers, COLUMN_ALIASES.placement);
  const noteIndex = findColumnIndex(headers, COLUMN_ALIASES.note);
  const playerColumnPairs = findPlayerColumnPairs(headers);
  const missingColumns: StatsDraftImportResult["missingColumns"] = [];

  if (teamIndex < 0) {
    missingColumns.push("team");
  }
  if (killsIndex < 0) {
    missingColumns.push("kills");
  }
  if (options.usesPlacement && placementIndex < 0) {
    missingColumns.push("placement");
  }

  const resolutionIndex = buildTeamResolutionIndex(options.teams);

  // CSV historicamente colapsa "no existe" y "ambiguo" al mismo estado
  // (invalid_unknown_team): mantenemos ese comportamiento aqui y dejamos que
  // OCR (resolveTeamCandidate directo) distinga ambos casos en su propia UI.
  function resolveTeam(teamInput: string): StatsDraftImportTeam | null {
    const outcome = resolveTeamCandidate(teamInput, resolutionIndex);
    return outcome.kind === "found" ? outcome.team : null;
  }

  // Clave unica de reporte: tournamentId + matchNumber + teamId.
  const duplicateTeamIds = new Set(
    options.existingDrafts
      .filter(
        (draft) =>
          draft.tournamentId === options.tournamentId &&
          draft.matchNumber === options.matchNumber
      )
      .map((draft) => draft.teamId)
  );
  const officialByTeamId = new Map(
    (options.officialResults ?? []).map((result) => [result.team_id, result])
  );

  const rows = dataRows.map((cells, index): StatsDraftImportRow => {
    const teamInput = teamIndex >= 0 ? (cells[teamIndex] ?? "").trim() : "";
    const team = teamInput ? resolveTeam(teamInput) : null;
    const kills = killsIndex >= 0 ? parseInteger(cells[killsIndex] ?? "") : null;
    const placement = options.usesPlacement
      ? placementIndex >= 0
        ? parseInteger(cells[placementIndex] ?? "")
        : null
      : "";
    const note = noteIndex >= 0 ? (cells[noteIndex] ?? "").trim() : "";

    let playerStats: StatsDraftImportPlayerStat[] | null = null;
    let playerStatsInvalid = false;
    if (playerColumnPairs.length > 0) {
      const parsedPlayers: StatsDraftImportPlayerStat[] = [];
      for (const pair of playerColumnPairs) {
        const playerName = (cells[pair.nameIndex] ?? "").trim();
        if (!playerName) {
          continue;
        }
        const playerKills =
          pair.killsIndex >= 0 ? parseInteger(cells[pair.killsIndex] ?? "") : null;
        if (playerKills === null || playerKills < 0) {
          playerStatsInvalid = true;
          break;
        }
        parsedPlayers.push({ playerName, kills: playerKills });
      }
      if (!playerStatsInvalid && parsedPlayers.length > 0) {
        playerStats = parsedPlayers;
      }
    }

    let status: StatsDraftImportStatus = "valid";

    const official = team ? officialByTeamId.get(team.id) : undefined;

    if (!teamInput) {
      status = "invalid_missing_team";
    } else if (!team) {
      status = "invalid_unknown_team";
    } else if (kills === null || kills < 0) {
      status = "invalid_kills";
    } else if (
      options.usesPlacement &&
      (placement === null ||
        placement === "" ||
        placement < 1 ||
        placement > options.effectiveLobbySize)
    ) {
      status = "invalid_placement";
    } else if (playerStatsInvalid) {
      status = "invalid_player_kills";
    } else if (
      playerStats !== null &&
      playerStats.reduce((sum, player) => sum + player.kills, 0) !== kills
    ) {
      // El desglose no cuadra con las kills del equipo: requiere revision
      // humana; el backend tambien lo rechazaria en el submit oficial.
      status = "player_kills_mismatch";
    } else if (official) {
      status =
        official.kills === kills &&
        (!options.usesPlacement || official.placement === placement)
          ? "official_report_exists"
          : "official_conflict";
    } else if (duplicateTeamIds.has(team.id)) {
      status = "duplicate_existing_draft";
    }

    if (status === "valid" && team) {
      duplicateTeamIds.add(team.id);
    }

    return {
      rowNumber: index + 2,
      teamInput,
      teamId: team?.id ?? null,
      teamName: team?.name ?? teamInput,
      kills,
      placement: placement ?? "",
      playerStats,
      note,
      status,
    };
  });

  return { delimiter, rows, missingColumns };
}
