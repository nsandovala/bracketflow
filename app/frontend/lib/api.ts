const API_BASE_URL = "http://localhost:8000";

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

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

    try {
      const data = (await response.json()) as { detail?: string };
      if (data.detail) {
        message = data.detail;
      }
    } catch {}

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export type TournamentFormat =
  | "single_elimination"
  | "battle_royale_points"
  | "roulette_2v2"
  | "roulette_3v3";

export type Tournament = {
  id: number;
  name: string;
  game: string;
  status: string;
  format: TournamentFormat;
  team_size: number;
  scoring_profile: string;
};

export type Player = {
  id: number;
  nickname: string;
  tournament_id: number;
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
  tournament_id: number;
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
};

export type BracketGenerationResult = {
  matches_created: number;
  status: string;
};

export type RouletteGenerationResult = {
  team_size: number;
  teams_created: Team[];
  bench: Player[];
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
}) {
  return request<Tournament>("/tournaments", {
    method: "POST",
    body: payload,
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

export function getPlayers(tournamentId: number) {
  return request<Player[]>(`/tournaments/${tournamentId}/players`);
}

export function createPlayer(tournamentId: number, payload: { nickname: string }) {
  return request<Player>(`/tournaments/${tournamentId}/players`, {
    method: "POST",
    body: payload,
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
  payload: { team_size: number; seed?: string; reset?: boolean }
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
  payload: { team_id: number; kills: number; placement: number }
) {
  return request<TeamResult>(`/matches/${matchId}/results`, {
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
