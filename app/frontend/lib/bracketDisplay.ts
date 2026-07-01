import type { Match, Team } from "./api";

export type PreviewRosterTeam = {
  id?: number;
  name: string;
  players: Array<{ nickname: string }>;
};

export type BracketTeam = Team | PreviewRosterTeam;

export type BracketMatch = {
  id: number;
  label: string;
  left: string;
  right: string;
  leftMeta?: string;
  rightMeta?: string;
  status: string;
};

export type BracketRound = {
  title: string;
  matches: BracketMatch[];
};

export function getTeamPlayers(team: BracketTeam) {
  if ("members" in team) {
    return team.members.map((member) => member.player.nickname);
  }
  return team.players.map((player) => player.nickname);
}

export function getTeamDisplayName(team: BracketTeam) {
  const players = getTeamPlayers(team);
  return players.length > 0 ? players.join(" / ") : team.name;
}

export function getTeamShortDisplayName(team: BracketTeam, maxNames: number = 3) {
  const players = getTeamPlayers(team);
  if (players.length === 0) {
    return team.name;
  }
  const visible = players.slice(0, maxNames).join(" / ");
  return players.length > maxNames ? `${visible} +${players.length - maxNames}` : visible;
}

export function getTeamSeedLabel(team: BracketTeam, fallbackIndex?: number) {
  const numericName = team.name.match(/\d+/)?.[0];
  return numericName ? `Seed #${numericName}` : `Seed #${fallbackIndex ?? "?"}`;
}

function roundTitle(roundNumber: number, totalRounds: number) {
  if (roundNumber === totalRounds) {
    return "Final";
  }
  if (roundNumber === totalRounds - 1) {
    return "Semifinal";
  }
  return `Round ${roundNumber}`;
}

function getApiTeamShortDisplayName(team: Team | undefined, maxNames: number) {
  if (!team) {
    return "";
  }
  return getTeamShortDisplayName(team, maxNames);
}

function getSeriesMeta(match: Match, side: "a" | "b") {
  if (match.status === "completed" && match.winner_id !== null) {
    const mapsWon = side === "a" ? match.maps_won_a : match.maps_won_b;
    return match.winner_id === (side === "a" ? match.team_a_id : match.team_b_id)
      ? `Gana ${mapsWon}-${side === "a" ? match.maps_won_b : match.maps_won_a}`
      : `Pierde ${mapsWon}-${side === "a" ? match.maps_won_b : match.maps_won_a}`;
  }
  if (match.maps.length > 0) {
    return `Serie ${match.maps_won_a}-${match.maps_won_b}`;
  }
  return undefined;
}

function getFutureSlotLabel(matchId: number) {
  return `Ganador M${matchId}`;
}

export function buildSingleElimBracket(
  matches: Match[],
  teams: Team[],
  teamSize: number
): BracketRound[] {
  if (matches.length === 0) {
    return [];
  }

  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const matchesById = new Map(matches.map((match) => [match.id, match]));
  const totalRounds = Math.max(...matches.map((match) => match.round));
  const maxNames = teamSize <= 2 ? 2 : 3;

  return Array.from({ length: totalRounds }, (_, index) => {
    const roundNumber = index + 1;
    const roundMatches = matches
      .filter((match) => match.round === roundNumber)
      .map((match) => {
        const leftTeam = match.team_a_id ? teamsById.get(match.team_a_id) : undefined;
        const rightTeam = match.team_b_id ? teamsById.get(match.team_b_id) : undefined;
        const feederMatches = matches.filter((candidate) => candidate.next_match_id === match.id);
        const leftFeeder = feederMatches.find((candidate) => candidate.next_slot === "a");
        const rightFeeder = feederMatches.find((candidate) => candidate.next_slot === "b");
        const left = leftTeam
          ? getTeamShortDisplayName(leftTeam, maxNames)
          : leftFeeder && matchesById.get(leftFeeder.id)?.winner_id === null
            ? getFutureSlotLabel(leftFeeder.id)
            : "Slot pendiente";
        const right = rightTeam
          ? getApiTeamShortDisplayName(rightTeam, maxNames)
          : rightFeeder && matchesById.get(rightFeeder.id)?.winner_id === null
            ? getFutureSlotLabel(rightFeeder.id)
            : "Slot pendiente";
        const leftDisplay = leftTeam
          ? getApiTeamShortDisplayName(leftTeam, maxNames)
          : left;

        return {
          id: match.id,
          label: `Match ${match.id}`,
          left: leftDisplay,
          right,
          leftMeta: getSeriesMeta(match, "a"),
          rightMeta: getSeriesMeta(match, "b"),
          status: match.status,
        };
      });

    return {
      title: roundTitle(roundNumber, totalRounds),
      matches: roundMatches,
    };
  });
}
