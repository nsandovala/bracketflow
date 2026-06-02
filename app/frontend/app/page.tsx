"use client";

import { FormEvent, useEffect, useEffectEvent, useState } from "react";

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

function isBattleRoyaleFormat(format: TournamentFormat) {
  return battleRoyaleFormats.has(format);
}

function isRouletteFormat(format: TournamentFormat) {
  return format === "roulette_2v2" || format === "roulette_3v3";
}

function getDefaultTeamSize(format: TournamentFormat) {
  if (format === "roulette_3v3") {
    return 3;
  }
  return 2;
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
  teamsCount: number;
  roundsCount: number;
  hasResults: boolean;
  hasLeaderboard: boolean;
  rouletteMode: boolean;
}): FlowStep[] {
  const { playersCount, teamsCount, roundsCount, hasResults, hasLeaderboard, rouletteMode } = params;
  const teamsLabel = rouletteMode ? "Generar ruleta" : "Preparar equipos";
  const teamsHint = rouletteMode
    ? "Forma squads reales a partir de jugadores cargados."
    : "Carga los equipos reales que van a sumar puntos.";

  return [
    {
      label: "Crear torneo",
      hint: "Define nombre, juego y formato.",
      state: "done",
    },
    {
      label: "Agregar jugadores",
      hint: "Completa la lista real de participantes.",
      state: getStepState(playersCount > 0, playersCount === 0),
    },
    {
      label: teamsLabel,
      hint: teamsHint,
      state: getStepState(
        teamsCount > 0,
        playersCount > 0 && teamsCount === 0
      ),
    },
    {
      label: "Crear ronda",
      hint: "Abre la siguiente ronda antes de puntuar.",
      state: getStepState(roundsCount > 0, teamsCount > 0 && roundsCount === 0),
    },
    {
      label: "Registrar resultados",
      hint: "Carga kills y placement por equipo.",
      state: getStepState(hasResults, roundsCount > 0 && !hasResults),
    },
    {
      label: "Ver leaderboard",
      hint: "Revisa el acumulado y el detalle por ronda.",
      state: getStepState(hasLeaderboard, hasResults && !hasLeaderboard),
    },
  ];
}

