import type { ISeedProps, IRoundProps } from "react-brackets";

import type { Match, Team } from "./api";

type ReactBracketStatusTone = "completed" | "live" | "ready" | "future";

type ReactBracketTeam = {
  id: string;
  name: string;
  roster: string;
  score: number | null;
  badge?: string;
  stateLabel: string;
  isBye: boolean;
  isEmpty: boolean;
  isFuture: boolean;
  isWinner: boolean;
  isLoser: boolean;
};

export type ReactBracketSeed = ISeedProps & {
  matchId: number;
  matchLabel: string;
  bestOf: number;
  status: Match["status"];
  statusLabel: string;
  statusTone: ReactBracketStatusTone;
  teams: [ReactBracketTeam, ReactBracketTeam];
};

const GENERIC_TEAM_NAME = /^(team|equipo)\s+\d+$/i;

function getTeamRoster(team: Team) {
  const players = team.members
    .map((member) => member.player.nickname.trim())
    .filter((nickname) => nickname.length > 0);

  return players.length > 0 ? players.join(" / ") : "Roster pendiente";
}

function getRosterLabel(team: Team, maxNames: number) {
  const players = team.members
    .map((member) => member.player.nickname.trim())
    .filter((nickname) => nickname.length > 0);

  if (players.length === 0) {
    return team.name.trim() || "Equipo pendiente";
  }

  const visible = players.slice(0, maxNames).join(" / ");
  return players.length > maxNames ? `${visible} +${players.length - maxNames}` : visible;
}

function hasRealTeamName(team: Team) {
  const name = team.name.trim();
  return name.length > 0 && !GENERIC_TEAM_NAME.test(name);
}

function getTeamDisplayName(team: Team, maxNames: number) {
  return hasRealTeamName(team) ? team.name.trim() : getRosterLabel(team, maxNames);
}

function roundTitle(roundNumber: number, totalRounds: number) {
  if (roundNumber === totalRounds) {
    return "Final";
  }
  if (roundNumber === totalRounds - 1) {
    return "Semifinal";
  }
  if (roundNumber === totalRounds - 2) {
    return "Cuartos";
  }
  return `Round ${roundNumber}`;
}

function getStatusMeta(status: Match["status"]): {
  label: string;
  tone: ReactBracketStatusTone;
} {
  switch (status) {
    case "completed":
      return { label: "Completado", tone: "completed" };
    case "in_progress":
      return { label: "En vivo", tone: "live" };
    case "ready":
      return { label: "Pendiente", tone: "ready" };
    case "waiting_opponent":
    case "pending":
    default:
      return { label: "Slot futuro", tone: "future" };
  }
}

function getFutureSlotLabel(matchId: number) {
  return `Ganador M${matchId}`;
}

function getTeamStateLabel(match: Match, teamId: number) {
  if (match.winner_id === teamId) {
    return "Ganador";
  }
  if (match.winner_id !== null) {
    return "Eliminado";
  }
  if (match.status === "in_progress") {
    return "Serie abierta";
  }
  if (match.status === "ready") {
    return "Listo";
  }
  return "Pendiente";
}

function buildPlaceholderTeam(
  match: Match,
  side: "a" | "b",
  feeder: Match | undefined,
  otherTeamExists: boolean
): ReactBracketTeam {
  if (feeder && feeder.winner_id === null) {
    return {
      id: `future-${match.id}-${side}`,
      name: getFutureSlotLabel(feeder.id),
      roster: "Slot futuro",
      score: null,
      stateLabel: "Slot futuro",
      isBye: false,
      isEmpty: false,
      isFuture: true,
      isWinner: false,
      isLoser: false,
    };
  }

  if (otherTeamExists && match.round === 1) {
    return {
      id: `bye-${match.id}-${side}`,
      name: "BYE",
      roster: "Libre",
      score: null,
      stateLabel: "BYE",
      isBye: true,
      isEmpty: false,
      isFuture: false,
      isWinner: false,
      isLoser: false,
    };
  }

  return {
    id: `pending-${match.id}-${side}`,
    name: "Slot pendiente",
    roster: "Serie pendiente",
    score: null,
    stateLabel: "Pendiente",
    isBye: false,
    isEmpty: true,
    isFuture: false,
    isWinner: false,
    isLoser: false,
  };
}

export function toBracketRounds(
  matches: Match[],
  teams: Team[],
  teamSize: number
): IRoundProps[] {
  if (matches.length === 0) {
    return [];
  }

  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const feedersByMatchId = new Map<number, { a?: Match; b?: Match }>();
  const totalRounds = Math.max(...matches.map((match) => match.round));
  const maxNames = teamSize <= 2 ? 2 : 3;

  for (const match of matches) {
    if (match.next_match_id === null || (match.next_slot !== "a" && match.next_slot !== "b")) {
      continue;
    }

    const current = feedersByMatchId.get(match.next_match_id) ?? {};
    current[match.next_slot] = match;
    feedersByMatchId.set(match.next_match_id, current);
  }

  return Array.from({ length: totalRounds }, (_, index) => {
    const roundNumber = index + 1;
    const seeds = matches
      .filter((match) => match.round === roundNumber)
      .sort((left, right) => left.id - right.id)
      .map((match) => {
        const teamA = match.team_a_id ? teamsById.get(match.team_a_id) : undefined;
        const teamB = match.team_b_id ? teamsById.get(match.team_b_id) : undefined;
        const feeders = feedersByMatchId.get(match.id);
        const statusMeta = getStatusMeta(match.status);

        const left = teamA
          ? {
              id: String(teamA.id),
              name: getTeamDisplayName(teamA, maxNames),
              roster: getTeamRoster(teamA),
              score: match.maps_won_a,
              badge: match.winner_id === teamA.id ? "Avanza" : undefined,
              stateLabel: getTeamStateLabel(match, teamA.id),
              isBye: false,
              isEmpty: false,
              isFuture: false,
              isWinner: match.winner_id === teamA.id,
              isLoser: match.winner_id !== null && match.winner_id !== teamA.id,
            }
          : buildPlaceholderTeam(match, "a", feeders?.a, Boolean(teamB));

        const right = teamB
          ? {
              id: String(teamB.id),
              name: getTeamDisplayName(teamB, maxNames),
              roster: getTeamRoster(teamB),
              score: match.maps_won_b,
              badge: match.winner_id === teamB.id ? "Avanza" : undefined,
              stateLabel: getTeamStateLabel(match, teamB.id),
              isBye: false,
              isEmpty: false,
              isFuture: false,
              isWinner: match.winner_id === teamB.id,
              isLoser: match.winner_id !== null && match.winner_id !== teamB.id,
            }
          : buildPlaceholderTeam(match, "b", feeders?.b, Boolean(teamA));

        return {
          id: match.id,
          date: `BO${match.best_of}`,
          matchId: match.id,
          matchLabel: `Match ${match.id}`,
          bestOf: match.best_of,
          status: match.status,
          statusLabel: statusMeta.label,
          statusTone: statusMeta.tone,
          teams: [left, right] as [ReactBracketTeam, ReactBracketTeam],
        } satisfies ReactBracketSeed;
      });

    return {
      title: roundTitle(roundNumber, totalRounds),
      seeds,
    } satisfies IRoundProps;
  });
}
