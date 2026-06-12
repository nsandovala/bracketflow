"use client";

import { useEffect, useState } from "react";

import {
  LeaderboardEntry,
  Team,
  Tournament,
  getLeaderboard,
  getTeams,
  getTournament,
  getTournamentResults,
  getTournaments,
} from "../../lib/api";

export type StreamStanding = LeaderboardEntry & {
  players: string[];
};

export type StreamLeaderboardState = {
  tournament: Tournament | null;
  standings: StreamStanding[];
  afterGameNumber: number;
  connected: boolean;
  hasLoadedOnce: boolean;
};

// Mismo criterio de orden que el resto de la app (puntos, kills, best place, nombre).
function sortStandings(entries: LeaderboardEntry[]) {
  return [...entries].sort((left, right) => {
    if (right.total_points !== left.total_points) {
      return right.total_points - left.total_points;
    }
    if (right.kills !== left.kills) {
      return right.kills - left.kills;
    }
    if (left.best_placement !== right.best_placement) {
      return (
        (left.best_placement ?? Number.MAX_SAFE_INTEGER) -
        (right.best_placement ?? Number.MAX_SAFE_INTEGER)
      );
    }
    return left.team_name.localeCompare(right.team_name);
  });
}

function buildStandings(leaderboard: LeaderboardEntry[], teams: Team[]): StreamStanding[] {
  return sortStandings(leaderboard).map((entry) => {
    const team = teams.find((candidate) => candidate.id === entry.team_id);
    return {
      ...entry,
      players: team?.members.map((member) => member.player.nickname) ?? [],
    };
  });
}

async function resolveTournamentId(preferredId: number | null): Promise<number | null> {
  if (preferredId !== null) {
    return preferredId;
  }
  const tournaments = await getTournaments();
  const worldSeries = tournaments.filter(
    (tournament) => tournament.format === "battle_royale_points"
  );
  return worldSeries[0]?.id ?? null;
}

export function useStreamLeaderboard(preferredTournamentId: number | null): StreamLeaderboardState {
  const [state, setState] = useState<StreamLeaderboardState>({
    tournament: null,
    standings: [],
    afterGameNumber: 0,
    connected: false,
    hasLoadedOnce: false,
  });

  useEffect(() => {
    let active = true;

    async function fetchOnce() {
      try {
        const tournamentId = await resolveTournamentId(preferredTournamentId);
        if (tournamentId === null) {
          if (!active) return;
          setState((current) => ({ ...current, connected: true, hasLoadedOnce: true }));
          return;
        }

        const [tournament, teams, leaderboard, results] = await Promise.all([
          getTournament(tournamentId),
          getTeams(tournamentId),
          getLeaderboard(tournamentId),
          getTournamentResults(tournamentId),
        ]);

        if (!active) return;

        const standings = buildStandings(leaderboard, teams);
        const afterGameNumber =
          results.length === 0 ? 0 : Math.max(...results.map((result) => result.round));

        setState({
          tournament,
          standings,
          afterGameNumber,
          connected: true,
          hasLoadedOnce: true,
        });
      } catch {
        if (!active) return;
        setState((current) => (current.connected ? { ...current, connected: false } : current));
      }
    }

    void fetchOnce();

    return () => {
      active = false;
    };
  }, [preferredTournamentId]);

  return state;
}
