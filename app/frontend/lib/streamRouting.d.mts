export type StreamSurface =
  | "scorebug"
  | "unsupported-scorebug"
  | "intermission"
  | "unsupported-intermission"
  | "kill-race-mvp"
  | "kill-race-champion"
  | "unsupported-champion"
  | "bracket"
  | "standings";
export function resolveStreamSurface(
  layout: string,
  capabilities: { isKillRace: boolean | null; isBracket: boolean }
): StreamSurface;
export function getCompatibleOverlayLayouts(capabilities: {
  isKillRace: boolean;
  supportsMatchPoint: boolean;
}): string[];
export function resolveBracketPresentation(
  scoringProfile: string | null
): "kill-race-broadcast" | "bracket-view";
