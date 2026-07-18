import type { OcrDraftReport } from "./ocrDraftIntake";

export type StatsDraftImportStatus =
  | "valid"
  | "invalid_missing_team"
  | "invalid_unknown_team"
  | "invalid_kills"
  | "invalid_placement"
  | "duplicate_existing_draft";

export type StatsDraftImportRow = {
  rowNumber: number;
  teamInput: string;
  teamId: number | null;
  teamName: string;
  kills: number | null;
  placement: number | "";
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
};

type ParseStatsDraftImportOptions = {
  teams: StatsDraftImportTeam[];
  existingDrafts: OcrDraftReport[];
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

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("es")
    .replace(/[\s-]+/g, "_");
}

export function normalizeStatsDraftTeamName(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("es").replace(/\s+/g, " ");
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

function detectDelimiter(value: string): "," | ";" | "\t" | null {
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

function parseDelimitedTable(value: string, delimiter: "," | ";" | "\t") {
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

  const teamsByNormalizedName = new Map<string, StatsDraftImportTeam[]>();
  for (const team of options.teams) {
    const normalizedName = normalizeStatsDraftTeamName(team.name);
    const matches = teamsByNormalizedName.get(normalizedName) ?? [];
    matches.push(team);
    teamsByNormalizedName.set(normalizedName, matches);
  }

  const duplicateTeamIds = new Set(
    options.existingDrafts
      .filter(
        (draft) =>
          draft.tournamentId === options.tournamentId &&
          draft.matchNumber === options.matchNumber
      )
      .map((draft) => draft.teamId)
  );

  const rows = dataRows.map((cells, index): StatsDraftImportRow => {
    const teamInput = teamIndex >= 0 ? (cells[teamIndex] ?? "").trim() : "";
    const teamMatches = teamsByNormalizedName.get(
      normalizeStatsDraftTeamName(teamInput)
    );
    const team = teamMatches?.length === 1 ? teamMatches[0] : null;
    const kills = killsIndex >= 0 ? parseInteger(cells[killsIndex] ?? "") : null;
    const placement = options.usesPlacement
      ? placementIndex >= 0
        ? parseInteger(cells[placementIndex] ?? "")
        : null
      : "";
    const note = noteIndex >= 0 ? (cells[noteIndex] ?? "").trim() : "";
    let status: StatsDraftImportStatus = "valid";

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
      note,
      status,
    };
  });

  return { delimiter, rows, missingColumns };
}
