"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ApiError,
  LeaderboardEntry,
  Match,
  Team,
  TeamResultDetail,
  Tournament,
  addTeamMember,
  archiveTournament,
  clearPlayers,
  createBattleRoyaleMatch,
  createPlayer,
  createTeam,
  createTournament,
  closeRosterRespin,
  deletePlayer,
  deleteTournament,
  generateBracket,
  generateRouletteTeams,
  getHealth,
  getLeaderboard,
  getMatches,
  getPlayers,
  getTournament,
  getTournamentResults,
  getTournaments,
  getTeams,
  importParticipantRows,
  lockBracketRespin,
  lockRosterRespin,
  openBracketRespin,
  openRosterRespin,
  saveMatchMap,
  saveMatchResult,
  updateTournament,
} from "../../lib/api";
import {
  ENGINE_PRESETS,
  type EnginePreset,
  getEffectiveLobbySize,
  getMissingReportsMessage,
  isOperatorSupportedTournament,
  resolveTournamentEngine,
} from "../../lib/tournamentModel";
import { getTeamDisplayName } from "../../lib/tournamentStatus";
import { validateManualPlayerStats } from "../../lib/manualPlayerStats";

export const ACTIVE_WORLD_SERIES_TOURNAMENT_KEY = "bf:world-series-practice:tournament-id";

export type ResultDraft = {
  kills: string;
  placement: string;
  playerKills?: Record<number, string>;
};

