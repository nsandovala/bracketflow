export type StreamSurface = "scorebug" | "unsupported-scorebug" | "bracket" | "standings";
export function resolveStreamSurface(
  layout: string,
  capabilities: { isKillRace: boolean; isBracket: boolean }
): StreamSurface;
export function getCompatibleOverlayLayouts(capabilities: {
  isKillRace: boolean;
  supportsMatchPoint: boolean;
}): string[];
