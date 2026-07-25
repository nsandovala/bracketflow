import type { TeamResultDetail } from "./api";

export type MvpStanding = {
  team_id: number;
  team_name: string;
  kills: number;
  total_points: number;
};

export type MvpPlayerEntry = {
  playerName: string;
  teamId: number;
  teamName: string;
  kills: number;
  matches: number;
};

export type PlayerMvp = MvpPlayerEntry & {
  kind: "player";
  // Otros jugadores con el mismo total de kills que el MVP. Excluye al propio MVP.
  tiedWith: MvpPlayerEntry[];
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

export function getMvpPlayerRanking(results: TeamResultDetail[]): MvpPlayerEntry[] {
  const byPlayer = new Map<string, MvpPlayerEntry>();

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
          playerName,
          teamId: result.team_id,
          teamName: result.team_name,
          kills: stat.kills,
          matches: 1,
        });
      }
    }
  }

  return Array.from(byPlayer.values()).sort(
    (left, right) =>
      right.kills - left.kills ||
      right.matches - left.matches ||
      left.playerName.localeCompare(right.playerName)
  );
}

export function getMvpState(
  results: TeamResultDetail[],
  standings: MvpStanding[]
): MvpState {
  const players = getMvpPlayerRanking(results);
  if (players.length > 0) {
    const topKills = players.reduce(
      (max, candidate) => (candidate.kills > max ? candidate.kills : max),
      0
    );
    // topKills=0 sigue significando "sin ninguna kill reportada"; mantenemos el
    // fallback a Team MVP para no anunciar un empate 0-0 como MVP legitimo.
    if (topKills > 0) {
      const topPlayers = players
        .filter((candidate) => candidate.kills === topKills)
        .sort((left, right) => left.playerName.localeCompare(right.playerName));
      const [head, ...rest] = topPlayers;
      return {
        kind: "player",
        ...head,
        tiedWith: rest,
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
