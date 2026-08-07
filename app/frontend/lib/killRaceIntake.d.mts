import type { KillRaceImportPreview, Match, Team } from "./api";
export function parseManualKills(value: string): { ok: boolean; value?: number; error?: string };
export function buildManualKillRacePreview(input: {
  match: Match;
  leftTeam: Team;
  rightTeam: Team;
  values: Record<number, string>;
  mapNumber: number;
}): KillRaceImportPreview;
export function getProjectedSeriesScore(
  match: Match,
  preview: KillRaceImportPreview | null
): { left: number; right: number; leader: "left" | "right" | null };
