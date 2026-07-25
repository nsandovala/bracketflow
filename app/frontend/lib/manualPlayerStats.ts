export type ManualPlayerStatRow = {
  id: number;
  name: string;
};

export type ManualPlayerStatsValidation =
  | { ok: true; playerStats?: Array<{ player_name: string; kills: number }> }
  | { ok: false; message: string };

const PLAYER_STATS_SUM_MESSAGE =
  "Las kills por jugador deben sumar las kills del equipo.";

export function validateManualPlayerStats(
  players: ManualPlayerStatRow[],
  values: Record<number, string> | undefined,
  teamKillsValue: string
): ManualPlayerStatsValidation {
  const hasAnyValue = players.some((player) => (values?.[player.id] ?? "").trim() !== "");
  if (!hasAnyValue) {
    return { ok: true };
  }

  const parsed = players.map((player) => {
    const value = (values?.[player.id] ?? "").trim();
    return /^\d+$/.test(value) ? Number(value) : null;
  });
  if (parsed.some((value) => value === null || !Number.isSafeInteger(value))) {
    return {
      ok: false,
      message: "Completa las kills de todos los jugadores con números enteros desde 0.",
    };
  }

  const teamKills = /^\d+$/.test(teamKillsValue.trim()) ? Number(teamKillsValue) : null;
  const total = parsed.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  if (teamKills !== null && total !== teamKills) {
    return { ok: false, message: PLAYER_STATS_SUM_MESSAGE };
  }

  return {
    ok: true,
    playerStats: players.map((player, index) => ({
      player_name: player.name,
      kills: parsed[index] ?? 0,
    })),
  };
}

export type PlayerStatsPasteResult =
  | { ok: true; values: Record<number, string> }
  | { ok: false; message: string };

const NUMERIC_TOKEN = /^\d+$/;
// Rechazamos negativos y decimales sin tener que inferir el resto del formato.
const INVALID_NUMBER_TOKEN = /^-?\d*\.\d+|-\d+$/;

function normalizeName(value: string) {
  return value.trim().toLocaleLowerCase();
}

function extractNumericTokens(input: string): { values: number[]; invalid: boolean } {
  // Cualquier separador (espacios, comas, slashes, tabs, pipes). Un token
  // "5.5" queda intacto para poder detectarlo como decimal invalido.
  const rawTokens = input
    .split(/[\s,/|;\t]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  const values: number[] = [];
  for (const token of rawTokens) {
    if (INVALID_NUMBER_TOKEN.test(token)) {
      return { values: [], invalid: true };
    }
    if (!NUMERIC_TOKEN.test(token)) {
      return { values: [], invalid: true };
    }
    values.push(Number(token));
  }
  return { values, invalid: false };
}

function parseNameValuePairs(
  input: string,
  roster: ManualPlayerStatRow[]
): PlayerStatsPasteResult {
  // Aceptamos "NAME=VALUE", "NAME:VALUE", "NAME VALUE" y multi-linea.
  // Iteramos token a token: si el token es numerico, se asigna al ultimo nombre visto.
  const cleaned = input.replace(/[=:]/g, " ");
  const lineTokens: string[] = [];
  for (const line of cleaned.split(/\r?\n/)) {
    const parts = line
      .split(/[\s,/|;\t]+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 0);
    lineTokens.push(...parts);
  }

  const pairs = new Map<string, number>();
  let pendingName: string | null = null;
  for (const token of lineTokens) {
    if (INVALID_NUMBER_TOKEN.test(token)) {
      return { ok: false, message: "No se aceptan valores negativos ni decimales." };
    }
    if (NUMERIC_TOKEN.test(token)) {
      if (pendingName === null) {
        return {
          ok: false,
          message: "Formato con nombres inválido: aparece un número sin jugador previo.",
        };
      }
      pairs.set(pendingName, Number(token));
      pendingName = null;
      continue;
    }
    // Si viene otro nombre sin numero intermedio, tomamos el ultimo (evita
    // que "First Last 5" se rompa; se queda con "last -> 5").
    pendingName = normalizeName(token);
  }

  if (pairs.size === 0) {
    return {
      ok: false,
      message: "No detectamos pares nombre + kills.",
    };
  }

  const values: Record<number, string> = {};
  const matchedNames = new Set<string>();
  for (const player of roster) {
    const key = normalizeName(player.name);
    if (pairs.has(key)) {
      values[player.id] = String(pairs.get(key));
      matchedNames.add(key);
    }
  }

  if (matchedNames.size !== roster.length || matchedNames.size !== pairs.size) {
    return {
      ok: false,
      message: `Nombres no coinciden con el roster (${matchedNames.size}/${roster.length}).`,
    };
  }

  return { ok: true, values };
}

export function parsePlayerStatsPaste(
  input: string,
  roster: ManualPlayerStatRow[]
): PlayerStatsPasteResult {
  const trimmed = input.trim();
  if (trimmed === "") {
    return { ok: false, message: "Pega los kills por jugador." };
  }
  if (roster.length === 0) {
    return { ok: false, message: "El roster está vacío." };
  }

  const hasLetters = /[a-zA-ZÀ-ɏ]/.test(trimmed);
  if (!hasLetters) {
    const parsed = extractNumericTokens(trimmed);
    if (parsed.invalid) {
      return {
        ok: false,
        message: "Solo se aceptan enteros ≥ 0 separados por espacio, coma o /.",
      };
    }
    if (parsed.values.length !== roster.length) {
      return {
        ok: false,
        message: `Se esperaban ${roster.length} valores y llegaron ${parsed.values.length}.`,
      };
    }
    const values: Record<number, string> = {};
    roster.forEach((player, index) => {
      values[player.id] = String(parsed.values[index]);
    });
    return { ok: true, values };
  }

  return parseNameValuePairs(trimmed, roster);
}
