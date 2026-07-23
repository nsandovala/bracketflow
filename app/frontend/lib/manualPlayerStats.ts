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
