export type TeamResolutionTeam = {
  id: number;
  name: string;
  members?: Array<{ player: { nickname: string } }>;
};

export type TeamResolutionIndex<T extends TeamResolutionTeam = TeamResolutionTeam> = {
  byName: Map<string, T[]>;
  byRoster: Map<string, T[]>;
  byPlayer: Map<string, T[]>;
};

export type TeamResolutionOutcome<T extends TeamResolutionTeam = TeamResolutionTeam> =
  | { kind: "empty" }
  | { kind: "found"; team: T }
  | { kind: "not_found" }
  | { kind: "ambiguous"; candidates: T[] };

export function normalizeTeamName(value: string): string;

export function buildTeamResolutionIndex<T extends TeamResolutionTeam>(
  teams: T[]
): TeamResolutionIndex<T>;

export function resolveTeamCandidate<T extends TeamResolutionTeam>(
  teamInput: string,
  index: TeamResolutionIndex<T>
): TeamResolutionOutcome<T>;
