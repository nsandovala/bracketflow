import type { Player, Team } from "./api";

export type PreviewRosterTeam = {
  id?: number;
  name: string;
  players: Player[];
};

export type BracketTeam = Team | PreviewRosterTeam;

export type BracketMatch = {
  id: string;
  label: string;
  left: string;
  right: string;
  leftMeta?: string;
  rightMeta?: string;
  status: "pending" | "bye";
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

function buildRoundOne(teams: BracketTeam[], maxNames: number): BracketMatch[] {
  const matches: BracketMatch[] = [];
  for (let index = 0; index < teams.length; index += 2) {
    const left = teams[index];
    const right = teams[index + 1] ?? null;
    matches.push({
      id: `r1-m${matches.length + 1}`,
      label: `Match ${matches.length + 1}`,
      left: getTeamShortDisplayName(left, maxNames),
      right: right ? getTeamShortDisplayName(right, maxNames) : "BYE",
      leftMeta: getTeamSeedLabel(left, index + 1),
      rightMeta: right ? getTeamSeedLabel(right, index + 2) : undefined,
      status: right ? "pending" : "bye",
    });
  }
  return matches;
}

function roundTitle(roundIndex: number, totalRounds: number) {
  if (roundIndex === totalRounds - 1) {
    return "Final";
  }
  if (roundIndex === totalRounds - 2) {
    return "Semifinal";
  }
  return `Round ${roundIndex + 1}`;
}

export function buildSingleElimBracket(teams: BracketTeam[], teamSize: number): BracketRound[] {
  if (teams.length === 0) {
    return [];
  }

  const maxNames = teamSize <= 2 ? 2 : 3;
  const rounds: BracketRound[] = [
    {
      title: "Round 1",
      matches: buildRoundOne(teams, maxNames),
    },
  ];

  let previousMatchCount = rounds[0].matches.length;
  while (previousMatchCount > 1) {
    const roundIndex = rounds.length;
    const nextMatchCount = Math.ceil(previousMatchCount / 2);
    const matches: BracketMatch[] = [];
    for (let index = 0; index < nextMatchCount; index += 1) {
      const leftSource = index * 2 + 1;
      const rightSource = leftSource + 1;
      matches.push({
        id: `r${roundIndex + 1}-m${index + 1}`,
        label: `Match ${index + 1}`,
        left: `Winner M${leftSource}`,
        right: rightSource <= previousMatchCount ? `Winner M${rightSource}` : "BYE",
        status: rightSource <= previousMatchCount ? "pending" : "bye",
      });
    }
    rounds.push({ title: roundTitle(roundIndex, rounds.length + 1), matches });
    previousMatchCount = nextMatchCount;
  }

  const totalRounds = rounds.length;
  return rounds.map((round, index) => ({
    ...round,
    title: index === 0 ? "Round 1" : roundTitle(index, totalRounds),
  }));
}
