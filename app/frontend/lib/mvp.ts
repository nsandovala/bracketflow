import type { TeamResultDetail } from "./api";

export type MvpStanding = {
  team_id: number;
  team_name: string;
  kills: number;
  total_points: number;
};

export type PlayerMvp = {
  kind: "player";
  playerName: string;
  teamId: number;
  teamName: string;
  kills: number;
  matches: number;
};

export type TeamMvp = {
  kind: "team";
  teamId: number;
  teamName: string;
  kills: number;
  totalPoints: number;
};

export type MvpState =
  | PlayerMvp
  | TeamMvp
  | { kind: "pending" };

export function getMvpState(
  results: TeamResultDetail[],
  standings: MvpStanding[]
): MvpState {
  const byPlayer = new Map<string, PlayerMvp>();

  for (const result of results) {
    for (const stat of result.player_stats ?? []) {
      const playerName = stat.player_name.trim();
      if (!playerName) {
        continue;
      }

      const key = `${result.team_id}::${playerName.toLocaleLowerCase()}`;
      const current = byPlayer.get(key);
      if (current) {
        current.kills += stat.kills;
        current.matches += 1;
      } else {
        byPlayer.set(key, {
          kind: "player",
          playerName,
          teamId: result.team_id,
          teamName: result.team_name,
          kills: stat.kills,
          matches: 1,
        });
      }
    }
  }

  let playerMvp: PlayerMvp | null = null;
  for (const candidate of byPlayer.values()) {
    if (
      !playerMvp ||
      candidate.kills > playerMvp.kills ||
      (candidate.kills === playerMvp.kills &&
        candidate.playerName.localeCompare(playerMvp.playerName) < 0)
    ) {
      playerMvp = candidate;
    }
  }
  if (playerMvp) {
    return playerMvp;
  }

  let teamMvp: MvpStanding | null = null;
  for (const candidate of standings) {
    if (
      !teamMvp ||
      candidate.kills > teamMvp.kills ||
      (candidate.kills === teamMvp.kills &&
        candidate.total_points > teamMvp.total_points) ||
      (candidate.kills === teamMvp.kills &&
        candidate.total_points === teamMvp.total_points &&
        candidate.team_name.localeCompare(teamMvp.team_name) < 0)
    ) {
      teamMvp = candidate;
    }
  }

  return teamMvp
    ? {
        kind: "team",
        teamId: teamMvp.team_id,
        teamName: teamMvp.team_name,
        kills: teamMvp.kills,
        totalPoints: teamMvp.total_points,
      }
    : { kind: "pending" };
}
