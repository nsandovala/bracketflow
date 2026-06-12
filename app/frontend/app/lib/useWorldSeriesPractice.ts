"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  LeaderboardEntry,
  Match,
  Team,
  TeamResultDetail,
  Tournament,
  addTeamMember,
  createBattleRoyaleMatch,
  createPlayer,
  createTeam,
  createTournament,
  getHealth,
  getLeaderboard,
  getMatches,
  getPlayers,
  getTournament,
  getTournamentResults,
  getTournaments,
  getTeams,
  saveMatchResult,
} from "../../lib/api";

const ACTIVE_WORLD_SERIES_TOURNAMENT_KEY = "bf:world-series-practice:tournament-id";

export type ResultDraft = {
  kills: string;
  placement: string;
};

export type WorldSeriesStanding = LeaderboardEntry & {
  players: string[];
};

function getDraftKey(matchId: number, teamId: number) {
  return `${matchId}:${teamId}`;
}

function readStoredTournamentId() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(ACTIVE_WORLD_SERIES_TOURNAMENT_KEY);
  if (!raw) {
    return null;
  }

  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function persistTournamentId(tournamentId: number | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (tournamentId === null) {
    window.localStorage.removeItem(ACTIVE_WORLD_SERIES_TOURNAMENT_KEY);
    return;
  }

  window.localStorage.setItem(ACTIVE_WORLD_SERIES_TOURNAMENT_KEY, String(tournamentId));
}

function normalizeAlias(value: string) {
  return value.trim().toLocaleLowerCase();
}

function sortStandings(entries: LeaderboardEntry[]) {
  return [...entries].sort((left, right) => {
    if (right.total_points !== left.total_points) {
      return right.total_points - left.total_points;
    }
    if (right.kills !== left.kills) {
      return right.kills - left.kills;
    }
    if (left.best_placement !== right.best_placement) {
      return (left.best_placement ?? Number.MAX_SAFE_INTEGER) - (right.best_placement ?? Number.MAX_SAFE_INTEGER);
    }
    return left.team_name.localeCompare(right.team_name);
  });
}

