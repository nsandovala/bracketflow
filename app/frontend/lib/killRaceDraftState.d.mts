import type { KillRaceImportPreview, MatchMap } from "./api";

export function getManualKillsFromMap(
  map: MatchMap | undefined
): Record<number, string>;

export function clearKillRaceDraft(): {
  manualKills: Record<number, string>;
  content: string;
  preview: KillRaceImportPreview | null;
};
