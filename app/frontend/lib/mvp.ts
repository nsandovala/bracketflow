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

export type PlayerMvpTie = {
  kind: "player_tie";
  players: PlayerMvp[];
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

export type TeamMvpTie = {
  kind: "team_tie";
  teams: TeamMvp[];
  kills: number;
};

export type MvpState =
  | PlayerMvp
  | PlayerMvpTie
  | TeamMvp
  | TeamMvpTie
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

  if (byPlayer.size > 0) {
    let maxKills = -1;
    for (const candidate of byPlayer.values()) {
      if (candidate.kills > maxKills) {
        maxKills = candidate.kills;
      }
    }
    const tiedPlayers: PlayerMvp[] = [];
    for (const candidate of byPlayer.values()) {
      if (candidate.kills === maxKills) {
        tiedPlayers.push(candidate);
      }
    }
    if (tiedPlayers.length === 1) {
      return tiedPlayers[0];
    }
    if (tiedPlayers.length > 1) {
      // Deterministic ordering: matches desc, then alphabetical
      tiedPlayers.sort((a, b) => {
        if (b.matches !== a.matches) return b.matches - a.matches;
        return a.playerName.localeCompare(b.playerName);
      });
      return {
        kind: "player_tie",
        players: tiedPlayers,
        kills: maxKills,
        matches: tiedPlayers[0].matches,
      };
    }
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

  if (teamMvp) {
    // Check for team ties at top
    const tiedTeams = standings.filter(
      (s) =>
        s.kills === teamMvp!.kills &&
        s.total_points === teamMvp!.total_points
    );
    if (tiedTeams.length > 1) {
      tiedTeams.sort((a, b) => a.team_name.localeCompare(b.team_name));
      return {
        kind: "team_tie",
        teams: tiedTeams.map((t) => ({
          kind: "team" as const,
          teamId: t.team_id,
          teamName: t.team_name,
          kills: t.kills,
          totalPoints: t.total_points,
        })),
        kills: teamMvp.kills,
      };
    }
    return {
      kind: "team",
      teamId: teamMvp.team_id,
      teamName: teamMvp.team_name,
      kills: teamMvp.kills,
      totalPoints: teamMvp.total_points,
    };
  }

  return { kind: "pending" };
}