function parseRosterAliases(rosterValue: string) {
  return rosterValue
    .split(/,|\n/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export function useWorldSeriesPractice(preferredTournamentId?: number | null) {
  const [backendOnline, setBackendOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<number | null>(null);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [tournamentResults, setTournamentResults] = useState<TeamResultDetail[]>([]);
  const [players, setPlayers] = useState<{ id: number; nickname: string; tournament_id: number }[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [resultDrafts, setResultDrafts] = useState<Record<string, ResultDraft>>({});

  const selectedMatchIdRef = useRef<number | null>(selectedMatchId);

  useEffect(() => {
    selectedMatchIdRef.current = selectedMatchId;
  }, [selectedMatchId]);

  const refreshSelectedTournament = useCallback(
    async (tournamentId: number, options?: { preferLatestMatch?: boolean }) => {
      const tournament = await getTournament(tournamentId);
      if (tournament.format !== "battle_royale_points") {
        throw new Error("Selected tournament is not a World Series Practice tournament");
      }

      const [nextTeams, nextMatches, nextLeaderboard, nextResults, nextPlayers] = await Promise.all([
        getTeams(tournamentId),
        getMatches(tournamentId),
        getLeaderboard(tournamentId),
        getTournamentResults(tournamentId),
        getPlayers(tournamentId),
      ]);

      const battleRoyaleMatches = nextMatches.filter(
        (match) => match.team_a_id === null && match.team_b_id === null
      );
      const latestMatchId = battleRoyaleMatches.at(-1)?.id ?? null;
      const resolvedMatchId = options?.preferLatestMatch
        ? latestMatchId
        : selectedMatchIdRef.current !== null &&
            battleRoyaleMatches.some((match) => match.id === selectedMatchIdRef.current)
          ? selectedMatchIdRef.current
          : latestMatchId;

      setSelectedTournament(tournament);
      setTeams(nextTeams);
      setMatches(nextMatches);
      setLeaderboard(nextLeaderboard);
      setTournamentResults(nextResults);
      setPlayers(nextPlayers);
      setSelectedMatchId(resolvedMatchId);
    },
    []
  );

  const refreshTournaments = useCallback(
    async (nextSelectedId?: number | null) => {
      const allTournaments = await getTournaments();
      const worldSeriesTournaments = allTournaments.filter(
        (tournament) => tournament.format === "battle_royale_points"
      );
      setTournaments(worldSeriesTournaments);

      const requestedId = nextSelectedId ?? preferredTournamentId ?? readStoredTournamentId();
      const resolvedTournamentId =
        requestedId !== null &&
        worldSeriesTournaments.some((tournament) => tournament.id === requestedId)
          ? requestedId
          : worldSeriesTournaments[0]?.id ?? null;

      persistTournamentId(resolvedTournamentId);
      setSelectedTournamentId(resolvedTournamentId);

      if (resolvedTournamentId === null) {
        setSelectedTournament(null);
        setTeams([]);
        setMatches([]);
        setLeaderboard([]);
        setTournamentResults([]);
        setPlayers([]);
        setSelectedMatchId(null);
        setResultDrafts({});
        return;
      }

      await refreshSelectedTournament(resolvedTournamentId);
    },
    [preferredTournamentId, refreshSelectedTournament]
  );

  const loadInitialData = useCallback(async () => {
    try {
      const health = await getHealth();
      setBackendOnline(health.status === "ok");
      await refreshTournaments();
    } catch {
      setBackendOnline(false);
      setMessage("No se pudo conectar al backend.");
    } finally {
      setLoading(false);
    }
  }, [refreshTournaments]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadInitialData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadInitialData]);

  useEffect(() => {
    if (selectedTournamentId === null) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void refreshSelectedTournament(selectedTournamentId);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [refreshSelectedTournament, selectedTournamentId]);

  function selectTournament(tournamentId: number) {
    persistTournamentId(tournamentId);
    setSelectedTournamentId(tournamentId);
    setSelectedMatchId(null);
    setResultDrafts({});
    setMessage(null);
  }

  function updateResultDraft(matchId: number, teamId: number, patch: Partial<ResultDraft>) {
    const key = getDraftKey(matchId, teamId);
    setResultDrafts((current) => ({
      ...current,
      [key]: {
        kills: patch.kills ?? current[key]?.kills ?? "",
        placement: patch.placement ?? current[key]?.placement ?? "",
      },
    }));
  }

  const battleRoyaleMatches = useMemo(
    () => matches.filter((match) => match.team_a_id === null && match.team_b_id === null),
    [matches]
  );

  const activeMatch = useMemo(
    () =>
      battleRoyaleMatches.find((match) => match.id === selectedMatchId) ??
      battleRoyaleMatches.at(-1) ??
      null,
    [battleRoyaleMatches, selectedMatchId]
  );

  const activeMatchResults = useMemo(
    () =>
      activeMatch
        ? tournamentResults.filter((result) => result.match_id === activeMatch.id)
        : [],
    [activeMatch, tournamentResults]
  );

  const pendingTeams = useMemo(
    () =>
      teams.filter(
        (team) => !activeMatchResults.some((result) => result.team_id === team.id)
      ),
    [activeMatchResults, teams]
  );

  const sortedStandings = useMemo<WorldSeriesStanding[]>(() => {
    const sorted = sortStandings(leaderboard);
    return sorted.map((entry) => {
      const team = teams.find((candidate) => candidate.id === entry.team_id);
      return {
        ...entry,
        players: team?.members.map((member) => member.player.nickname) ?? [],
      };
    });
  }, [leaderboard, teams]);

  const latestReportedRound = useMemo(() => {
    if (tournamentResults.length === 0) {
      return 0;
    }
    return Math.max(...tournamentResults.map((result) => result.round));
  }, [tournamentResults]);

  const nextGameNumber = useMemo(() => {
    if (battleRoyaleMatches.length === 0) {
      return 1;
    }
    return Math.max(...battleRoyaleMatches.map((match) => match.round)) + 1;
  }, [battleRoyaleMatches]);

  const reportsLoaded = activeMatchResults.length;
  const totalTeams = teams.length;
  const canCreateNextGame = totalTeams > 0 && (activeMatch === null || reportsLoaded === totalTeams);

  async function createWorldSeriesTournament(payload: { name: string; game: string }) {
    setSubmitting(true);
    setMessage(null);

    try {
      const tournament = await createTournament({
        ...payload,
        format: "battle_royale_points",
        team_size: 2,
        scoring_profile: "wsow_like",
      });
      await refreshTournaments(tournament.id);
      setMessage(`Torneo creado: ${tournament.name}`);
      return tournament;
    } catch {
      setMessage("No se pudo crear el torneo.");
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  async function createTeamWithRoster(payload: { name: string; roster: string }) {
    if (selectedTournamentId === null) {
      throw new Error("No active tournament");
    }

    const teamName = payload.name.trim();
    const rosterAliases = parseRosterAliases(payload.roster);

    if (!teamName) {
      throw new Error("Escribe un nombre de equipo.");
    }
    if (rosterAliases.length === 0) {
      throw new Error("Carga al menos un player para el equipo.");
    }

    const existingTeamNames = new Set(teams.map((team) => normalizeAlias(team.name)));
    if (existingTeamNames.has(normalizeAlias(teamName))) {
      throw new Error("Ese equipo ya esta cargado.");
    }

    const existingPlayerNames = new Set(players.map((player) => normalizeAlias(player.nickname)));
    const newPlayerNames = new Set<string>();
    for (const alias of rosterAliases) {
      const normalized = normalizeAlias(alias);
      if (existingPlayerNames.has(normalized) || newPlayerNames.has(normalized)) {
        throw new Error(`El player ${alias} ya existe en el torneo.`);
      }
      newPlayerNames.add(normalized);
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const createdTeam = await createTeam(selectedTournamentId, { name: teamName });
      for (const alias of rosterAliases) {
        const createdPlayer = await createPlayer(selectedTournamentId, { nickname: alias });
        await addTeamMember(createdTeam.id, { player_id: createdPlayer.id });
      }
      await refreshSelectedTournament(selectedTournamentId);
      setMessage(`Equipo agregado: ${teamName}`);
    } catch (error) {
      if (error instanceof Error) {
        setMessage(error.message);
      } else {
        setMessage("No se pudo crear el equipo.");
      }
      throw error;
    } finally {
      setSubmitting(false);
    }
  }

  async function createNextGame() {
    if (selectedTournamentId === null) {
      return null;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const match = await createBattleRoyaleMatch(selectedTournamentId, { round: nextGameNumber });
      await refreshSelectedTournament(selectedTournamentId, { preferLatestMatch: true });
      setMessage(`Game ${match.round} creado.`);
      return match;
    } catch {
      setMessage("No se pudo crear el siguiente game.");
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  async function saveTeamReport(matchId: number, teamId: number) {
    const key = getDraftKey(matchId, teamId);
    const saved = activeMatchResults.find((result) => result.team_id === teamId);
    const killsValue = resultDrafts[key]?.kills ?? (saved ? String(saved.kills) : "");
    const placementValue = resultDrafts[key]?.placement ?? (saved ? String(saved.placement) : "");

    if (killsValue.trim() === "" || placementValue.trim() === "") {
      throw new Error("Completa kills y placement.");
    }
    if (selectedTournamentId === null) {
      throw new Error("No active tournament");
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const result = await saveMatchResult(matchId, {
        team_id: teamId,
        kills: Number(killsValue),
        placement: Number(placementValue),
      });
      await refreshSelectedTournament(selectedTournamentId);
      setResultDrafts((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      setMessage(`Reporte guardado: ${teams.find((team) => team.id === teamId)?.name ?? "equipo"}`);
      return result;
    } catch {
      setMessage("No se pudo guardar el reporte.");
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  return {
    backendOnline,
    loading,
    submitting,
    message,
    tournaments,
    selectedTournamentId,
    selectedTournament,
    teams,
    players,
    matches: battleRoyaleMatches,
    leaderboard,
    tournamentResults,
    activeMatch,
    activeMatchResults,
    pendingTeams,
    sortedStandings,
    selectedMatchId,
    resultDrafts,
    reportsLoaded,
    totalTeams,
    canCreateNextGame,
    currentGameNumber: activeMatch?.round ?? 0,
    nextGameNumber,
    latestReportedRound,
    setMessage,
    setSelectedMatchId,
    setResultDrafts,
    selectTournament,
    updateResultDraft,
    createWorldSeriesTournament,
    createTeamWithRoster,
    createNextGame,
    saveTeamReport,
  };
}
