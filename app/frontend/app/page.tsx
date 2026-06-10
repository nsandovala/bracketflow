"use client";

import { FormEvent, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

import {
  LeaderboardEntry,
  Match,
  Player,
  Team,
  TeamResultDetail,
  Tournament,
  TournamentFormat,
  createBattleRoyaleMatch,
  createPlayer,
  createTeam,
  createTournament,
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
  saveMatchResult,
} from "../lib/api";

const formatOptions: Array<{ value: TournamentFormat; label: string }> = [
  { value: "single_elimination", label: "Eliminacion directa" },
  { value: "battle_royale_points", label: "Warzone puntos" },
  { value: "roulette_2v2", label: "Ruleta 2v2" },
  { value: "roulette_3v3", label: "Ruleta 3v3" },
];

const battleRoyaleFormats = new Set<TournamentFormat>([
  "battle_royale_points",
  "roulette_2v2",
  "roulette_3v3",
]);

const initialTournamentForm = {
  name: "",
  game: "",
  format: "single_elimination" as TournamentFormat,
};

type FlowStepState = "done" | "active" | "upcoming";

type FlowStep = {
  label: string;
  hint: string;
  state: FlowStepState;
};

type CurrentAction =
  | "idle"
  | "players"
  | "roulette"
  | "teams"
  | "round"
  | "results"
  | "leaderboard"
  | "bracket"
  | "matches";

type ActionDescriptor = {
  kind: CurrentAction;
  title: string;
  description: string;
};

type ResultDraft = {
  kills: string;
  placement: string;
};

function isBattleRoyaleFormat(format: TournamentFormat) {
  return battleRoyaleFormats.has(format);
}

function isRouletteFormat(format: TournamentFormat) {
  return format === "roulette_2v2" || format === "roulette_3v3";
}

function isWorldSeriesFormat(format: TournamentFormat) {
  return format === "battle_royale_points";
}

function getDefaultTeamSize(format: TournamentFormat) {
  return format === "roulette_3v3" ? 3 : 2;
}

function getMinimumPlayers(format: TournamentFormat) {
  if (format === "roulette_2v2") {
    return 4;
  }
  if (format === "roulette_3v3") {
    return 6;
  }
  return 0;
}

function getRouletteLabel(format: TournamentFormat) {
  return format === "roulette_3v3" ? "ruleta 3v3" : "ruleta 2v2";
}

function getSorteoLabel(format: TournamentFormat) {
  return format === "roulette_3v3" ? "Sortear tríos" : "Sortear parejas";
}

function getParejasLabel(format: TournamentFormat) {
  return format === "roulette_3v3" ? "tríos" : "parejas";
}

function getTeamCountProjection(playersCount: number, teamSize: number) {
  return Math.floor(playersCount / teamSize);
}

function getBenchCount(playersCount: number, teamSize: number) {
  return playersCount % teamSize;
}

function normalizeAlias(value: string) {
  return value.trim().toLocaleLowerCase();
}

function getFormatLabel(format: TournamentFormat) {
  return formatOptions.find((option) => option.value === format)?.label ?? format;
}

function getStepState(isDone: boolean, isCurrent: boolean): FlowStepState {
  if (isDone) {
    return "done";
  }
  if (isCurrent) {
    return "active";
  }
  return "upcoming";
}

function buildBattleRoyaleSteps(params: {
  playersCount: number;
  requiredPlayers: number;
  teamsCount: number;
  roundsCount: number;
  hasResults: boolean;
  hasLeaderboard: boolean;
  rouletteMode: boolean;
  teamSize: number;
}): FlowStep[] {
  const {
    playersCount,
    requiredPlayers,
    teamsCount,
    roundsCount,
    hasResults,
    hasLeaderboard,
    rouletteMode,
    teamSize,
  } = params;
  const hasMinimumPlayers = playersCount >= requiredPlayers;

  if (rouletteMode) {
    const pairs = getTeamCountProjection(playersCount, teamSize);
    const bench = getBenchCount(playersCount, teamSize);
    const label = getParejasLabel(teamSize === 3 ? "roulette_3v3" : "roulette_2v2");

    return [
      { label: "Torneo", hint: "Torneo activo.", state: "done" },
      {
        label: hasMinimumPlayers
          ? `${playersCount} jugadores → ${pairs} ${label}${bench > 0 ? ` · ${bench} en banca` : ""}`
          : `${playersCount}/${requiredPlayers} · faltan ${requiredPlayers - playersCount} para sortear`,
        hint: hasMinimumPlayers
          ? "Listo para sortear."
          : `Faltan ${requiredPlayers - playersCount} jugadores para sortear.`,
        state: getStepState(hasMinimumPlayers, !hasMinimumPlayers),
      },
      {
        label: "Sorteo",
        hint: "Equipos sorteados.",
        state: getStepState(teamsCount > 0, hasMinimumPlayers && teamsCount === 0),
      },
      {
        label: "Ronda",
        hint: "Crea la ronda activa.",
        state: getStepState(roundsCount > 0, teamsCount > 0 && roundsCount === 0),
      },
      {
        label: "Resultados",
        hint: "Carga kills y placement.",
        state: getStepState(hasResults, roundsCount > 0 && !hasResults),
      },
      {
        label: "Leaderboard",
        hint: "Revisa el acumulado.",
        state: getStepState(hasLeaderboard, hasResults && !hasLeaderboard),
      },
    ];
  }

  return [
    { label: "Torneo", hint: "Torneo activo.", state: "done" },
    {
      label: "Equipos",
      hint: "Agrega equipos reales.",
      state: getStepState(teamsCount > 0, teamsCount === 0),
    },
    {
      label: "Ronda",
      hint: "Crea la ronda activa.",
      state: getStepState(roundsCount > 0, teamsCount > 0 && roundsCount === 0),
    },
    {
      label: "Resultados",
      hint: "Carga kills y placement.",
      state: getStepState(hasResults, roundsCount > 0 && !hasResults),
    },
    {
      label: "Leaderboard",
      hint: "Revisa el acumulado.",
      state: getStepState(hasLeaderboard, hasResults && !hasLeaderboard),
    },
  ];
}

function buildClassicSteps(params: { teamsCount: number; matchesCount: number }): FlowStep[] {
  const { teamsCount, matchesCount } = params;

  return [
    { label: "Torneo", hint: "Torneo activo.", state: "done" },
    {
      label: "Equipos",
      hint: "Agrega equipos reales.",
      state: getStepState(teamsCount > 0, teamsCount === 0),
    },
    {
      label: "Bracket",
      hint: "Genera los cruces.",
      state: getStepState(matchesCount > 0, teamsCount > 0 && matchesCount === 0),
    },
    {
      label: "Cruces",
      hint: "Revisa el bracket.",
      state: getStepState(matchesCount > 0, matchesCount > 0),
    },
  ];
}

function getTeamLabel(teamId: number | null, teams: Team[]) {
  if (teamId === null) {
    return "Pendiente";
  }
  return teams.find((team) => team.id === teamId)?.name ?? `Equipo ${teamId}`;
}

function getResultDraftKey(matchId: number, teamId: number) {
  return `${matchId}:${teamId}`;
}

function formatPoints(value: number, format: TournamentFormat) {
  if (isWorldSeriesFormat(format)) {
    return value.toFixed(1);
  }
  return String(Math.round(value));
}

function formatMultiplier(value: number) {
  return value.toFixed(2).replace(/\.00$/, ".0").replace(/(\.\d)0$/, "$1");
}

export default function Home() {
  const [backendOnline, setBackendOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<number | null>(null);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [tournamentResults, setTournamentResults] = useState<TeamResultDetail[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [tournamentForm, setTournamentForm] = useState(initialTournamentForm);
  const [teamName, setTeamName] = useState("");
  const [playerNickname, setPlayerNickname] = useState("");
  const [playerFormError, setPlayerFormError] = useState<string | null>(null);
  const [rouletteSeed, setRouletteSeed] = useState("");
  const [matchRound, setMatchRound] = useState("1");
  const [resultDrafts, setResultDrafts] = useState<Record<string, ResultDraft>>({});
  const [rouletteBench, setRouletteBench] = useState<Player[]>([]);
  const [teamsRevealKey, setTeamsRevealKey] = useState(0);

  const selectedMatchIdRef = useRef<number | null>(selectedMatchId);
  const playerInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    selectedMatchIdRef.current = selectedMatchId;
  }, [selectedMatchId]);

  const loadInitialData = useEffectEvent(async () => {
    try {
      const health = await getHealth();
      setBackendOnline(health.status === "ok");
      await refreshTournaments();
    } catch {
      setMessage("No se pudo conectar al backend");
      setBackendOnline(false);
    } finally {
      setLoading(false);
    }
  });

  const loadTournamentDetails = useEffectEvent(async (tournamentId: number) => {
    try {
      await refreshSelectedTournament(tournamentId);
    } catch {
      setMessage("No se pudo cargar el torneo");
    }
  });

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadInitialData();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (selectedTournamentId === null) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      void loadTournamentDetails(selectedTournamentId);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [selectedTournamentId]);

  function selectTournament(tournamentId: number | null) {
    setSelectedTournamentId((current) => {
      if (current !== tournamentId) {
        setResultDrafts({});
        setRouletteBench([]);
        setSelectedMatchId(null);
      }
      return tournamentId;
    });
  }

  function focusPlayerInput() {
    window.setTimeout(() => {
      playerInputRef.current?.focus();
    }, 0);
  }

  async function refreshTournaments(nextSelectedId?: number) {
    const items = await getTournaments();
    setTournaments(items);

    const fallbackId = nextSelectedId ?? selectedTournamentId ?? items[0]?.id ?? null;
    selectTournament(fallbackId);

    if (fallbackId === null) {
      setSelectedTournament(null);
      setPlayers([]);
      setTeams([]);
      setMatches([]);
      setLeaderboard([]);
      setTournamentResults([]);
      setSelectedMatchId(null);
      setRouletteBench([]);
      setResultDrafts({});
    }
  }

  async function refreshSelectedTournament(tournamentId: number) {
    const tournament = await getTournament(tournamentId);
    const [nextPlayers, nextTeams, nextMatches] = await Promise.all([
      getPlayers(tournamentId),
      getTeams(tournamentId),
      getMatches(tournamentId),
    ]);
    const [nextLeaderboard, nextTournamentResults]: [LeaderboardEntry[], TeamResultDetail[]] =
      isBattleRoyaleFormat(tournament.format)
        ? await Promise.all([getLeaderboard(tournamentId), getTournamentResults(tournamentId)])
        : [[], []];

    setSelectedTournament(tournament);
    setPlayers(nextPlayers);
    setTeams(nextTeams);
    setMatches(nextMatches);
    setLeaderboard(nextLeaderboard);
    setTournamentResults(nextTournamentResults);

    const nextBattleRoyaleMatches = nextMatches.filter(
      (match) => match.team_a_id === null && match.team_b_id === null
    );
    const latestMatchId = nextBattleRoyaleMatches.at(-1)?.id ?? null;
    const resolvedMatchId =
      selectedMatchIdRef.current !== null &&
      nextBattleRoyaleMatches.some((match) => match.id === selectedMatchIdRef.current)
        ? selectedMatchIdRef.current
        : latestMatchId;

    setSelectedMatchId(resolvedMatchId);

    const nextRoundNumber =
      nextMatches.length > 0 ? Math.max(...nextMatches.map((match) => match.round)) + 1 : 1;
    setMatchRound(String(nextRoundNumber));
  }

  async function handleCreateTournament(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const tournament = await createTournament({
        name: tournamentForm.name,
        game: tournamentForm.game,
        format: tournamentForm.format,
        team_size: getDefaultTeamSize(tournamentForm.format),
        scoring_profile: "wsow_like",
      });
      setTournamentForm(initialTournamentForm);
      await refreshTournaments(tournament.id);
      setMessage(`Torneo creado: ${tournament.name}`);
    } catch {
      setMessage("No se pudo crear el torneo");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedTournamentId === null) {
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      await createTeam(selectedTournamentId, { name: teamName });
      setTeamName("");
      await refreshSelectedTournament(selectedTournamentId);
      setMessage("Equipo agregado");
    } catch {
      setMessage("No se pudo agregar el equipo");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreatePlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedTournamentId === null) {
      return;
    }

    const rawAliases = playerNickname
      .split(/,|\n/)
      .map((alias) => alias.trim())
      .filter((alias) => alias.length > 0);

    if (rawAliases.length === 0) {
      setPlayerFormError("Escribe al menos un alias.");
      focusPlayerInput();
      return;
    }

    const existingAliases = new Set(players.map((player) => normalizeAlias(player.nickname)));
    const newAliases: string[] = [];
    const duplicates: string[] = [];

    const seen = new Set<string>();
    for (const alias of rawAliases) {
      const normalized = normalizeAlias(alias);
      if (seen.has(normalized)) {
        duplicates.push(alias);
        continue;
      }
      seen.add(normalized);
      if (existingAliases.has(normalized)) {
        duplicates.push(alias);
        continue;
      }
      newAliases.push(alias);
    }

    if (newAliases.length === 0) {
      const count = duplicates.length;
      setPlayerFormError(
        count === 1
          ? "Ese alias ya esta cargado."
          : `${count} alias ya estaban cargados.`
      );
      focusPlayerInput();
      return;
    }

    setSubmitting(true);
    setMessage(null);
    setPlayerFormError(null);

    try {
      for (const alias of newAliases) {
        await createPlayer(selectedTournamentId, { nickname: alias });
      }
      setPlayerNickname("");
      await refreshSelectedTournament(selectedTournamentId);
      const added = newAliases.length;
      const skipped = duplicates.length;
      let msg: string;
      if (added === 1 && skipped === 0) {
        msg = "1 jugador agregado";
      } else if (skipped === 0) {
        msg = `${added} jugadores agregados`;
      } else {
        msg = `${added} agregados · ${skipped} omitidos (ya estaban)`;
      }
      setMessage(msg);
      focusPlayerInput();
    } catch {
      setPlayerFormError("No se pudo agregar el jugador.");
      setMessage(null);
      focusPlayerInput();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGenerateBracket() {
    if (selectedTournamentId === null) {
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const result = await generateBracket(selectedTournamentId);
      await refreshSelectedTournament(selectedTournamentId);
      await refreshTournaments(selectedTournamentId);
      setMessage(`Bracket generado: ${result.matches_created} matches creados`);
    } catch {
      setMessage("No se pudo generar el bracket");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGenerateRoulette(teamSize: number) {
    if (selectedTournamentId === null) {
      return;
    }

    const requiredPlayers = selectedTournament ? getMinimumPlayers(selectedTournament.format) : 0;
    if (requiredPlayers > 0 && players.length < requiredPlayers) {
      const missingPlayers = requiredPlayers - players.length;
      setMessage(
        `Faltan ${missingPlayers} jugadores para generar ${getRouletteLabel(selectedTournament!.format)}.`
      );
      focusPlayerInput();
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const result = await generateRouletteTeams(selectedTournamentId, {
        team_size: teamSize,
        seed: rouletteSeed.trim() || undefined,
        reset: true,
      });
      await refreshSelectedTournament(selectedTournamentId);
      await refreshTournaments(selectedTournamentId);
      setRouletteBench(result.bench);
      setTeamsRevealKey((k) => k + 1);
      const benchSuffix =
        result.bench.length > 0
          ? ` Jugadores en espera: ${result.bench.map((player) => player.nickname).join(", ")}`
          : "";
      setMessage(`Ruleta ${teamSize}v${teamSize} generada.${benchSuffix}`);
    } catch {
      setMessage("No se pudo generar la ruleta.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateBattleRoyaleMatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedTournamentId === null) {
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const round = Number(matchRound);
      await createBattleRoyaleMatch(selectedTournamentId, { round });
      await refreshSelectedTournament(selectedTournamentId);
      setMessage(`Ronda ${round} creada`);
    } catch {
      setMessage("No se pudo crear la ronda");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveResult(teamId: number) {
    if (selectedMatchId === null || selectedTournamentId === null) {
      return;
    }

    const draftKey = getResultDraftKey(selectedMatchId, teamId);
    const draft = resultDrafts[draftKey];
    const currentResult = tournamentResults.find(
      (result) => result.match_id === selectedMatchId && result.team_id === teamId
    );
    const killsValue = draft?.kills ?? (currentResult ? String(currentResult.kills) : "");
    const placementValue = draft?.placement ?? (currentResult ? String(currentResult.placement) : "");

    if (!killsValue || !placementValue) {
      setMessage("Completa kills y placement antes de guardar");
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      await saveMatchResult(selectedMatchId, {
        team_id: teamId,
        kills: Number(killsValue),
        placement: Number(placementValue),
      });
      await refreshSelectedTournament(selectedTournamentId);
      setMessage("Resultado guardado");
    } catch {
      setMessage("No se pudo guardar el resultado");
    } finally {
      setSubmitting(false);
    }
  }

  function updateResultDraft(matchId: number, teamId: number, patch: Partial<ResultDraft>) {
    const key = getResultDraftKey(matchId, teamId);
    setResultDrafts((current) => ({
      ...current,
      [key]: {
        kills: patch.kills ?? current[key]?.kills ?? "",
        placement: patch.placement ?? current[key]?.placement ?? "",
      },
    }));
  }

  const classicMatches = matches.filter(
    (match) => match.team_a_id !== null || match.team_b_id !== null
  );
  const battleRoyaleMatches = matches.filter(
    (match) => match.team_a_id === null && match.team_b_id === null
  );
  const battleRoyaleEnabled =
    selectedTournament !== null && isBattleRoyaleFormat(selectedTournament.format);
  const rouletteEnabled = selectedTournament !== null && isRouletteFormat(selectedTournament.format);
  const minimumPlayers = selectedTournament ? getMinimumPlayers(selectedTournament.format) : 0;
  const playersRemaining = Math.max(minimumPlayers - players.length, 0);
  const hasMinimumPlayers = minimumPlayers === 0 || players.length >= minimumPlayers;

  const rouletteTeamSize = selectedTournament ? getDefaultTeamSize(selectedTournament.format) : 2;
  const hasSavedResults = tournamentResults.length > 0;
  const hasLeaderboard = leaderboard.length > 0;
  const activeBattleRoyaleMatch =
    battleRoyaleMatches.find((match) => match.id === selectedMatchId) ?? battleRoyaleMatches.at(-1) ?? null;

  const roundResults = useMemo(() => {
    return tournamentResults.reduce<Record<number, TeamResultDetail[]>>((groups, result) => {
      const bucket = groups[result.round] ?? [];
      bucket.push(result);
      groups[result.round] = bucket;
      return groups;
    }, {});
  }, [tournamentResults]);

  const sortedRounds = useMemo(() => {
    return Object.keys(roundResults)
      .map(Number)
      .sort((left, right) => left - right);
  }, [roundResults]);

  const selectedMatchResults = useMemo(() => {
    if (selectedMatchId === null) {
      return [];
    }
    return tournamentResults.filter((result) => result.match_id === selectedMatchId);
  }, [selectedMatchId, tournamentResults]);

  const flowSteps = useMemo(() => {
    if (selectedTournament === null) {
      return [];
    }

    if (battleRoyaleEnabled) {
      return buildBattleRoyaleSteps({
        playersCount: players.length,
        requiredPlayers: minimumPlayers,
        teamsCount: teams.length,
        roundsCount: battleRoyaleMatches.length,
        hasResults: hasSavedResults,
        hasLeaderboard,
        rouletteMode: rouletteEnabled,
        teamSize: rouletteTeamSize,
      });
    }

    return buildClassicSteps({
      teamsCount: teams.length,
      matchesCount: classicMatches.length,
    });
  }, [
    battleRoyaleEnabled,
    battleRoyaleMatches.length,
    classicMatches.length,
    hasLeaderboard,
    hasSavedResults,
    minimumPlayers,
    players.length,
    rouletteEnabled,
    rouletteTeamSize,
    selectedTournament,
    teams.length,
  ]);

  const completedSteps = flowSteps.filter((step) => step.state === "done").length;

  const currentAction = useMemo<ActionDescriptor>(() => {
    if (!selectedTournament) {
      return {
        kind: "idle",
        title: "Crear o seleccionar torneo",
        description: "Empieza por un torneo real para ordenar el flujo.",
      };
    }

    if (battleRoyaleEnabled) {
      if (rouletteEnabled) {
        if (teams.length === 0) {
          const pairs = getTeamCountProjection(players.length, rouletteTeamSize);
          const bench = getBenchCount(players.length, rouletteTeamSize);
          const label = getParejasLabel(selectedTournament.format);
          return {
            kind: "players",
            title: "Anadir jugadores y sortear",
            description: hasMinimumPlayers
              ? `${players.length} jugadores → ${pairs} ${label}${bench > 0 ? ` · ${bench} en banca` : ""}.`
              : `Faltan ${playersRemaining} jugadores para sortear.`,
          };
        }
        if (battleRoyaleMatches.length === 0) {
          return { kind: "round", title: "Crear ronda", description: "Abre la ronda activa." };
        }
        if (!hasSavedResults) {
          return { kind: "results", title: "Cargar resultados", description: "Guarda kills y placement." };
        }
        return { kind: "leaderboard", title: "Ver leaderboard", description: "Revisa el acumulado." };
      }

      if (teams.length === 0) {
        return { kind: "teams", title: "Anadir equipos", description: "Carga equipos reales." };
      }
      if (battleRoyaleMatches.length === 0) {
        return { kind: "round", title: "Crear ronda", description: "Abre la ronda activa." };
      }
      if (!hasSavedResults) {
        return { kind: "results", title: "Cargar resultados", description: "Guarda kills y placement." };
      }
      return { kind: "leaderboard", title: "Ver leaderboard", description: "Revisa el acumulado." };
    }

    if (teams.length === 0) {
      return { kind: "teams", title: "Anadir equipos", description: "Carga equipos para el bracket." };
    }
    if (classicMatches.length === 0) {
      return { kind: "bracket", title: "Generar bracket", description: "Crea los cruces iniciales." };
    }
    return { kind: "matches", title: "Ver cruces", description: "Revisa el bracket actual." };
  }, [
    battleRoyaleEnabled,
    battleRoyaleMatches.length,
    classicMatches.length,
    hasSavedResults,
    hasMinimumPlayers,
    players.length,
    playersRemaining,
    rouletteEnabled,
    rouletteTeamSize,
    selectedTournament,
    teams.length,
  ]);

  function renderTournamentSelector(compact: boolean) {
    return (
      <div className={compact ? "bf-panel bf-panel-compact" : "bf-panel"}>
        <div className="bf-panel-header">
          <div>
            <p className="bf-eyebrow">Torneos</p>
            <h2>{compact ? "Selector" : "Seleccionar torneo"}</h2>
          </div>
          <span className="bf-badge">{tournaments.length}</span>
        </div>

        {loading ? <p className="bf-empty">Cargando torneos...</p> : null}
        {!loading && tournaments.length === 0 ? (
          <p className="bf-empty">Todavia no hay torneos creados.</p>
        ) : null}

        {!loading && tournaments.length > 0 ? (
          compact ? (
            <label className="bf-field-compact">
              Torneo activo
              <select
                value={selectedTournamentId ?? ""}
                onChange={(event) => selectTournament(Number(event.target.value))}
              >
                {tournaments.map((tournament) => (
                  <option key={tournament.id} value={tournament.id}>
                    {tournament.name} · {getFormatLabel(tournament.format)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="bf-list">
              {tournaments.map((tournament) => (
                <button
                  key={tournament.id}
                  type="button"
                  className={`bf-card ${selectedTournamentId === tournament.id ? "is-active" : ""}`}
                  onClick={() => selectTournament(tournament.id)}
                >
                  <strong>{tournament.name}</strong>
                  <span>{tournament.game}</span>
                  <small>{getFormatLabel(tournament.format)}</small>
                  <small>{tournament.status}</small>
                </button>
              ))}
            </div>
          )
        ) : null}
      </div>
    );
  }

  function renderTournamentForm(compact: boolean) {
    const form = (
      <form className={`bf-form ${compact ? "bf-form-compact" : ""}`} onSubmit={handleCreateTournament}>
        <label>
          Nombre
          <input
            value={tournamentForm.name}
            onChange={(event) =>
              setTournamentForm((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="Torneo Warzone"
            required
          />
        </label>
        <label>
          Juego
          <input
            value={tournamentForm.game}
            onChange={(event) =>
              setTournamentForm((current) => ({ ...current, game: event.target.value }))
            }
            placeholder="Warzone"
            required
          />
        </label>
        <label>
          Formato
          <select
            value={tournamentForm.format}
            onChange={(event) =>
              setTournamentForm((current) => ({
                ...current,
                format: event.target.value as TournamentFormat,
              }))
            }
          >
            {formatOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? "Guardando..." : "Crear torneo"}
        </button>
      </form>
    );

    if (!compact) {
      return (
        <div className="bf-panel">
          <div className="bf-panel-header">
            <div>
              <p className="bf-eyebrow">Crear</p>
              <h2>Nuevo torneo</h2>
            </div>
          </div>
          {form}
        </div>
      );
    }

    return (
      <details className="bf-panel bf-panel-compact">
        <summary className="bf-details-summary">
          <div>
            <p className="bf-eyebrow">Secundario</p>
            <h2>Nuevo torneo</h2>
          </div>
          <span className="bf-pill">Abrir</span>
        </summary>
        {form}
      </details>
    );
  }

  function renderPlayersSnapshot() {
    if (players.length === 0) {
      return <p className="bf-empty">Todavia no hay jugadores.</p>;
    }

    return (
      <div className="bf-tag-grid">
        {players.map((player) => (
          <span key={player.id} className="bf-tag">
            {player.nickname}
          </span>
        ))}
      </div>
    );
  }

  function renderTeamsSnapshot(animated?: boolean) {
    if (teams.length === 0) {
      return <p className="bf-empty">Todavia no hay equipos.</p>;
    }

    return (
      <div className={`bf-stack ${animated ? "bf-roulette-teams" : ""}`}>
        {teams.map((team, index) => (
          <div
            key={team.id}
            className={`bf-team-card ${animated ? "bf-roulette-team" : ""}`}
            style={animated ? { animationDelay: `${index * 80}ms` } : undefined}
          >
            <div className="bf-row">
              <strong>{team.name}</strong>
              <span>{team.source}</span>
            </div>
            {team.members.length > 0 ? (
              <div className="bf-chip-list">
                {team.members.map((member) => (
                  <span key={member.id} className="bf-chip">
                    {member.player.nickname}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ))}
        {rouletteBench.length > 0 ? (
          <div className="bf-team-card">
            <div className="bf-row">
              <strong>En espera</strong>
              <span>{rouletteBench.length}</span>
            </div>
            <div className="bf-chip-list">
              {rouletteBench.map((player) => (
                <span key={player.id} className="bf-chip bf-chip-alert">
                  {player.nickname}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  function renderResultsEditor() {
    if (teams.length === 0 || activeBattleRoyaleMatch === null) {
      return <p className="bf-empty">Necesitas equipos y una ronda activa.</p>;
    }

    const tournamentFormat = selectedTournament!.format;

    return (
      <>
        <div className="bf-round-switcher">
          {battleRoyaleMatches.map((match) => (
            <button
              key={match.id}
              type="button"
              className={`bf-round-pill ${selectedMatchId === match.id ? "is-active" : ""}`}
              onClick={() => setSelectedMatchId(match.id)}
            >
              <strong>R{match.round}</strong>
              <span>{match.status}</span>
            </button>
          ))}
        </div>

        <div className="bf-stack">
          {teams.map((team) => {
            const savedResult = selectedMatchResults.find((result) => result.team_id === team.id);
            const draftKey = getResultDraftKey(activeBattleRoyaleMatch.id, team.id);
            const killsValue =
              resultDrafts[draftKey]?.kills ?? (savedResult ? String(savedResult.kills) : "");
            const placementValue =
              resultDrafts[draftKey]?.placement ?? (savedResult ? String(savedResult.placement) : "");

            return (
              <div key={team.id} className="bf-result-card">
                <div className="bf-result-head">
                  <div>
                    <strong>{team.name}</strong>
                    <span>
                      {savedResult
                        ? isWorldSeriesFormat(tournamentFormat)
                          ? `${savedResult.kills} kills x ${formatMultiplier(savedResult.placement_points)} = ${formatPoints(savedResult.total_points, tournamentFormat)} pts`
                          : `${savedResult.kills} kills = ${formatPoints(savedResult.total_points, tournamentFormat)} pts`
                        : "Pendiente"}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="bf-button bf-button-primary"
                    onClick={() => void handleSaveResult(team.id)}
                    disabled={submitting}
                  >
                    {savedResult ? "Actualizar" : "Guardar"}
                  </button>
                </div>
                <div className="bf-form-inline bf-inline-grid">
                  <label>
                    Kills
                    <input
                      type="number"
                      min="0"
                      value={killsValue}
                      onChange={(event) =>
                        updateResultDraft(activeBattleRoyaleMatch.id, team.id, {
                          kills: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Placement
                    <input
                      type="number"
                      min="1"
                      value={placementValue}
                      onChange={(event) =>
                        updateResultDraft(activeBattleRoyaleMatch.id, team.id, {
                          placement: event.target.value,
                        })
                      }
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  }

  function renderLeaderboard() {
    if (leaderboard.length === 0) {
      return <p className="bf-empty">Todavia no hay leaderboard.</p>;
    }

    const tournamentFormat = selectedTournament!.format;

    return (
      <div className="bf-stack">
        {leaderboard.map((entry, index) => (
          <div key={entry.team_id} className="bf-score-row">
            <div className="bf-score-identity">
              <span className="bf-rank">#{index + 1}</span>
              <strong>{entry.team_name}</strong>
            </div>
            <div className="bf-score-metrics">
              <small>{entry.kills} kills</small>
              {isWorldSeriesFormat(tournamentFormat) ? (
                <>
                  <small>x {formatMultiplier(entry.placement_points)}</small>
                  <small>{formatPoints(entry.total_points, tournamentFormat)} pts</small>
                </>
              ) : (
                <small>{formatPoints(entry.total_points, tournamentFormat)} pts</small>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderClassicMatches() {
    if (classicMatches.length === 0) {
      return <p className="bf-empty">Todavia no hay cruces.</p>;
    }

    return (
      <div className="bf-stack">
        {classicMatches.map((match) => (
          <div key={match.id} className="bf-match">
            <div>
              <span>Ronda</span>
              <strong>{match.round}</strong>
            </div>
            <div>
              <span>Equipo A</span>
              <strong>{getTeamLabel(match.team_a_id, teams)}</strong>
            </div>
            <div>
              <span>Equipo B</span>
              <strong>{getTeamLabel(match.team_b_id, teams)}</strong>
            </div>
            <div>
              <span>Ganador</span>
              <strong>{getTeamLabel(match.winner_id, teams)}</strong>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderMainPanel() {
    if (!selectedTournament) {
      return (
        <article className="bf-panel">
          <div className="bf-panel-header">
            <div>
              <p className="bf-eyebrow">Inicio</p>
              <h2>Selecciona o crea un torneo</h2>
            </div>
          </div>
          <p className="bf-empty">La vista principal aparece cuando hay un torneo activo.</p>
        </article>
      );
    }

    return (
      <article className="bf-panel">
        <div className="bf-panel-header">
          <div>
            <p className="bf-eyebrow">Accion actual</p>
            <h2>{currentAction.title}</h2>
          </div>
          {activeBattleRoyaleMatch ? (
            <span className="bf-pill">Ronda {activeBattleRoyaleMatch.round}</span>
          ) : (
            <span className="bf-pill">{getFormatLabel(selectedTournament.format)}</span>
          )}
        </div>

        <p className="bf-panel-copy">{currentAction.description}</p>

        {currentAction.kind === "players" ? (
          <>
            <div className="bf-status-strip">
              {players.length < minimumPlayers ? (
                <>
                  <span className="bf-pill">
                    {players.length}/{minimumPlayers} · faltan {playersRemaining}
                  </span>
                  <span className="bf-muted-copy">
                    Faltan {playersRemaining} jugadores para sortear.
                  </span>
                </>
              ) : (
                <>
                  <span className="bf-pill">
                    {players.length} jugadores → {getTeamCountProjection(players.length, rouletteTeamSize)}{" "}
                    {getParejasLabel(selectedTournament!.format)}
                    {getBenchCount(players.length, rouletteTeamSize) > 0
                      ? ` · ${getBenchCount(players.length, rouletteTeamSize)} en banca`
                      : ""}
                  </span>
                  <span className="bf-muted-copy">Listo para sortear.</span>
                </>
              )}
            </div>
            <form className="bf-form bf-form-inline" onSubmit={handleCreatePlayer}>
              <label className="bf-grow">
                Alias del jugador
                <input
                  ref={playerInputRef}
                  value={playerNickname}
                  onChange={(event) => {
                    setPlayerNickname(event.target.value);
                    if (playerFormError) {
                      setPlayerFormError(null);
                    }
                  }}
                  placeholder="Ej: Vito"
                />
              </label>
              <button type="submit" disabled={submitting}>
                Anadir jugador
              </button>
            </form>
            {playerFormError ? <p className="bf-inline-error">{playerFormError}</p> : null}
            {renderPlayersSnapshot()}
            {rouletteEnabled ? (
              <div className="bf-form">
                <label>
                  Seed opcional
                  <input
                    value={rouletteSeed}
                    onChange={(event) => setRouletteSeed(event.target.value)}
                    placeholder="wsow-seed-01"
                  />
                </label>
                <div className="bf-button-row">
                  <button
                    type="button"
                    className="bf-button bf-button-primary bf-cta-primary"
                    onClick={() => void handleGenerateRoulette(rouletteTeamSize)}
                    disabled={submitting || players.length < minimumPlayers}
                  >
                    {getSorteoLabel(selectedTournament!.format)}
                  </button>
                </div>
                {players.length < minimumPlayers ? (
                  <p className="bf-muted-copy">Faltan {playersRemaining} jugadores para sortear.</p>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}

        {currentAction.kind === "teams" ? (
          <>
            <form className="bf-form bf-form-inline" onSubmit={handleCreateTeam}>
              <label className="bf-grow">
                Nombre del equipo
                <input
                  value={teamName}
                  onChange={(event) => setTeamName(event.target.value)}
                  placeholder="Ej: Team Alpha"
                  required
                />
              </label>
              <button type="submit" disabled={submitting}>
                Anadir equipo
              </button>
            </form>
            {renderTeamsSnapshot()}
          </>
        ) : null}

        {currentAction.kind === "round" ? (
          <>
            <form className="bf-form bf-form-inline" onSubmit={handleCreateBattleRoyaleMatch}>
              <label className="bf-grow">
                Numero de ronda
                <input
                  type="number"
                  min="1"
                  value={matchRound}
                  onChange={(event) => setMatchRound(event.target.value)}
                  required
                />
              </label>
              <button type="submit" disabled={submitting}>
                Crear ronda
              </button>
            </form>
          </>
        ) : null}

        {currentAction.kind === "results" ? renderResultsEditor() : null}

        {currentAction.kind === "leaderboard" ? renderLeaderboard() : null}

        {currentAction.kind === "bracket" ? (
          <>
            <div className="bf-button-row">
              <button
                type="button"
                className="bf-button bf-button-primary"
                onClick={handleGenerateBracket}
                disabled={submitting}
              >
                Generar bracket
              </button>
            </div>
          </>
        ) : null}

        {currentAction.kind === "matches" ? renderClassicMatches() : null}
      </article>
    );
  }

  const showRoundBreakdown = currentAction.kind === "leaderboard" && sortedRounds.length > 0;
  const showGeneratedTeams = rouletteEnabled && teams.length > 0 && currentAction.kind !== "teams";
  const canResort = rouletteEnabled && teams.length > 0 && tournamentResults.length === 0;

  return (
    <main className="bf-shell">
      <header className="bf-header">
        <div className="bf-header-brand">
          <h1>BracketFlow</h1>
          <p>{selectedTournament ? `Torneo activo: ${selectedTournament.name}` : "Selecciona un torneo real para empezar."}</p>
        </div>
        <div className={`bf-status ${backendOnline ? "is-online" : "is-offline"}`}>
          <span className="bf-status-dot" />
          {backendOnline ? "Backend online" : "Backend offline"}
        </div>
      </header>

      {message ? <p className="bf-message">{message}</p> : null}

      {!selectedTournament ? (
        <section className="bf-setup-grid">
          {renderTournamentSelector(false)}
          {renderTournamentForm(false)}
        </section>
      ) : (
        <>
          <section className="bf-toolbar">
            <div className="bf-panel bf-panel-compact">
              <p className="bf-eyebrow">Torneo activo</p>
              <div className="bf-toolbar-row">
                <div>
                  <h2>{selectedTournament.name}</h2>
                  <p>
                    {selectedTournament.game} · {getFormatLabel(selectedTournament.format)}
                  </p>
                </div>
                <span className="bf-pill">{selectedTournament.status}</span>
              </div>
            </div>
            {renderTournamentSelector(true)}
            {renderTournamentForm(true)}
          </section>

          {flowSteps.length > 0 ? (
            <section className="bf-progress">
              <div className="bf-progress-meta">
                <span>Progreso</span>
                <strong>
                  {completedSteps}/{flowSteps.length}
                </strong>
              </div>
              <div className="bf-progress-bar">
                {flowSteps.map((step, index) => (
                  <div
                    key={step.label}
                    className={`bf-progress-step is-${step.state}`}
                    title={step.hint}
                  >
                    <span className="bf-progress-index">
                      {step.state === "done" ? "OK" : index + 1}
                    </span>
                    <span className="bf-progress-label">{step.label}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="bf-main-layout">
            <div className="bf-main-col">{renderMainPanel()}</div>

            <aside className="bf-side-col">
              <div className="bf-panel bf-panel-compact">
                <div className="bf-panel-header">
                  <div>
                    <p className="bf-eyebrow">Resumen</p>
                    <h2>Torneo activo</h2>
                  </div>
                </div>
                <div className="bf-context-list">
                  <div className="bf-context-stat">
                    <span>Formato</span>
                    <strong>{getFormatLabel(selectedTournament.format)}</strong>
                  </div>
                  {rouletteEnabled ? (
                    <div className="bf-context-stat">
                      <span>Jugadores</span>
                      <strong>{players.length}</strong>
                    </div>
                  ) : null}
                  <div className="bf-context-stat">
                    <span>Equipos</span>
                    <strong>{teams.length}</strong>
                  </div>
                  <div className="bf-context-stat">
                    <span>Rondas</span>
                    <strong>{battleRoyaleEnabled ? battleRoyaleMatches.length : classicMatches.length}</strong>
                  </div>
                  <div className="bf-context-stat">
                    <span>Resultados</span>
                    <strong>{tournamentResults.length}</strong>
                  </div>
                  <div className="bf-context-stat">
                    <span>Estado</span>
                    <strong>{selectedTournament.status}</strong>
                  </div>
                  {rouletteEnabled && teams.length === 0 ? (
                    <div className="bf-context-stat">
                      <span>Proyeccion</span>
                      <strong>
                        {players.length < minimumPlayers
                          ? `${players.length}/${minimumPlayers} · faltan ${playersRemaining}`
                          : `${players.length} jugadores → ${getTeamCountProjection(players.length, rouletteTeamSize)} ${getParejasLabel(selectedTournament.format)}${getBenchCount(players.length, rouletteTeamSize) > 0 ? ` · ${getBenchCount(players.length, rouletteTeamSize)} en banca` : ""}`}
                      </strong>
                    </div>
                  ) : null}
                </div>
                <p className="bf-action-copy">{currentAction.description}</p>
              </div>
            </aside>
          </section>

          {showGeneratedTeams ? (
            <section className="bf-secondary-section" key={teamsRevealKey}>
              <div className="bf-panel">
                <div className="bf-panel-header">
                  <div>
                    <p className="bf-eyebrow">Resultado</p>
                    <h2>Equipos generados</h2>
                  </div>
                  {canResort ? (
                    <button
                      type="button"
                      className="bf-button bf-cta-secondary"
                      onClick={() => void handleGenerateRoulette(rouletteTeamSize)}
                      disabled={submitting}
                    >
                      Volver a sortear
                    </button>
                  ) : null}
                </div>
                {renderTeamsSnapshot(true)}
              </div>
            </section>
          ) : null}

          {showRoundBreakdown ? (
            <section className="bf-secondary-section">
              <div className="bf-panel">
                <div className="bf-panel-header">
                  <div>
                    <p className="bf-eyebrow">Detalle</p>
                    <h2>Resultados por ronda</h2>
                  </div>
                </div>

                <div className="bf-stack">
                  {sortedRounds.map((round) => (
                    <div key={round} className="bf-round-card">
                      <div className="bf-row">
                        <strong>Ronda {round}</strong>
                        <span>{roundResults[round][0]?.match_status ?? "pending"}</span>
                      </div>
                      {isWorldSeriesFormat(selectedTournament!.format) ? (
                        <div className="bf-round-table is-world-series">
                          <div className="bf-round-head">Equipo</div>
                          <div className="bf-round-head">Kills</div>
                          <div className="bf-round-head">Place</div>
                          <div className="bf-round-head">Mult</div>
                          <div className="bf-round-head">Total</div>
                          {roundResults[round].map((result) => (
                            <div key={result.id} className="bf-round-row">
                              <strong>{result.team_name}</strong>
                              <span>{result.kills}</span>
                              <span>{result.placement}</span>
                              <span>x {formatMultiplier(result.placement_points)}</span>
                              <span>{formatPoints(result.total_points, selectedTournament!.format)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="bf-round-table is-roulette">
                          <div className="bf-round-head">Equipo</div>
                          <div className="bf-round-head">Kills</div>
                          <div className="bf-round-head">Total</div>
                          {roundResults[round].map((result) => (
                            <div key={result.id} className="bf-round-row">
                              <strong>{result.team_name}</strong>
                              <span>{result.kills}</span>
                              <span>{formatPoints(result.total_points, selectedTournament!.format)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
