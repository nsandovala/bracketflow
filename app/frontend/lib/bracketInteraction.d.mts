import type { Match } from "./api";
import type { IRoundProps } from "react-brackets";
export function isBracketMatchSelectable(
  match: Match,
  mode: "setup" | "stream" | "operator" | "standings",
  hasHandler: boolean
): boolean;
export function getActiveBracketSeedCount(rounds: IRoundProps[], activeMatchId: number | null): number;
export function getBracketFitScale(contentWidth: number, containerWidth: number): number;