export type KillRaceMapDraft = {
  mapNumber: string;
  killsA: string;
  killsB: string;
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

function getKillRaceOperableMatches(matches: Match[]) {
  return matches.filter(
    (match) =>
      match.team_a_id !== null &&
      match.team_b_id !== null &&
      match.winner_id === null &&
      match.status !== "completed"
  );
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
  const [killRaceMapDrafts, setKillRaceMapDrafts] = useState<Record<number, KillRaceMapDraft>>({});

  const selectedMatchIdRef = useRef<number | null>(selectedMatchId);
  const refreshRequestRef = useRef(0);

  useEffect(() => {
    selectedMatchIdRef.current = selectedMatchId;
  }, [selectedMatchId]);

  const refreshSelectedTournament = useCallback(
    async (tournamentId: number, options?: { preferLatestMatch?: boolean }) => {
      const requestId = ++refreshRequestRef.current;
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

      const relevantMatches =
        engine.primaryView === "standings"
          ? nextMatches.filter((match) => match.team_a_id === null && match.team_b_id === null)
          : getKillRaceOperableMatches(nextMatches);
      const latestMatchId =
        engine.primaryView === "standings"
          ? relevantMatches.at(-1)?.id ?? null
          : relevantMatches.sort((left, right) => left.round - right.round || left.id - right.id)[0]?.id ?? null;
      const resolvedMatchId = options?.preferLatestMatch
        ? latestMatchId
        : selectedMatchIdRef.current !== null &&
            relevantMatches.some((match) => match.id === selectedMatchIdRef.current)
          ? selectedMatchIdRef.current
          : latestMatchId;

      if (requestId !== refreshRequestRef.current) {
        return;
      }

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
        setKillRaceMapDrafts({});
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
    setKillRaceMapDrafts({});
    setMessage(null);
  }

  function updateResultDraft(matchId: number, teamId: number, patch: Partial<ResultDraft>) {
    const key = getDraftKey(matchId, teamId);
    setResultDrafts((current) => ({
      ...current,
      [key]: {
        kills: patch.kills ?? current[key]?.kills ?? "",
        placement: patch.placement ?? current[key]?.placement ?? "",
        playerKills: patch.playerKills ?? current[key]?.playerKills,
      },
    }));
  }

  function updateKillRaceMapDraft(matchId: number, patch: Partial<KillRaceMapDraft>) {
    setKillRaceMapDrafts((current) => ({
      ...current,
      [matchId]: {
        mapNumber: patch.mapNumber ?? current[matchId]?.mapNumber ?? "",
        killsA: patch.killsA ?? current[matchId]?.killsA ?? "",
        killsB: patch.killsB ?? current[matchId]?.killsB ?? "",
      },
    }));
  }

  const battleRoyaleMatches = useMemo(
    () => matches.filter((match) => match.team_a_id === null && match.team_b_id === null),
    [matches]
  );
  const killRaceOperableMatches = useMemo(() => getKillRaceOperableMatches(matches), [matches]);

  const selectedEngine = useMemo(
    () => (selectedTournament ? resolveTournamentEngine(selectedTournament) : null),
    [selectedTournament]
  );

  const activeMatch = useMemo(
    () => {
      if (selectedEngine?.primaryView === "bracket") {
        return (
          killRaceOperableMatches.find((match) => match.id === selectedMatchId) ??
          killRaceOperableMatches[0] ??
          null
        );
      }
      return (
        battleRoyaleMatches.find((match) => match.id === selectedMatchId) ??
        battleRoyaleMatches.at(-1) ??
        null
      );
    },
    [battleRoyaleMatches, killRaceOperableMatches, selectedEngine?.primaryView, selectedMatchId]
  );

  const activeMatchResults = useMemo(
    () =>
      activeMatch && selectedEngine?.primaryView === "standings"
        ? tournamentResults.filter((result) => result.match_id === activeMatch.id)
        : [],
    [activeMatch, selectedEngine?.primaryView, tournamentResults]
  );

  const pendingTeams = useMemo(
    () =>
      selectedEngine?.primaryView === "standings"
        ? teams.filter(
            (team) => !activeMatchResults.some((result) => result.team_id === team.id)
          )
        : [],
    [activeMatchResults, selectedEngine?.primaryView, teams]
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
    if (selectedEngine?.primaryView === "bracket") {
      return matches.some((match) => match.maps.length > 0 || match.winner_id !== null) ? 1 : 0;
    }
    if (tournamentResults.length === 0) {
      return 0;
    }
    return Math.max(...tournamentResults.map((result) => result.round));
  }, [matches, selectedEngine?.primaryView, tournamentResults]);

  const nextGameNumber = useMemo(() => {
    if (battleRoyaleMatches.length === 0) {
      return 1;
    }
    return Math.max(...battleRoyaleMatches.map((match) => match.round)) + 1;
  }, [battleRoyaleMatches]);

  const reportsLoaded = activeMatchResults.length;
  const totalTeams = teams.length;
  const hasKillRaceTie = useMemo(() => {
    if (!selectedEngine || selectedEngine.primaryView === "bracket") {
      return false;
    }
    if (selectedEngine.scoringProfile !== "kill_race") {
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

  async function updateEngineTournament(
    tournamentId: number,
    payload: {
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
    }
  ) {
    setSubmitting(true);
    setMessage(null);

    try {
      const legacyFormat =
        payload.preset.engineKey === "kill_race_bracket"
          ? payload.teamSize === 3
            ? "roulette_3v3"
            : "roulette_2v2"
          : payload.preset.format;
      const tournament = await updateTournament(tournamentId, {
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
      setMessage(`Torneo actualizado: ${tournament.name}`);
      return tournament;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar el torneo.");
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

  async function previewParticipantImport(rows: string[]) {
    if (selectedTournamentId === null) {
      return null;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      return await importParticipantRows(selectedTournamentId, {
        rows,
        confirm: false,
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo validar la importación.");
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  async function importParticipants(rows: string[]) {
    if (selectedTournamentId === null) {
      return null;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const created = await importParticipantRows(selectedTournamentId, {
        rows,
        confirm: true,
      });
      await refreshSelectedTournament(selectedTournamentId);
      setMessage(
        created.persisted_count > 0
          ? `Participantes cargados: ${created.persisted_count}.`
          : "No se cargaron participantes nuevos."
      );
      return created;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron cargar participantes.");
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  async function removeParticipant(playerId: number) {
    if (selectedTournamentId === null) {
      return null;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      await deletePlayer(playerId);
      await refreshSelectedTournament(selectedTournamentId);
      setMessage("Participante eliminado.");
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar el participante.");
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  async function clearParticipants() {
    if (selectedTournamentId === null) {
      return null;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      await clearPlayers(selectedTournamentId);
      await refreshSelectedTournament(selectedTournamentId);
      setMessage("Participantes limpiados.");
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron limpiar participantes.");
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  async function createTeamWithRoster(payload: {
    name: string;
    roster: string;
    rosterAliases?: string[];
  }) {
    if (selectedTournamentId === null) {
      throw new Error("No active tournament");
    }

    const teamName = payload.name.trim();
    const rosterAliases =
      payload.rosterAliases?.map((alias) => alias.trim()).filter((alias) => alias.length > 0) ??
      parseRosterAliases(payload.roster);

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

  async function generateRouletteForSelected(shuffleSeed?: string | number) {
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
        shuffle_seed: shuffleSeed,
        reset: true,
        confirm: false,
      });
      await refreshSelectedTournament(selectedTournamentId);
      setMessage(
        `Ruleta generada: ${result.teams_created.length} equipos. Puedes confirmar o regenerar dentro de la ventana de respin.`
      );
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

    const killsResult = parseRequiredNumber(killsValue, "Agrega kills antes de guardar el reporte.");
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
      "Agrega placement antes de guardar el reporte."
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
          message: `Placement repetido: el puesto ${placementResult.value} ya fue usado por ${conflict.team_name}.`,
        };
      }
    }

    return {
      ok: true,
      kills: killsResult.value,
      placement: placementResult.value,
    };
  }

  async function persistTeamReport(
    matchId: number,
    teamId: number,
    killsValue: string,
    placementValue: string,
    successMessage: string,
    playerStats?: Array<{ player_name: string; kills: number }>
  ) {
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
        ...(playerStats && playerStats.length > 0
          ? { player_stats: playerStats }
          : {}),
      });
      await refreshSelectedTournament(selectedTournamentId);
      setResultDrafts((current) => {
        const next = { ...current };
        delete next[getDraftKey(matchId, teamId)];
        return next;
      });
      setMessage(successMessage);
      return result;
    } catch (error) {
      // El backend devuelve 409 (placement duplicado o reporte ya existente)
      // con un detail explicativo; request() lo propaga como Error.message.
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el reporte.");
      if (error instanceof ApiError && error.status === 409) {
        // Otro operador pudo haber reportado despues de nuestro ultimo refresh:
        // sincronizamos para que la UI muestre el resultado existente y bloquee
        // reintentos, en vez de seguir operando con cache viejo.
        try {
          await refreshSelectedTournament(selectedTournamentId);
        } catch {}
      }
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
    const team = teams.find((candidate) => candidate.id === teamId);
    const playerStatsValidation = validateManualPlayerStats(
      team?.members.map((member) => ({
        id: member.player.id,
        name: member.player.nickname,
      })) ?? [],
      resultDrafts[key]?.playerKills,
      killsValue
    );
    if (!playerStatsValidation.ok) {
      setMessage(playerStatsValidation.message);
      return null;
    }
    return persistTeamReport(
      matchId,
      teamId,
      killsValue,
      placementValue,
      `Reporte guardado: ${team?.name ?? "equipo"}`,
      playerStatsValidation.playerStats
    );
  }

  async function saveOfficialReportFromDraft(
    matchId: number,
    teamId: number,
    kills: number,
    placement: number | "",
    playerStats?: Array<{ playerName: string; kills: number }>
  ) {
    // Guard local UX-only: el backend mantiene la garantía real create-only.
    const existing = tournamentResults.find(
      (result) => result.match_id === matchId && result.team_id === teamId
    );
    if (existing) {
      setMessage("Ya existe reporte oficial para este equipo en esta partida.");
      return null;
    }

    const team = teams.find((candidate) => candidate.id === teamId);
    const teamLabel = team ? getTeamDisplayName(team) : "equipo";
    return persistTeamReport(
      matchId,
      teamId,
      String(kills),
      placement === "" ? "" : String(placement),
      `Reporte oficial guardado: ${teamLabel}`,
      playerStats?.map((stat) => ({
        player_name: stat.playerName,
        kills: stat.kills,
      }))
    );
  }

  async function openRosterWindow(durationMinutes: number) {
    if (selectedTournamentId === null) {
      return null;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const tournament = await openRosterRespin(selectedTournamentId, {
        duration_minutes: durationMinutes,
      });
      await refreshSelectedTournament(selectedTournamentId);
      setMessage(`Respin de roster abierto por ${durationMinutes} minutos.`);
      return tournament;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo abrir respin de roster.");
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  async function lockRosterWindow() {
    if (selectedTournamentId === null) {
      return null;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      if (selectedTournament?.roster_status === "respin_open") {
        await closeRosterRespin(selectedTournamentId);
      }
      const tournament = await lockRosterRespin(selectedTournamentId);
      await refreshSelectedTournament(selectedTournamentId);
      setMessage("Equipos confirmados. Ya puedes preparar bracket.");
      return tournament;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo confirmar el roster.");
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  async function generateBracketForSelected() {
    if (selectedTournamentId === null || !selectedEngine || !selectedTournament) {
      return null;
    }
    if (selectedEngine.primaryView !== "bracket") {
      setMessage("Este torneo no usa bracket.");
      return null;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const currentTournament = await getTournament(selectedTournamentId);
      if (currentTournament.roster_status !== "locked") {
        await refreshSelectedTournament(selectedTournamentId);
        setMessage("Primero cierra el respin y bloquea equipos.");
        return null;
      }

      // El bracket ya existe (locked/running/completed): reabrir respin daria 409.
      // No reintentamos: el bracket ya esta listo para operar.
      if (
        currentTournament.bracket_status === "locked" ||
        currentTournament.bracket_status === "running" ||
        currentTournament.bracket_status === "completed"
      ) {
        await refreshSelectedTournament(selectedTournamentId);
        setMessage("El bracket ya esta generado. Abrelo desde Ver bracket.");
        return null;
      }

      try {
        await openBracketRespin(selectedTournamentId, { duration_minutes: 3 });
      } catch (error) {
        const tournament = await getTournament(selectedTournamentId);
        if (tournament.bracket_status !== "respin_open") {
          throw error;
        }
      }
      const result = await generateBracket(selectedTournamentId);
      await lockBracketRespin(selectedTournamentId);
      await refreshSelectedTournament(selectedTournamentId);
      setMessage(`Bracket generado: ${result.matches_created} matches.`);
      return result;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo preparar el bracket.");
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  async function openBracketWindow(durationMinutes: number) {
    if (selectedTournamentId === null) {
      return null;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const tournament = await openBracketRespin(selectedTournamentId, {
        duration_minutes: durationMinutes,
      });
      await refreshSelectedTournament(selectedTournamentId);
      setMessage(`Respin de bracket abierto por ${durationMinutes} minutos.`);
      return tournament;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo abrir respin de bracket.");
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  async function lockBracketWindow() {
    if (selectedTournamentId === null) {
      return null;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const tournament = await lockBracketRespin(selectedTournamentId);
      await refreshSelectedTournament(selectedTournamentId);
      setMessage("Bracket locked. El torneo queda running.");
      return tournament;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo locked el bracket.");
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  async function saveKillRaceMap(matchId: number) {
    if (selectedTournamentId === null) {
      throw new Error("No active tournament");
    }
    const draft = killRaceMapDrafts[matchId];
    const activeKillRaceMatch = matches.find((match) => match.id === matchId);
    if (!draft || !activeKillRaceMatch) {
      setMessage("No hay serie activa para guardar.");
      return null;
    }
    const teamA = teams.find((team) => team.id === activeKillRaceMatch.team_a_id);
    const teamB = teams.find((team) => team.id === activeKillRaceMatch.team_b_id);
    const teamALabel = teamA ? getTeamDisplayName(teamA) : "equipo A";
    const teamBLabel = teamB ? getTeamDisplayName(teamB) : "equipo B";

    const mapNumberResult = parseRequiredNumber(draft.mapNumber, "Mapa es requerido.");
    const killsAResult = parseRequiredNumber(draft.killsA, `Kills de ${teamALabel} es requerido.`);
    const killsBResult = parseRequiredNumber(draft.killsB, `Kills de ${teamBLabel} es requerido.`);
    if (!mapNumberResult.ok) {
      setMessage(mapNumberResult.message);
      return null;
    }
    if (!killsAResult.ok) {
      setMessage(killsAResult.message);
      return null;
    }
    if (!killsBResult.ok) {
      setMessage(killsBResult.message);
      return null;
    }
    if (mapNumberResult.value < 1) {
      setMessage("Mapa debe ser 1 o mayor.");
      return null;
    }
    if (killsAResult.value < 0 || killsBResult.value < 0) {
      setMessage("Kills debe ser 0 o mayor.");
      return null;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const mapPayload = {
        match_id: matchId,
        map_number: mapNumberResult.value,
        kills_a: killsAResult.value,
        kills_b: killsBResult.value,
      };
      const savedMatch = await saveMatchMap(matchId, mapPayload);
      const winsNeeded = Math.ceil(savedMatch.best_of / 2);
      const savedScoreClosed =
        savedMatch.maps_won_a >= winsNeeded || savedMatch.maps_won_b >= winsNeeded;
      const updatedMatch =
        savedScoreClosed && savedMatch.winner_id === null && savedMatch.status !== "completed"
          ? await saveMatchMap(matchId, mapPayload)
          : savedMatch;
      await refreshSelectedTournament(selectedTournamentId);
      const updatedWinsNeeded = Math.ceil(updatedMatch.best_of / 2);
      const seriesClosed =
        updatedMatch.winner_id !== null ||
        updatedMatch.status === "completed" ||
        updatedMatch.maps_won_a >= updatedWinsNeeded ||
        updatedMatch.maps_won_b >= updatedWinsNeeded;
      if (seriesClosed) {
        const nextMatches = await getMatches(selectedTournamentId);
        setKillRaceMapDrafts((current) => {
          const next = { ...current };
          delete next[matchId];
          return next;
        });
        const nextReadyMatch = getKillRaceOperableMatches(nextMatches)
          .filter((match) => match.id !== matchId)
          .sort((left, right) => left.round - right.round || left.id - right.id)[0];
        setMessage(
          nextReadyMatch
            ? "Serie cerrada: el ganador avanzó."
            : "Serie cerrada: el ganador avanzó. No hay otra serie lista en este momento."
        );
        return updatedMatch;
      }

      setKillRaceMapDrafts((current) => {
        const nextMap = updatedMatch.maps.length + 1;
        if (nextMap > updatedMatch.best_of) {
          const next = { ...current };
          delete next[matchId];
          return next;
        }
        return {
          ...current,
          [matchId]: {
            mapNumber: String(nextMap),
            killsA: "",
            killsB: "",
          },
        };
      });
      setMessage(`Mapa ${mapNumberResult.value} guardado.`);
      return updatedMatch;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el mapa.");
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
    matches,
    leaderboard,
    tournamentResults,
    activeMatch,
    activeMatchResults,
    pendingTeams,
    sortedStandings,
    selectedMatchId,
    resultDrafts,
    killRaceMapDrafts,
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
    updateKillRaceMapDraft,
    createEngineTournament,
    updateEngineTournament,
    createWorldSeriesTournament,
    previewParticipantImport,
    importParticipants,
    removeParticipant,
    clearParticipants,
    createTeamWithRoster,
    openRosterWindow,
    lockRosterWindow,
    generateRouletteForSelected,
    generateBracketForSelected,
    openBracketWindow,
    lockBracketWindow,
    archiveSelectedTournament,
    deleteSelectedTournament,
    createNextGame,
    saveTeamReport,
    saveOfficialReportFromDraft,
    saveKillRaceMap,
    selectMatch: setSelectedMatchId,
  };
}
