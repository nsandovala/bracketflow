"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  LeaderboardEntry,
  Match,
  Team,
  TeamResultDetail,
  Tournament,
  addTeamMember,
  archiveTournament,
  createBattleRoyaleMatch,
  createPlayer,
  createTeam,
  createTournament,
  deleteTournament,
  generateRouletteTeams,
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
import {
  ENGINE_PRESETS,
  type EnginePreset,
  getEffectiveLobbySize,
  getMissingReportsMessage,
  isOperatorSupportedTournament,
  resolveTournamentEngine,
} from "../../lib/tournamentModel";

const ACTIVE_WORLD_SERIES_TOURNAMENT_KEY = "bf:world-series-practice:tournament-id";

export type ResultDraft = {
  kills: string;
  placement: string;
};

export type WorldSeriesStanding = LeaderboardEntry & {
  players: string[];
};

type ReportValidation =
  | { ok: true; kills: number; placement: number }
  | { ok: false; message: string };

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

function sortKillRaceStandings(entries: LeaderboardEntry[]) {
  return [...entries].sort((left, right) => {
    if (right.kills !== left.kills) {
      return right.kills - left.kills;
    }
    if (right.matches_played !== left.matches_played) {
      return right.matches_played - left.matches_played;
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

function parseRequiredNumber(value: string, missingMessage: string) {
  if (value.trim() === "") {
    return { ok: false as const, message: missingMessage };
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return { ok: false as const, message: missingMessage };
  }

  return { ok: true as const, value: parsed };
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
      if (!isOperatorSupportedTournament(tournament)) {
        throw new Error("Selected tournament is not supported by Operator yet");
      }
      const engine = resolveTournamentEngine(tournament);

      const standingsRequests =
        engine.primaryView === "standings"
          ? ([getLeaderboard(tournamentId), getTournamentResults(tournamentId)] as const)
          : ([Promise.resolve([]), Promise.resolve([])] as const);

      const [nextTeams, nextMatches, nextLeaderboard, nextResults, nextPlayers] = await Promise.all([
        getTeams(tournamentId),
        getMatches(tournamentId),
        ...standingsRequests,
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
      const worldSeriesTournaments = allTournaments.filter(isOperatorSupportedTournament);
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

  const selectedEngine = useMemo(
    () => (selectedTournament ? resolveTournamentEngine(selectedTournament) : null),
    [selectedTournament]
  );

  const sortedStandings = useMemo<WorldSeriesStanding[]>(() => {
    const sorted =
      selectedEngine?.scoringProfile === "kill_race"
        ? sortKillRaceStandings(leaderboard)
        : leaderboard;
    return sorted.map((entry) => {
      const team = teams.find((candidate) => candidate.id === entry.team_id);
      return {
        ...entry,
        players: team?.members.map((member) => member.player.nickname) ?? [],
      };
    });
  }, [leaderboard, selectedEngine, teams]);

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
  const hasKillRaceTie = useMemo(() => {
    if (!selectedEngine || selectedEngine.scoringProfile !== "kill_race") {
      return false;
    }
    if (activeMatchResults.length < 2 || activeMatchResults.length < totalTeams) {
      return false;
    }

    const maxKills = Math.max(...activeMatchResults.map((result) => result.kills));
    return activeMatchResults.filter((result) => result.kills === maxKills).length > 1;
  }, [activeMatchResults, selectedEngine, totalTeams]);
  const canCreateNextGame =
    totalTeams > 0 &&
    (activeMatch === null ||
      (reportsLoaded === totalTeams && !hasKillRaceTie));

  async function createEngineTournament(payload: {
    name: string;
    game: string;
    preset: EnginePreset;
    teamSize: 1 | 2 | 3 | 4;
    lobbySize?: number;
    rosterPolicy?: "fixed_squad" | "roulette";
    tournamentStructure?: "cumulative" | "single_elim" | "double_elim";
    gameMode?: "br" | "rebirth" | "kill_race" | "custom";
    bestOf?: number;
    matchPointThreshold?: number;
  }) {
    setSubmitting(true);
    setMessage(null);

    try {
      const legacyFormat =
        payload.preset.engineKey === "kill_race_bracket"
          ? payload.teamSize === 3
            ? "roulette_3v3"
            : "roulette_2v2"
          : payload.preset.format;
      const tournament = await createTournament({
        name: payload.name,
        game: payload.game,
        format: legacyFormat,
        team_size: payload.teamSize,
        scoring_profile: payload.preset.scoring_profile,
        config: {
          engine_key: payload.preset.engineKey,
          game_mode: payload.gameMode ?? payload.preset.game_mode,
          roster_policy: payload.rosterPolicy ?? payload.preset.roster_policy,
          tournament_structure:
            payload.tournamentStructure ?? payload.preset.tournament_structure,
          lobbySize: payload.lobbySize,
          teamSize: payload.teamSize,
          bestOf: payload.bestOf,
          matchPointThreshold: payload.matchPointThreshold,
          bracketMode:
            payload.preset.engineKey === "kill_race_bracket"
              ? payload.tournamentStructure === "double_elim"
                ? "double_elim"
                : "single_elim"
              : undefined,
        },
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

  async function createWorldSeriesTournament(payload: { name: string; game: string }) {
    return createEngineTournament({
      ...payload,
      preset: ENGINE_PRESETS.wsow_br,
      teamSize: 3,
      lobbySize: 50,
      matchPointThreshold: 125,
    });
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

    if (activeMatch && pendingTeams.length > 0) {
      const names = pendingTeams.map((team) => team.name).join(", ");
      setMessage(
        `${getMissingReportsMessage(pendingTeams.length, activeMatch.round)} Faltan reportes de: ${names}.`
      );
      return null;
    }

    if (selectedEngine?.scoringProfile === "kill_race" && hasKillRaceTie) {
      setMessage("Empate en kills: define desempate manual antes de avanzar.");
      return null;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      if (selectedEngine?.primaryView !== "standings") {
        setMessage("Kill Race se resuelve por bracket. La creación de partidas BO3 va en el siguiente sprint.");
        return null;
      }
      const match = await createBattleRoyaleMatch(selectedTournamentId, { round: nextGameNumber });
      await refreshSelectedTournament(selectedTournamentId, { preferLatestMatch: true });
      setMessage(`Partida ${match.round} creada.`);
      return match;
    } catch {
      setMessage("No se pudo crear la siguiente partida.");
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  async function generateRouletteForSelected() {
    if (selectedTournamentId === null || !selectedEngine) {
      return null;
    }
    if (selectedEngine.rosterPolicy !== "roulette") {
      setMessage("Este torneo no requiere ruleta.");
      return null;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const result = await generateRouletteTeams(selectedTournamentId, {
        team_size: selectedEngine.teamSize,
        reset: true,
      });
      await refreshSelectedTournament(selectedTournamentId);
      setMessage(`Ruleta generada: ${result.teams_created.length} equipos.`);
      return result;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo generar la ruleta.");
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  async function archiveSelectedTournament(tournamentId: number) {
    setSubmitting(true);
    setMessage(null);

    try {
      await archiveTournament(tournamentId);
      const nextId = selectedTournamentId === tournamentId ? null : selectedTournamentId;
      await refreshTournaments(nextId);
      setMessage("Torneo archivado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo archivar el torneo.");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteSelectedTournament(tournamentId: number) {
    setSubmitting(true);
    setMessage(null);

    try {
      await deleteTournament(tournamentId);
      const nextId = selectedTournamentId === tournamentId ? null : selectedTournamentId;
      await refreshTournaments(nextId);
      setMessage("Torneo eliminado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar el torneo.");
    } finally {
      setSubmitting(false);
    }
  }

  function validateTeamReport(
    matchId: number,
    teamId: number,
    killsValue: string,
    placementValue: string,
  ): ReportValidation {
    if (!selectedTournament || !selectedEngine) {
      return { ok: false, message: "No active tournament" };
    }

    const killsResult = parseRequiredNumber(killsValue, "Kills es requerido.");
    if (!killsResult.ok) {
      return { ok: false, message: killsResult.message };
    }

    if (killsResult.value < 0) {
      return { ok: false, message: "Kills debe ser 0 o mayor." };
    }

    if (!selectedEngine.usesPlacement) {
      return { ok: true, kills: killsResult.value, placement: 1 };
    }

    const placementResult = parseRequiredNumber(
      placementValue,
      "Placement es requerido."
    );
    if (!placementResult.ok) {
      return { ok: false, message: placementResult.message };
    }

    if (placementResult.value < 1) {
      return { ok: false, message: "Placement debe ser 1 o mayor." };
    }

    const lobbySize = getEffectiveLobbySize(selectedEngine, totalTeams);
    if (placementResult.value > lobbySize) {
      return {
        ok: false,
        message: `Placement debe estar entre 1 y ${lobbySize}.`,
      };
    }

    if (selectedEngine.requiresUniquePlacement) {
      const conflict = activeMatchResults.find(
        (result) =>
          result.match_id === matchId &&
          result.team_id !== teamId &&
          result.placement === placementResult.value
      );
      if (conflict) {
        return {
          ok: false,
          message: `Placement #${placementResult.value} ya fue reportado por ${conflict.team_name}.`,
        };
      }
    }

    return {
      ok: true,
      kills: killsResult.value,
      placement: placementResult.value,
    };
  }

  async function saveTeamReport(matchId: number, teamId: number) {
    const key = getDraftKey(matchId, teamId);
    const saved = activeMatchResults.find((result) => result.team_id === teamId);
    const killsValue = resultDrafts[key]?.kills ?? (saved ? String(saved.kills) : "");
    const placementValue = resultDrafts[key]?.placement ?? (saved ? String(saved.placement) : "");
    if (selectedTournamentId === null) {
      throw new Error("No active tournament");
    }

    const validation = validateTeamReport(matchId, teamId, killsValue, placementValue);
    if (!validation.ok) {
      setMessage(validation.message);
      return null;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const result = await saveMatchResult(matchId, {
        team_id: teamId,
        kills: validation.kills,
        placement: validation.placement,
      });
      await refreshSelectedTournament(selectedTournamentId);
      setResultDrafts((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      setMessage(`Reporte guardado: ${teams.find((team) => team.id === teamId)?.name ?? "equipo"}`);
      return result;
    } catch (error) {
      // El backend devuelve 409 (placement duplicado) con un detail explicativo;
      // request() lo propaga como Error.message. Surfacearlo en vez del genérico.
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el reporte.");
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
    selectedEngine,
    hasKillRaceTie,
    currentGameNumber: activeMatch?.round ?? 0,
    nextGameNumber,
    latestReportedRound,
    setMessage,
    setSelectedMatchId,
    setResultDrafts,
    selectTournament,
    updateResultDraft,
    createEngineTournament,
    createWorldSeriesTournament,
    createTeamWithRoster,
    generateRouletteForSelected,
    archiveSelectedTournament,
    deleteSelectedTournament,
    createNextGame,
    saveTeamReport,
  };
}
