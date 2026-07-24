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

function isValidKill(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && Number.isInteger(value);
}

export function parsePlayerStatsPaste(
  text: string,
  players: ManualPlayerStatRow[]
): PlayerStatsPasteResult {
  const raw = text.trim();
  if (!raw) {
    return { ok: false, message: "Pega una tabla o lista de kills." };
  }

  // Multiline support: split by newlines first, then try single-line delimiters
  const lines = raw.split(/\r?\n/).filter((line) => line.trim() !== "");
  const tokens: string[] = [];

  if (lines.length > 1) {
    // Multiline: each line is a potential name+kill pair
    for (const line of lines) {
      tokens.push(...line.trim().split(/[\s,\/]+/).filter(Boolean));
    }
  } else {
    // Single line: split by comma, slash, or whitespace
    tokens.push(...raw.split(/[\s,\/]+/).map((t) => t.trim()).filter(Boolean));
  }

  // Try to detect if tokens are purely numeric (roster-order format)
  const numericTokens = tokens.map((t) => {
    const num = Number(t);
    return isValidKill(num) ? num : null;
  });

  if (numericTokens.every((n) => n !== null)) {
    if (numericTokens.length !== players.length) {
      return {
        ok: false,
        message: `El texto tiene ${numericTokens.length} valores numéricos pero el equipo tiene ${players.length} jugadores.`,
      };
    }
    const values: Record<number, string> = {};
    players.forEach((player, i) => {
      values[player.id] = String(numericTokens[i]);
    });
    return { ok: true, values };
  }

  // Name-based parsing: try "NAME=KILLS" or "NAME KILLS" or "NAME,KILLS"
  const values: Record<number, string> = {};
  const matchedPlayerIds = new Set<number>();
  const remainingTokens = [...tokens];

  // First pass: look for NAME=KILLS pattern
  for (let i = 0; i < remainingTokens.length; i++) {
    const token = remainingTokens[i];
    const eqIndex = token.indexOf("=");
    if (eqIndex > 0) {
      const namePart = token.slice(0, eqIndex).trim().toLocaleLowerCase();
      const killPart = token.slice(eqIndex + 1).trim();
      const killNum = Number(killPart);
      if (isValidKill(killNum)) {
        const player = players.find((p) => p.name.toLocaleLowerCase() === namePart);
        if (player && !matchedPlayerIds.has(player.id)) {
          values[player.id] = String(killNum);
          matchedPlayerIds.add(player.id);
          remainingTokens.splice(i, 1);
          i--;
        }
      }
    }
  }

  // Second pass: try adjacent pairs "NAME KILLS"
  for (let i = 0; i < remainingTokens.length - 1; i++) {
    const nameToken = remainingTokens[i].trim().toLocaleLowerCase();
    const killToken = remainingTokens[i + 1].trim();
    const killNum = Number(killToken);
    if (isValidKill(killNum)) {
      const player = players.find((p) => p.name.toLocaleLowerCase() === nameToken);
      if (player && !matchedPlayerIds.has(player.id)) {
        values[player.id] = String(killNum);
        matchedPlayerIds.add(player.id);
        remainingTokens.splice(i, 2);
        i -= 2;
        if (i < -1) i = -1;
      }
    }
  }

  if (matchedPlayerIds.size === 0) {
    return {
      ok: false,
      message: "No se reconoció formato. Usa: 5 6 6, o VITO 5 JOAN 6 JASFA 6, o VITO=5, JOAN=6, JASFA=6.",
    };
  }

  if (matchedPlayerIds.size !== players.length) {
    const unmatched = players.filter((p) => !matchedPlayerIds.has(p.id)).map((p) => p.name).join(", ");
    return {
      ok: false,
      message: `Faltan jugadores: ${unmatched}. Revisa el formato o la cantidad de valores.`,
    };
  }

  return { ok: true, values };
}
