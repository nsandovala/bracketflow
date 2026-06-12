import { TournamentFormat } from "../../lib/api";

export function isWorldSeriesFormat(format: TournamentFormat) {
  return format === "battle_royale_points";
}

export function formatPoints(value: number, format: TournamentFormat) {
  if (isWorldSeriesFormat(format)) {
    return value.toFixed(1);
  }
  return String(Math.round(value));
}

export function formatMultiplier(value: number) {
  return value.toFixed(2).replace(/\.00$/, ".0").replace(/(\.\d)0$/, "$1");
}
