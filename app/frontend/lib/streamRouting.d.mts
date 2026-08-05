export type StreamSurface =
  | "scorebug"
  | "unsupported-scorebug"
  | "intermission"
  | "unsupported-intermission"
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