function buildClassicSteps(params: {
  playersCount: number;
  teamsCount: number;
  matchesCount: number;
}): FlowStep[] {
  const { playersCount, teamsCount, matchesCount } = params;

  return [
    {
      label: "Crear torneo",
      hint: "Define nombre, juego y formato.",
      state: "done",
    },
    {
      label: "Agregar jugadores",
      hint: "Carga participantes reales del torneo.",
      state: getStepState(playersCount > 0, playersCount === 0),
    },
    {
      label: "Crear equipos",
      hint: "Arma los equipos manualmente.",
      state: getStepState(teamsCount > 0, playersCount > 0 && teamsCount === 0),
    },
    {
      label: "Generar bracket",
      hint: "Crea los cruces del torneo clasico.",
      state: getStepState(matchesCount > 0, teamsCount > 0 && matchesCount === 0),
    },
    {
      label: "Revisar cruces",
      hint: "Confirma rounds y enfrentamientos.",
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
  const [rouletteSeed, setRouletteSeed] = useState("");
  const [matchRound, setMatchRound] = useState("1");
  const [resultDrafts, setResultDrafts] = useState<Record<number, { kills: string; placement: string }>>({});

  async function refreshTournaments(nextSelectedId?: number) {
    const items = await getTournaments();
    setTournaments(items);

    const fallbackId = nextSelectedId ?? selectedTournamentId ?? items[0]?.id ?? null;
    setSelectedTournamentId(fallbackId);

    if (fallbackId === null) {
      setSelectedTournament(null);
      setPlayers([]);
      setTeams([]);
      setMatches([]);
      setLeaderboard([]);
      setTournamentResults([]);
      setSelectedMatchId(null);
    }
  }

  async function refreshSelectedTournament(tournamentId: number) {
    const tournament = await getTournament(tournamentId);
    const [nextPlayers, nextTeams, nextMatches] = await Promise.all([
      getPlayers(tournamentId),
      getTeams(tournamentId),
      getMatches(tournamentId),
    ]);
    const [nextLeaderboard, nextTournamentResults] = isBattleRoyaleFormat(tournament.format)
      ? await Promise.all([getLeaderboard(tournamentId), getTournamentResults(tournamentId)])
      : [[], []];

    setSelectedTournament(tournament);
    setPlayers(nextPlayers);
    setTeams(nextTeams);
    setMatches(nextMatches);
    setLeaderboard(nextLeaderboard);
    setTournamentResults(nextTournamentResults);

    const battleRoyaleMatches = nextMatches.filter(
      (match) => match.team_a_id === null && match.team_b_id === null
    );
    setSelectedMatchId((current) => {
      if (current !== null && battleRoyaleMatches.some((match) => match.id === current)) {
        return current;
      }
      return battleRoyaleMatches.at(-1)?.id ?? null;
    });

    const nextRoundNumber =
      nextMatches.length > 0 ? Math.max(...nextMatches.map((match) => match.round)) + 1 : 1;
    setMatchRound(String(nextRoundNumber));
  }

  const loadInitialData = useEffectEvent(async () => {
    try {
      const health = await getHealth();
      setBackendOnline(health.status === "ok");
      await refreshTournaments();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo conectar al backend");
      setBackendOnline(false);
    } finally {
      setLoading(false);
    }
  });

  const loadTournamentDetails = useEffectEvent(async (tournamentId: number) => {
    try {
      await refreshSelectedTournament(tournamentId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar el torneo");
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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear el torneo");
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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo agregar el equipo");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreatePlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedTournamentId === null) {
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      await createPlayer(selectedTournamentId, { nickname: playerNickname });
      setPlayerNickname("");
      await refreshSelectedTournament(selectedTournamentId);
      setMessage("Jugador agregado");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo agregar el jugador");
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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo generar el bracket");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGenerateRoulette(teamSize: number) {
    if (selectedTournamentId === null) {
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
      const benchSuffix =
        result.bench.length > 0
          ? ` Bench: ${result.bench.map((player) => player.nickname).join(", ")}`
          : "";
      setMessage(
        `Ruleta ${teamSize}v${teamSize} generada con ${result.teams_created.length} equipos.${benchSuffix}`
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo generar la ruleta");
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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear la ronda");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveResult(teamId: number) {
    if (selectedMatchId === null || selectedTournamentId === null) {
      return;
    }

    const draft = resultDrafts[teamId];
    const currentResult = tournamentResults.find(
      (result) => result.match_id === selectedMatchId && result.team_id === teamId
    );
    const killsValue = draft?.kills ?? (currentResult ? String(currentResult.kills) : "");
    const placementValue =
      draft?.placement ?? (currentResult ? String(currentResult.placement) : "");

    if (!killsValue || !placementValue) {
      setMessage("Completa kills y placement antes de guardar el resultado");
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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el resultado");
    } finally {
      setSubmitting(false);
    }
  }

  const classicMatches = matches.filter(
    (match) => match.team_a_id !== null || match.team_b_id !== null
  );
  const battleRoyaleMatches = matches.filter(
    (match) => match.team_a_id === null && match.team_b_id === null
  );
  const battleRoyaleEnabled =
    selectedTournament !== null && isBattleRoyaleFormat(selectedTournament.format);
  const rouletteEnabled =
    selectedTournament !== null && isRouletteFormat(selectedTournament.format);
  const classicEnabled = selectedTournament?.format === "single_elimination";
  const manualTeamsEnabled = selectedTournament !== null && !rouletteEnabled;
  const roundResults = tournamentResults.reduce<Record<number, TeamResultDetail[]>>(
    (groups, result) => {
      const bucket = groups[result.round] ?? [];
      bucket.push(result);
      groups[result.round] = bucket;
      return groups;
    },
    {}
  );
  const sortedRounds = Object.keys(roundResults)
    .map(Number)
    .sort((left, right) => left - right);
  const selectedMatchResults = selectedMatchId
    ? tournamentResults.filter((result) => result.match_id === selectedMatchId)
    : [];
  const hasSavedResults = tournamentResults.length > 0;
  const hasLeaderboard = leaderboard.length > 0;
  const canCreateRounds = battleRoyaleEnabled && teams.length > 0;
  const canEnterResults = canCreateRounds && selectedMatchId !== null;
  const flowSteps =
    selectedTournament === null
      ? []
      : battleRoyaleEnabled
        ? buildBattleRoyaleSteps({
            playersCount: players.length,
            teamsCount: teams.length,
            roundsCount: battleRoyaleMatches.length,
            hasResults: hasSavedResults,
            hasLeaderboard,
            rouletteMode: rouletteEnabled,
          })
        : buildClassicSteps({
            playersCount: players.length,
            teamsCount: teams.length,
            matchesCount: classicMatches.length,
          });

  let nextTitle = "Crea o selecciona un torneo";
  let nextDescription = "La interfaz se ordena automaticamente a partir del torneo activo.";

  if (selectedTournament) {
    if (battleRoyaleEnabled) {
      if (players.length === 0) {
        nextTitle = "Siguiente paso: agregar jugadores";
        nextDescription = "Carga los jugadores reales del torneo antes de armar equipos o ruleta.";
      } else if (teams.length === 0) {
        nextTitle = rouletteEnabled
          ? "Siguiente paso: generar la ruleta"
          : "Siguiente paso: crear equipos";
        nextDescription = rouletteEnabled
          ? "Con los jugadores listos, genera squads 2v2 o 3v3 para empezar la ronda."
          : "Con los jugadores listos, carga los equipos reales que van a puntuar.";
      } else if (battleRoyaleMatches.length === 0) {
        nextTitle = "Siguiente paso: crear una ronda";
        nextDescription = "Abre la siguiente ronda para habilitar la carga de resultados.";
      } else if (!hasSavedResults) {
        nextTitle = "Siguiente paso: registrar resultados";
        nextDescription = "Selecciona una ronda y guarda kills y placement por equipo.";
      } else {
        nextTitle = "Leaderboard activo";
        nextDescription = "Ya puedes revisar el acumulado y el detalle por ronda sin paneles sobrantes.";
      }
    } else {
      if (players.length === 0) {
        nextTitle = "Siguiente paso: agregar jugadores";
        nextDescription = "Carga participantes reales antes de crear equipos.";
      } else if (teams.length === 0) {
        nextTitle = "Siguiente paso: crear equipos";
        nextDescription = "Completa los equipos reales para luego generar el bracket clasico.";
      } else if (classicMatches.length === 0) {
        nextTitle = "Siguiente paso: generar bracket";
        nextDescription = "Con equipos listos, crea los cruces del torneo.";
      } else {
        nextTitle = "Bracket listo";
        nextDescription = "Revisa rounds y enfrentamientos del formato clasico.";
      }
    }
  }

  return (
    <main className="bf-shell">
      <section className="bf-hero">
        <div>
          <p className="bf-kicker">BracketFlow operations</p>
          <h1>BracketFlow</h1>
          <p className="bf-subtitle">
            Flujo guiado para torneos reales: crea, carga, genera y puntua sin paneles vacios ni
            datos demo.
          </p>
        </div>
        <div className={`bf-status ${backendOnline ? "is-online" : "is-offline"}`}>
          <span className="bf-status-dot" />
          {backendOnline ? "Backend online" : "Backend offline"}
        </div>
      </section>

      {message ? <p className="bf-message">{message}</p> : null}

      <section className="bf-grid">
        <article className="bf-panel">
          <div className="bf-panel-header">
            <div>
              <p className="bf-eyebrow">Paso 1</p>
              <h2>Crear torneo</h2>
            </div>
          </div>
          <form className="bf-form" onSubmit={handleCreateTournament}>
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
        </article>

        <article className="bf-panel">
          <div className="bf-panel-header">
            <div>
              <p className="bf-eyebrow">Paso 1</p>
              <h2>Seleccionar torneo</h2>
            </div>
            <span className="bf-badge">{tournaments.length}</span>
          </div>
          <div className="bf-list">
            {loading ? <p className="bf-empty">Cargando torneos...</p> : null}
            {!loading && tournaments.length === 0 ? (
              <p className="bf-empty">Todavia no hay torneos creados.</p>
            ) : null}
            {tournaments.map((tournament) => (
              <button
                key={tournament.id}
                type="button"
                className={`bf-card ${selectedTournamentId === tournament.id ? "is-active" : ""}`}
                onClick={() => setSelectedTournamentId(tournament.id)}
              >
                <strong>{tournament.name}</strong>
                <span>{tournament.game}</span>
                <small>{getFormatLabel(tournament.format)}</small>
                <small>{tournament.status}</small>
              </button>
            ))}
          </div>
        </article>
      </section>

      {selectedTournament ? (
        <section className="bf-panel bf-panel-stage">
          <div className="bf-panel-header">
            <div>
              <p className="bf-eyebrow">Flujo activo</p>
              <h2>{selectedTournament.name}</h2>
            </div>
            <span className="bf-pill">{getFormatLabel(selectedTournament.format)}</span>
          </div>

          <div className="bf-stage-summary">
            <div className="bf-stat">
              <span>Juego</span>
              <strong>{selectedTournament.game}</strong>
            </div>
            <div className="bf-stat">
              <span>Estado</span>
              <strong>{selectedTournament.status}</strong>
            </div>
            <div className="bf-stat">
              <span>Team size</span>
              <strong>{selectedTournament.team_size}</strong>
            </div>
            <div className="bf-stat">
              <span>Scoring</span>
              <strong>{selectedTournament.scoring_profile}</strong>
            </div>
          </div>

          <div className="bf-next-card">
            <p className="bf-eyebrow">Proximo paso</p>
            <strong>{nextTitle}</strong>
            <p>{nextDescription}</p>
          </div>

          <div className="bf-step-list">
            {flowSteps.map((step, index) => (
              <div key={step.label} className={`bf-step is-${step.state}`}>
                <span className="bf-step-index">{index + 1}</span>
                <div className="bf-step-copy">
                  <strong>{step.label}</strong>
                  <span>{step.hint}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="bf-panel bf-guidance">
          <p className="bf-eyebrow">Flujo activo</p>
          <h2>Selecciona un torneo para abrir el flujo guiado</h2>
          <p>
            Cuando haya un torneo activo, la interfaz mostrara solo las secciones necesarias para
            la etapa actual.
          </p>
        </section>
      )}

      {selectedTournament ? (
        <section className="bf-grid bf-grid-detail">
          <article className="bf-panel">
            <div className="bf-panel-header">
              <div>
                <p className="bf-eyebrow">Paso 2</p>
                <h2>Jugadores</h2>
              </div>
              <span className="bf-badge">{players.length}</span>
            </div>
            <form className="bf-form bf-form-inline" onSubmit={handleCreatePlayer}>
              <label className="bf-grow">
                Nickname
                <input
                  value={playerNickname}
                  onChange={(event) => setPlayerNickname(event.target.value)}
                  placeholder="Vito"
                  required
                />
              </label>
              <button type="submit" disabled={submitting}>
                Agregar
              </button>
            </form>
            <div className="bf-list">
              {players.length === 0 ? (
                <p className="bf-empty">Todavia no hay jugadores cargados para este torneo.</p>
              ) : null}
              {players.map((player) => (
                <div key={player.id} className="bf-row">
                  <strong>{player.nickname}</strong>
                  <span>Jugador registrado</span>
                </div>
              ))}
            </div>
          </article>

          {manualTeamsEnabled ? (
            <article className="bf-panel">
              <div className="bf-panel-header">
                <div>
                  <p className="bf-eyebrow">Paso 3</p>
                  <h2>{classicEnabled ? "Equipos" : "Equipos para puntuar"}</h2>
                </div>
                <span className="bf-badge">{teams.length}</span>
              </div>
              <form className="bf-form bf-form-inline" onSubmit={handleCreateTeam}>
                <label className="bf-grow">
                  Nombre del equipo
                  <input
                    value={teamName}
                    onChange={(event) => setTeamName(event.target.value)}
                    placeholder="Team Alpha"
                    required
                  />
                </label>
                <button type="submit" disabled={submitting}>
                  Agregar
                </button>
              </form>
              <div className="bf-list">
                {teams.length === 0 ? (
                  <p className="bf-empty">Todavia no hay equipos creados para este torneo.</p>
                ) : null}
                {teams.map((team) => (
                  <div key={team.id} className="bf-team-card">
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
                    ) : (
                      <p className="bf-empty">Sin miembros asignados.</p>
                    )}
                  </div>
                ))}
              </div>
            </article>
          ) : players.length > 0 ? (
            <article className="bf-panel">
              <div className="bf-panel-header">
                <div>
                  <p className="bf-eyebrow">Paso 3</p>
                  <h2>Ruleta y equipos</h2>
                </div>
                <span className="bf-badge">{teams.length}</span>
              </div>
              <div className="bf-stack">
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
                    className="bf-secondary-button"
                    onClick={() => void handleGenerateRoulette(2)}
                    disabled={submitting}
                  >
                    Generar ruleta 2v2
                  </button>
                  <button
                    type="button"
                    className="bf-secondary-button"
                    onClick={() => void handleGenerateRoulette(3)}
                    disabled={submitting}
                  >
                    Generar ruleta 3v3
                  </button>
                </div>
                {teams.length > 0 ? (
                  <div className="bf-list">
                    {teams.map((team) => (
                      <div key={team.id} className="bf-team-card">
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
                        ) : (
                          <p className="bf-empty">Sin miembros asignados.</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="bf-empty">
                    Cuando generes la ruleta, los equipos apareceran aqui.
                  </p>
                )}
              </div>
            </article>
          ) : null}
        </section>
      ) : null}

      {selectedTournament && battleRoyaleEnabled && canCreateRounds ? (
        <section className="bf-grid bf-grid-detail">
          <article className="bf-panel">
            <div className="bf-panel-header">
              <div>
                <p className="bf-eyebrow">Paso 4</p>
                <h2>Rondas</h2>
              </div>
              <span className="bf-badge">{battleRoyaleMatches.length}</span>
            </div>
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
            <div className="bf-list">
              {battleRoyaleMatches.length === 0 ? (
                <p className="bf-empty">Todavia no hay rondas creadas.</p>
              ) : null}
              {battleRoyaleMatches.map((match) => (
                <button
                  key={match.id}
                  type="button"
                  className={`bf-card ${selectedMatchId === match.id ? "is-active" : ""}`}
                  onClick={() => setSelectedMatchId(match.id)}
                >
                  <strong>Ronda {match.round}</strong>
                  <span>{selectedMatchId === match.id ? "Ronda activa" : "Seleccionar ronda"}</span>
                  <small>{match.status}</small>
                </button>
              ))}
            </div>
          </article>

          {canEnterResults ? (
            <article className="bf-panel">
              <div className="bf-panel-header">
                <div>
                  <p className="bf-eyebrow">Paso 5</p>
                  <h2>Cargar resultados</h2>
                </div>
                <span className="bf-pill">Ronda {battleRoyaleMatches.find((match) => match.id === selectedMatchId)?.round}</span>
              </div>
              <div className="bf-list">
                {teams.map((team) => {
                  const savedResult = selectedMatchResults.find((result) => result.team_id === team.id);
                  const killsValue = resultDrafts[team.id]?.kills ?? (savedResult ? String(savedResult.kills) : "");
                  const placementValue =
                    resultDrafts[team.id]?.placement ??
                    (savedResult ? String(savedResult.placement) : "");

                  return (
                    <div key={team.id} className="bf-result-card">
                      <div className="bf-row">
                        <strong>{team.name}</strong>
                        <span>
                          {savedResult
                            ? `${savedResult.total_points} pts guardados`
                            : "Pendiente de carga"}
                        </span>
                      </div>
                      <div className="bf-form-inline bf-inline-grid">
                        <label>
                          Kills
                          <input
                            type="number"
                            min="0"
                            value={killsValue}
                            onChange={(event) =>
                              setResultDrafts((current) => ({
                                ...current,
                                [team.id]: {
                                  kills: event.target.value,
                                  placement: current[team.id]?.placement ?? placementValue,
                                },
                              }))
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
                              setResultDrafts((current) => ({
                                ...current,
                                [team.id]: {
                                  kills: current[team.id]?.kills ?? killsValue,
                                  placement: event.target.value,
                                },
                              }))
                            }
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => void handleSaveResult(team.id)}
                          disabled={submitting}
                        >
                          {savedResult ? "Actualizar" : "Guardar"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          ) : null}
        </section>
      ) : null}

      {selectedTournament && battleRoyaleEnabled && hasLeaderboard ? (
        <section className="bf-grid bf-grid-detail">
          <article className="bf-panel">
            <div className="bf-panel-header">
              <div>
                <p className="bf-eyebrow">Paso 6</p>
                <h2>Leaderboard</h2>
              </div>
            </div>
            <div className="bf-list">
              {leaderboard.map((entry, index) => (
                <div key={entry.team_id} className="bf-score-row">
                  <div>
                    <span>#{index + 1}</span>
                    <strong>{entry.team_name}</strong>
                  </div>
                  <div className="bf-score-metrics">
                    <small>{entry.total_points} pts</small>
                    <small>{entry.kills} kills</small>
                    <small>{entry.placement_points} placement</small>
                    <small>{entry.matches_played} rounds</small>
                    <small>best {entry.best_placement ?? "-"}</small>
                  </div>
                </div>
              ))}
            </div>
          </article>

          {sortedRounds.length > 0 ? (
            <article className="bf-panel">
              <div className="bf-panel-header">
                <div>
                  <p className="bf-eyebrow">Detalle</p>
                  <h2>Puntos por ronda</h2>
                </div>
              </div>
              <div className="bf-list">
                {sortedRounds.map((round) => (
                  <div key={round} className="bf-round-card">
                    <div className="bf-row">
                      <strong>Ronda {round}</strong>
                      <span>{roundResults[round][0]?.match_status ?? "pending"}</span>
                    </div>
                    <div className="bf-round-table">
                      <div className="bf-round-head">Equipo</div>
                      <div className="bf-round-head">Kills</div>
                      <div className="bf-round-head">Placement</div>
                      <div className="bf-round-head">Kill pts</div>
                      <div className="bf-round-head">Place pts</div>
                      <div className="bf-round-head">Total</div>
                      {roundResults[round].map((result) => (
                        <div key={result.id} className="bf-round-row">
                          <strong>{result.team_name}</strong>
                          <span>{result.kills}</span>
                          <span>{result.placement}</span>
                          <span>{result.kill_points}</span>
                          <span>{result.placement_points}</span>
                          <span>{result.total_points}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ) : null}
        </section>
      ) : null}

      {selectedTournament && classicEnabled ? (
        <section className="bf-panel">
          <div className="bf-panel-header">
            <div>
              <p className="bf-eyebrow">Bracket</p>
              <h2>Bracket clasico</h2>
            </div>
            <button
              type="button"
              className="bf-secondary-button"
              onClick={handleGenerateBracket}
              disabled={submitting || selectedTournamentId === null}
            >
              Generar bracket
            </button>
          </div>
          <div className="bf-list">
            {classicMatches.length === 0 ? (
              <p className="bf-empty">Todavia no hay cruces generados para este torneo.</p>
            ) : null}
            {classicMatches.map((match) => (
              <div key={match.id} className="bf-match">
                <div>
                  <span>Round</span>
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
        </section>
      ) : null}
    </main>
  );
}
