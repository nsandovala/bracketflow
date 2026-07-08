"use client";

import { useEffect, useRef, useState } from "react";

import {
  LeaderboardEntry,
  Match,
  Team,
  Tournament,
  getLeaderboard,
  getMatches,
  getTeams,
  getTournament,
  getTournamentResults,
} from "../../lib/api";
import { ACTIVE_WORLD_SERIES_TOURNAMENT_KEY } from "./useWorldSeriesPractice";
import { resolveTournamentEngine } from "../../lib/tournamentModel";

// Polling del Stream View. Vive solo en /stream — no afecta a otros consumidores.
export const STREAM_POLL_INTERVAL_MS = 7000;

export type StreamStanding = LeaderboardEntry & {
  players: string[];
};

export type StreamLeaderboardState = {
  tournament: Tournament | null;
  teams: Team[];
  matches: Match[];
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

// Firma estable para comparar fetch nuevo vs actual y evitar re-render/parpadeo.
function buildSignature(
  tournament: Tournament | null,
  teams: Team[],
  standings: StreamStanding[],
  afterGameNumber: number
) {
  const championKey =
    tournament?.config?.championTeamId != null
      ? `${tournament.config.championTeamId}:${tournament.config.championDecidedAt ?? ""}`
      : "";
  const roster = teams
    .map(
      (team) =>
        `${team.id}:${team.name}:${team.members.map((member) => member.player.nickname).join(",")}`
    )
    .join("|");
  const rows = standings
    .map(
      (entry) =>
        `${entry.team_id}:${entry.total_points}:${entry.kills}:${entry.best_placement ?? "-"}:${entry.matches_played}:${entry.players.join(",")}`
    )
    .join("|");
  return `${tournament?.id ?? "-"}:${tournament?.name ?? "-"}:${tournament?.game ?? "-"}:${tournament?.status ?? "-"}:${championKey}:${afterGameNumber}:${roster}:${rows}`;
}

async function resolveTournamentId(preferredId: number | null): Promise<number | null> {
  if (preferredId !== null) {
    return preferredId;
  }
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(ACTIVE_WORLD_SERIES_TOURNAMENT_KEY);
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function useStreamLeaderboard(
  preferredTournamentId: number | null,
  pollMs: number = STREAM_POLL_INTERVAL_MS
): StreamLeaderboardState {
  const [state, setState] = useState<StreamLeaderboardState>({
    tournament: null,
    teams: [],
    matches: [],
    standings: [],
    afterGameNumber: 0,
    connected: false,
    hasLoadedOnce: false,
  });

  // Firma del ultimo estado pintado: si el fetch nuevo coincide, no tocamos React.
  const signatureRef = useRef<string>("");

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function fetchOnce() {
      try {
        const tournamentId = await resolveTournamentId(preferredTournamentId);
        if (tournamentId === null) {
          if (!active) return;
          setState((current) =>
            current.connected && current.hasLoadedOnce && current.tournament === null
              ? current
              : {
                  tournament: null,
                  teams: [],
                  matches: [],
                  standings: [],
                  afterGameNumber: 0,
                  connected: true,
                  hasLoadedOnce: true,
                }
          );
          return;
        }

        const tournament = await getTournament(tournamentId);
        const engine = resolveTournamentEngine(tournament);
        const isBracket =
          engine.scoringProfile === "kill_race" ||
          engine.tournamentStructure !== "cumulative";
        const [teams, results, matches] = await Promise.all([
          getTeams(tournamentId),
          isBracket ? Promise.resolve([]) : getTournamentResults(tournamentId),
          getMatches(tournamentId),
        ]);
        const leaderboard = isBracket ? [] : await getLeaderboard(tournamentId);

        if (!active) return;

        const standings = buildStandings(leaderboard, teams);
        const afterGameNumber = isBracket
          ? matches.some((match) => match.maps.length > 0 || match.winner_id !== null)
            ? 1
            : 0
          : results.length === 0
            ? 0
            : Math.max(...results.map((result) => result.round));
        const nextSignature = buildSignature(tournament, teams, standings, afterGameNumber);

        // Solo re-render si cambio el contenido o si veniamos desconectados.
        setState((current) => {
          if (
            nextSignature === signatureRef.current &&
            current.connected &&
            current.hasLoadedOnce
          ) {
            return current;
          }
          signatureRef.current = nextSignature;
          return {
            tournament,
            teams,
            matches,
            standings,
            afterGameNumber,
            connected: true,
            hasLoadedOnce: true,
          };
        });
      } catch {
        if (!active) return;
        // Backend caido: conservamos la ultima data valida, solo bajamos la bandera.
        setState((current) => (current.connected ? { ...current, connected: false } : current));
      }
    }

    void fetchOnce();
    timer = setInterval(() => void fetchOnce(), pollMs);

    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [preferredTournamentId, pollMs]);

  return state;
}
