const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

export class ApiError extends Error {
  status: number;
  code?: string;
  action?: string;

  constructor(message: string, status: number, code?: string, action?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.action = action;
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    let message = "Request failed";
    let code: string | undefined;
    let action: string | undefined;

    try {
      const data = (await response.json()) as {
        detail?: string | { code?: string; action?: string; reason?: string };
      };
      if (typeof data.detail === "string") {
        message = data.detail;
      } else if (data.detail) {
        message = data.detail.reason ?? message;
        code = data.detail.code;
        action = data.detail.action;
      }
    } catch {}

    throw new ApiError(message, response.status, code, action);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export type TournamentFormat =
  | "single_elimination"
  | "battle_royale_points"
  | "roulette_2v2"
  | "roulette_3v3";

export type TournamentEngineKey =
  | "wsow_br"
  | "rebirth_ws"
  | "roulette_ws"
  | "kill_race_bracket";

export type LegacyTournamentEngineKey = "wsow_classic";

export type TournamentConfig = {
  engine_key?: TournamentEngineKey | LegacyTournamentEngineKey;
  game_mode?: "br" | "rebirth" | "kill_race" | "custom";
  roster_policy?: "fixed_squad" | "roulette";
  tournament_structure?: "cumulative" | "single_elim" | "double_elim";
  lobbySize?: number;
  bracketMode?: "single_elim" | "double_elim";
  teamSize?: 1 | 2 | 3 | 4;
  bestOf?: number;
  matchPointEnabled?: boolean;
  matchPointThreshold?: number;
  rouletteGeneratedAt?: string;
  rouletteSeed?: string;
  rouletteTeamSize?: 1 | 2 | 3 | 4;
  rouletteBench?: string[];
  rouletteStatus?: "generated" | "confirmed";
  championTeamId?: number;
  championDecidedAt?: string;
  broadcastMatchId?: number;
};

export type Tournament = {
  id: number;
  name: string;
  game: string;
  status: string;
  format: TournamentFormat;
  team_size: number;
  scoring_profile: string;
  roster_status: "participants_pending" | "respin_open" | "locked";
  roster_respin_deadline_at: string | null;
  roster_locked_at: string | null;
  bracket_status: "pending" | "respin_open" | "locked" | "running" | "completed";
  bracket_respin_deadline_at: string | null;
  bracket_locked_at: string | null;
  engine_key?: TournamentEngineKey;
  config?: TournamentConfig;
};

export type BroadcastChannel = {
  channelKey: string;
  activeTournamentId: number | null;
  broadcastMatchId: number | null;
  engine: string | null;
  updatedAt: string;
  updatedBy: string | null;
};

export type MatchCompletionPolicyState =
  | "unsupported"
  | "disabled"
  | "match_point_not_configured"
  | "active"
  | "threshold_reached"
  | "completed";

export type MatchCompletionPolicy = {
  state: MatchCompletionPolicyState;
  action:
    | "none"
    | "configure_match_point"
    | "create_match"
    | "complete_current_match"
    | "resolve_tie"
    | "remove_empty_latest_match"
    | "tournament_completed";
  code: string;
  reason: string;
  supportsMatchPoint: boolean;
  matchPointEnabled: boolean;
  matchPointThreshold: number | null;
  championTeamId: number | null;
  championTeamName: string | null;
  leaderTeamId: number | null;
  leaderTeamName: string | null;
  leaderPoints: number | null;
  latestMatchId: number | null;
  latestMatchRound: number | null;
  latestMatchReports: number;
  canRemoveLatestEmptyMatch: boolean;
};

export type EmptyMatchRemovalResult = {
  removedMatchId: number;
  matchCompletionPolicy: MatchCompletionPolicy;
};

export type Player = {
  id: number;
  nickname: string;
  display_name?: string | null;
  activision_id?: string | null;
  tournament_id: number;
};

export type ParticipantImportAccepted = {
  line: number;
  raw: string;
  display_name: string;
  activision_id: string | null;
};

export type ParticipantImportRejected = {
  line: number;
  raw: string;
  reason: string;
};

export type ParticipantImportResult = {
  accepted: ParticipantImportAccepted[];
  rejected: ParticipantImportRejected[];
  persisted_count: number;
};

export type TeamMember = {
  id: number;
  team_id: number;
  player_id: number;
  player: Player;
};

export type Team = {
  id: number;
  name: string;
  tournament_id: number;
  source: string;
  members: TeamMember[];
};

export type Match = {
  id: number;
  round: number;
  status: string;
  team_a_id: number | null;
  team_b_id: number | null;
  winner_id: number | null;
  best_of: number;
  next_match_id: number | null;
  next_slot: string | null;
  tournament_id: number;
  maps: MatchMap[];
  maps_won_a: number;
  maps_won_b: number;
};

export type MatchMap = {
  id: number;
  match_id: number;
  map_number: number;
  kills_a: number;
  kills_b: number;
  map_winner_id: number | null;
  result_status: "pending" | "live" | "provisional" | "confirmed";
  player_stats: KillRacePlayerStat[];
};

export type KillRacePlayerStat = {
  player_id: number;
  player_name: string;
  side: "left" | "right";
  kills: number;
};

export type KillRaceSideInput = {
  side: "left" | "right";
  team_id: number;
  team_name: string;
  players: Array<{ player_id: number; player_name: string; kills: number }>;
  total_kills: number;
};

export type KillRaceImportPreview = {
  valid: boolean;
  match_id: number;
  map_number: number | null;
  left: KillRaceSideInput | null;
  right: KillRaceSideInput | null;
  errors: Array<{ code: string; message: string; row: number | null }>;
  conflicts: Array<{ code: string; message: string; row: number | null }>;
};

export type TeamResultPlayerStat = {
  player_name: string;
  kills: number;
};

export type TeamResult = {
  id: number;
  tournament_id: number;
  match_id: number;
  team_id: number;
  kills: number;
  placement: number;
  kill_points: number;
  placement_points: number;
  total_points: number;
  player_stats?: TeamResultPlayerStat[];
};

export type TeamResultDetail = {
  id: number;
  tournament_id: number;
  match_id: number;
  round: number;
  match_status: string;
  team_id: number;
  team_name: string;
  kills: number;
  placement: number;
  kill_points: number;
  placement_points: number;
  total_points: number;
  player_stats?: TeamResultPlayerStat[];
};

export type BracketGenerationResult = {
  matches_created: number;
  status: string;
};

export type RouletteGenerationResult = {
  team_size: number;
  teams_created: Team[];
  bench: Player[];
  status: string;
};

export type LeaderboardEntry = {
  team_id: number;
  team_name: string;
  matches_played: number;
  kills: number;
  placement_points: number;
  total_points: number;
  best_placement: number | null;
};

export type PlayerProfile = {
  id: number;
  display_name: string;
  short_name: string | null;
  country: string | null;
  avatar_url: string | null;
  notes: string | null;
  role: "slayer" | "support" | "flex" | "igl" | "unknown" | null;
  declared_kd: number | null;
  declared_platform: "pc" | "console" | "unknown" | null;
  preferred_input: "controller" | "keyboard_mouse" | "unknown" | null;
  short_bio: string | null;
  social_handle: string | null;
  broadcast_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type TeamProfile = {
  id: number;
  display_name: string;
  short_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PlayerGameIdentity = {
  id: number;
  player_profile_id: number;
  game: string;
  game_handle: string;
  game_id: string | null;
  platform: string | null;
  region: string | null;
  verified_status: "unverified" | "self_reported" | "verified";
  created_at: string;
  updated_at: string;
};

export type PlayerProfileCreate = Pick<
  PlayerProfile,
  "display_name" | "short_name" | "country" | "avatar_url" | "notes"
> &
  Partial<
    Pick<
      PlayerProfile,
      | "role"
      | "declared_kd"
      | "declared_platform"
      | "preferred_input"
      | "short_bio"
      | "social_handle"
      | "broadcast_notes"
    >
  >;

export type PlayerProfileUpdate = Partial<PlayerProfileCreate>;

export type TeamProfileCreate = Pick<
  TeamProfile,
  | "display_name"
  | "short_name"
  | "logo_url"
  | "primary_color"
  | "secondary_color"
  | "notes"
>;

export type PlayerGameIdentityCreate = Pick<
  PlayerGameIdentity,
  | "player_profile_id"
  | "game"
  | "game_handle"
  | "game_id"
  | "platform"
  | "region"
  | "verified_status"
>;

export function getHealth() {
  return request<{ status: string }>("/health");
}

export function getTournaments() {
  return request<Tournament[]>("/tournaments");
}

export function getTournament(tournamentId: number) {
  return request<Tournament>(`/tournaments/${tournamentId}`);
}

export function createTournament(payload: {
  name: string;
  game: string;
  format: TournamentFormat;
  team_size: number;
  scoring_profile: string;
  config?: TournamentConfig;
}) {
  return request<Tournament>("/tournaments", {
    method: "POST",
    body: payload,
  });
}

export function updateTournament(
  tournamentId: number,
  payload: Partial<{
    name: string;
    game: string;
    format: TournamentFormat;
    team_size: number;
    scoring_profile: string;
    config: TournamentConfig;
  }>
) {
  return request<Tournament>(`/tournaments/${tournamentId}`, {
    method: "PATCH",
    body: payload,
  });
}

export function updateTournamentBroadcastMatch(
  tournamentId: number,
  broadcastMatchId: number | null
) {
  return request<Tournament>(`/tournaments/${tournamentId}/broadcast-match`, {
    method: "PATCH",
    body: { broadcastMatchId },
  });
}

export function getBroadcastChannel(channelKey = "main") {
  return request<BroadcastChannel>(`/broadcast/channels/${encodeURIComponent(channelKey)}`);
}

export function updateBroadcastChannel(
  channelKey: string,
  payload: Partial<Omit<BroadcastChannel, "channelKey" | "updatedAt">>
) {
  return request<BroadcastChannel>(`/broadcast/channels/${encodeURIComponent(channelKey)}`, {
    method: "PATCH",
    body: payload,
  });
}

export function getMatchCompletionPolicy(tournamentId: number) {
  return request<MatchCompletionPolicy>(
    `/tournaments/${tournamentId}/match-completion-policy`
  );
}

export function configureTournamentMatchPoint(
  tournamentId: number,
  matchPointThreshold: number
) {
  return request<MatchCompletionPolicy>(
    `/tournaments/${tournamentId}/match-completion-policy`,
    {
      method: "PATCH",
      body: { matchPointThreshold },
    }
  );
}

export function removeEmptyLatestMatch(tournamentId: number, matchId: number) {
  return request<EmptyMatchRemovalResult>(
    `/tournaments/${tournamentId}/matches/${matchId}`,
    { method: "DELETE" }
  );
}

export function archiveTournament(tournamentId: number) {
  return request<Tournament>(`/tournaments/${tournamentId}/archive`, {
    method: "POST",
  });
}

export function deleteTournament(tournamentId: number) {
  return request<void>(`/tournaments/${tournamentId}`, {
    method: "DELETE",
  });
}

export function getTeams(tournamentId: number) {
  return request<Team[]>(`/tournaments/${tournamentId}/teams`);
}

export function createTeam(tournamentId: number, payload: { name: string }) {
  return request<Team>(`/tournaments/${tournamentId}/teams`, {
    method: "POST",
    body: payload,
  });
}

export function addTeamMember(teamId: number, payload: { player_id: number }) {
  return request<Team>(`/teams/${teamId}/members`, {
    method: "POST",
    body: payload,
  });
}

export function getPlayers(tournamentId: number) {
  return request<Player[]>(`/tournaments/${tournamentId}/players`);
}

export function createPlayer(tournamentId: number, payload: { nickname: string }) {
  return request<Player>(`/tournaments/${tournamentId}/players`, {
    method: "POST",
    body: payload,
  });
}

export function bulkImportPlayers(tournamentId: number, payload: { nicknames: string[] }) {
  return request<Player[]>(`/tournaments/${tournamentId}/players/bulk`, {
    method: "POST",
    body: payload,
  });
}

export function importParticipantRows(
  tournamentId: number,
  payload: { rows: string[]; confirm?: boolean }
) {
  return request<ParticipantImportResult>(`/tournaments/${tournamentId}/players/import`, {
    method: "POST",
    body: payload,
  });
}

export function updatePlayer(playerId: number, payload: { nickname: string }) {
  return request<Player>(`/players/${playerId}`, {
    method: "PATCH",
    body: payload,
  });
}

export function deletePlayer(playerId: number) {
  return request<void>(`/players/${playerId}`, {
    method: "DELETE",
  });
}

export function clearPlayers(tournamentId: number) {
  return request<void>(`/tournaments/${tournamentId}/players`, {
    method: "DELETE",
  });
}

export function generateBracket(tournamentId: number) {
  return request<BracketGenerationResult>(
    `/tournaments/${tournamentId}/generate-bracket`,
    {
      method: "POST",
    }
  );
}

export function generateRouletteTeams(
  tournamentId: number,
  payload: { shuffle_seed?: string | number; seed?: string | number; reset?: boolean; confirm?: boolean }
) {
  return request<RouletteGenerationResult>(
    `/tournaments/${tournamentId}/generate-roulette-teams`,
    {
      method: "POST",
      body: payload,
    }
  );
}

export function getMatches(tournamentId: number) {
  return request<Match[]>(`/tournaments/${tournamentId}/matches`);
}

export function previewKillRaceImport(
  matchId: number,
  payload: { format: "txt" | "csv"; content: string; map_number: number }
) {
  return request<KillRaceImportPreview>(`/matches/${matchId}/kill-race/import-preview`, {
    method: "POST",
    body: payload,
  });
}

export function saveKillRaceProvisional(
  matchId: number,
  payload: {
    map_number: number;
    status: "pending" | "live" | "provisional";
    left: KillRaceSideInput;
    right: KillRaceSideInput;
  }
) {
  return request<Match>(`/matches/${matchId}/kill-race/result`, {
    method: "PUT",
    body: payload,
  });
}

export function confirmKillRaceResult(matchId: number, mapNumber: number) {
  return request<Match>(`/matches/${matchId}/kill-race/maps/${mapNumber}/confirm`, {
    method: "POST",
  });
}

export function createBattleRoyaleMatch(
  tournamentId: number,
  payload: { round: number }
) {
  return request<Match>(`/tournaments/${tournamentId}/matches`, {
    method: "POST",
    body: payload,
  });
}

export function saveMatchResult(
  matchId: number,
  payload: {
    team_id: number;
    kills: number;
    placement: number;
    player_stats?: TeamResultPlayerStat[];
  }
) {
  return request<TeamResult>(`/matches/${matchId}/results`, {
    method: "POST",
    body: payload,
  });
}

export function openRosterRespin(tournamentId: number, payload: { duration_minutes: number }) {
  return request<Tournament>(`/tournaments/${tournamentId}/roster-respin/open`, {
    method: "POST",
    body: payload,
  });
}

export function closeRosterRespin(tournamentId: number) {
  return request<Tournament>(`/tournaments/${tournamentId}/roster-respin/close`, {
    method: "POST",
  });
}

export function lockRosterRespin(tournamentId: number) {
  return request<Tournament>(`/tournaments/${tournamentId}/roster-respin/lock`, {
    method: "POST",
  });
}

export function openBracketRespin(tournamentId: number, payload: { duration_minutes: number }) {
  return request<Tournament>(`/tournaments/${tournamentId}/bracket-respin/open`, {
    method: "POST",
    body: payload,
  });
}

export function lockBracketRespin(tournamentId: number) {
  return request<Tournament>(`/tournaments/${tournamentId}/bracket-respin/lock`, {
    method: "POST",
  });
}

export function saveMatchMap(
  matchId: number,
  payload: { match_id: number; map_number: number; kills_a: number; kills_b: number }
) {
  return request<Match>(`/matches/${matchId}/maps`, {
    method: "POST",
    body: payload,
  });
}

export function getLeaderboard(tournamentId: number) {
  return request<LeaderboardEntry[]>(`/tournaments/${tournamentId}/leaderboard`);
}

export function getTournamentResults(tournamentId: number) {
  return request<TeamResultDetail[]>(`/tournaments/${tournamentId}/results`);
}

export function getIdentityPlayers() {
  return request<PlayerProfile[]>("/identity/players");
}

export function createIdentityPlayer(payload: PlayerProfileCreate) {
  return request<PlayerProfile>("/identity/players", { method: "POST", body: payload });
}

export function updateIdentityPlayer(
  playerProfileId: number,
  payload: PlayerProfileUpdate
) {
  return request<PlayerProfile>(`/identity/players/${playerProfileId}`, {
    method: "PATCH",
    body: payload,
  });
}

export function getIdentityTeams() {
  return request<TeamProfile[]>("/identity/teams");
}

export function createIdentityTeam(payload: TeamProfileCreate) {
  return request<TeamProfile>("/identity/teams", { method: "POST", body: payload });
}

export function getPlayerGameIdentities(playerProfileId?: number) {
  const query = playerProfileId ? `?player_profile_id=${playerProfileId}` : "";
  return request<PlayerGameIdentity[]>(`/identity/game-identities${query}`);
}

export function createPlayerGameIdentity(payload: PlayerGameIdentityCreate) {
  return request<PlayerGameIdentity>("/identity/game-identities", {
    method: "POST",
    body: payload,
  });
}
