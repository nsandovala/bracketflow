import type {
  PlayerGameIdentity,
  PlayerProfile,
  Team,
  TeamProfile,
  TeamResultDetail,
} from "./api";

export type IdentityCatalog = {
  teams: TeamProfile[];
  players: PlayerProfile[];
  gameIdentities: PlayerGameIdentity[];
};

export const EMPTY_IDENTITY_CATALOG: IdentityCatalog = {
  teams: [],
  players: [],
  gameIdentities: [],
};

export function normalizeIdentityName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

export function createTeamShortName(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return words.map((word) => word[0]).join("").slice(0, 4).toLocaleUpperCase();
  }
  return (words[0] ?? "TEAM").slice(0, 4).toLocaleUpperCase();
}

function uniqueMatch<T>(candidates: T[]) {
  return candidates.length === 1 ? candidates[0] : null;
}

export function matchTeamProfile(name: string, profiles: TeamProfile[]) {
  const normalized = normalizeIdentityName(name);
  if (!normalized) return null;
  return uniqueMatch(
    profiles.filter((profile) =>
      [profile.display_name, profile.short_name]
        .filter((value): value is string => Boolean(value))
        .some((value) => normalizeIdentityName(value) === normalized)
    )
  );
}

export function matchPlayerProfile(
  name: string,
  profiles: PlayerProfile[],
  gameIdentities: PlayerGameIdentity[]
) {
  const normalized = normalizeIdentityName(name);
  if (!normalized) return null;
  const matchingIds = new Set(
    gameIdentities
      .filter((identity) => normalizeIdentityName(identity.game_handle) === normalized)
      .map((identity) => identity.player_profile_id)
  );
  const candidates = profiles.filter(
    (profile) =>
      [profile.display_name, profile.short_name]
        .filter((value): value is string => Boolean(value))
        .some((value) => normalizeIdentityName(value) === normalized) ||
      matchingIds.has(profile.id)
  );
  return uniqueMatch(candidates);
}

export function resolvePlayerLabel(name: string, catalog: IdentityCatalog) {
  const profile = matchPlayerProfile(name, catalog.players, catalog.gameIdentities);
  if (!profile) return name;
  const identities = catalog.gameIdentities
    .filter((identity) => identity.player_profile_id === profile.id)
    .sort((left, right) => left.id - right.id);
  const exactIdentity = identities.find(
    (identity) => normalizeIdentityName(identity.game_handle) === normalizeIdentityName(name)
  );
  return exactIdentity?.game_handle ??
    (identities.length === 1 ? identities[0].game_handle : profile.display_name);
}

export function getResolvedTeamProfile(team: Team, catalog: IdentityCatalog) {
  return matchTeamProfile(team.name, catalog.teams);
}

export function resolveTournamentTeams(teams: Team[], catalog: IdentityCatalog): Team[] {
  return teams.map((team) => {
    const profile = getResolvedTeamProfile(team, catalog);
    return {
      ...team,
      name: profile?.display_name ?? team.name,
      members: team.members.map((member) => ({
        ...member,
        player: {
          ...member.player,
          nickname: resolvePlayerLabel(member.player.nickname, catalog),
        },
      })),
    };
  });
}

export function resolveTournamentResults(
  results: TeamResultDetail[],
  rawTeams: Team[],
  catalog: IdentityCatalog
) {
  const teamNameById = new Map(
    rawTeams.map((team) => {
      const profile = getResolvedTeamProfile(team, catalog);
      return [team.id, profile?.display_name ?? team.name] as const;
    })
  );
  return results.map((result) => ({
    ...result,
    team_name: teamNameById.get(result.team_id) ?? result.team_name,
    player_stats: (result.player_stats ?? []).map((stat) => ({
      ...stat,
      player_name: resolvePlayerLabel(stat.player_name, catalog),
    })),
  }));
}

export function getTeamIdentityContext(team: Team, catalog: IdentityCatalog) {
  const profile = getResolvedTeamProfile(team, catalog);
  return {
    displayName: profile?.display_name ?? team.name,
    shortName: profile?.short_name ?? createTeamShortName(team.name),
    notes: profile?.notes ?? null,
    primaryColor: profile?.primary_color ?? null,
    secondaryColor: profile?.secondary_color ?? null,
  };
}

export function getPlayerIdentityContext(name: string, catalog: IdentityCatalog) {
  const profile = matchPlayerProfile(name, catalog.players, catalog.gameIdentities);
  return profile
    ? { label: resolvePlayerLabel(name, catalog), notes: profile.notes }
    : { label: name, notes: null };
}
