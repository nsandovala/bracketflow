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
  getTournamentResults,
  getTeams,
  getTournament,
  getTournaments,
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

function isBattleRoyaleFormat(format: TournamentFormat) {
  return battleRoyaleFormats.has(format);
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
    if (!draft?.kills || !draft.placement) {
      setMessage("Completa kills y placement antes de guardar el resultado");
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      await saveMatchResult(selectedMatchId, {
        team_id: teamId,
        kills: Number(draft.kills),
        placement: Number(draft.placement),
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

  return (
    <main className="bf-shell">
      <section className="bf-hero">
        <div>
          <p className="bf-kicker">Tournament operations console</p>
          <h1>BracketFlow</h1>
          <p className="bf-subtitle">
            Clasico y Warzone en una sola consola: torneos, ruleta, rondas, resultados y
            leaderboard.
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
              <p className="bf-eyebrow">Create</p>
              <h2>Nuevo torneo</h2>
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
              <p className="bf-eyebrow">Lobby</p>
              <h2>Torneos</h2>
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

      <section className="bf-grid bf-grid-detail">
        <article className="bf-panel">
          <div className="bf-panel-header">
            <div>
              <p className="bf-eyebrow">Selected</p>
              <h2>Detalle del torneo</h2>
            </div>
          </div>
          {selectedTournament ? (
            <div className="bf-detail">
              <div>
                <span>Nombre</span>
                <strong>{selectedTournament.name}</strong>
              </div>
              <div>
                <span>Juego</span>
                <strong>{selectedTournament.game}</strong>
              </div>
              <div>
                <span>Estado</span>
                <strong>{selectedTournament.status}</strong>
              </div>
              <div>
                <span>Formato</span>
                <strong>{getFormatLabel(selectedTournament.format)}</strong>
              </div>
              <div>
                <span>Team size</span>
                <strong>{selectedTournament.team_size}</strong>
              </div>
              <div>
                <span>Scoring</span>
                <strong>{selectedTournament.scoring_profile}</strong>
              </div>
            </div>
          ) : (
            <p className="bf-empty">Selecciona un torneo para ver su detalle.</p>
          )}
        </article>

        <article className="bf-panel">
          <div className="bf-panel-header">
            <div>
              <p className="bf-eyebrow">Players</p>
              <h2>Jugadores</h2>
            </div>
            <span className="bf-badge">{players.length}</span>
          </div>
          {selectedTournament ? (
            <>
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
                {players.length === 0 ? <p className="bf-empty">Aun no hay jugadores.</p> : null}
                {players.map((player) => (
                  <div key={player.id} className="bf-row">
                    <strong>{player.nickname}</strong>
                    <span>#{player.id}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="bf-empty">Selecciona un torneo para administrar jugadores.</p>
          )}
        </article>
      </section>

      <section className="bf-grid bf-grid-detail">
        <article className="bf-panel">
          <div className="bf-panel-header">
            <div>
              <p className="bf-eyebrow">Teams</p>
              <h2>Equipos</h2>
            </div>
            <span className="bf-badge">{teams.length}</span>
          </div>
          {selectedTournament ? (
            <>
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
                {teams.length === 0 ? <p className="bf-empty">Aun no hay equipos.</p> : null}
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
            </>
          ) : (
            <p className="bf-empty">Selecciona un torneo para administrar equipos.</p>
          )}
        </article>

        <article className="bf-panel">
          <div className="bf-panel-header">
            <div>
              <p className="bf-eyebrow">Warzone</p>
              <h2>Ruleta y rondas</h2>
            </div>
          </div>
          {selectedTournament ? (
            battleRoyaleEnabled ? (
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
                <form className="bf-form bf-form-inline" onSubmit={handleCreateBattleRoyaleMatch}>
                  <label className="bf-grow">
                    Ronda
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
                    <p className="bf-empty">Todavia no hay rondas battle royale.</p>
                  ) : null}
                  {battleRoyaleMatches.map((match) => (
                    <button
                      key={match.id}
                      type="button"
                      className={`bf-card ${selectedMatchId === match.id ? "is-active" : ""}`}
                      onClick={() => setSelectedMatchId(match.id)}
                    >
                      <strong>Ronda {match.round}</strong>
                      <span>Match #{match.id}</span>
                      <small>{match.status}</small>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="bf-empty">
                Esta seccion se habilita para formatos battle royale y roulette.
              </p>
            )
          ) : (
            <p className="bf-empty">Selecciona un torneo para usar la seccion Warzone.</p>
          )}
        </article>
      </section>

      <section className="bf-grid bf-grid-detail">
        <article className="bf-panel">
          <div className="bf-panel-header">
            <div>
              <p className="bf-eyebrow">Results</p>
              <h2>Cargar resultados</h2>
            </div>
          </div>
          {battleRoyaleEnabled ? (
            selectedMatchId ? (
              <div className="bf-list">
                {teams.length === 0 ? <p className="bf-empty">No hay equipos para puntuar.</p> : null}
                {teams.map((team) => (
                  <div key={team.id} className="bf-result-card">
                    <div className="bf-row">
                      <strong>{team.name}</strong>
                      <span>{team.source}</span>
                    </div>
                    <div className="bf-form-inline bf-inline-grid">
                      <label>
                        Kills
                        <input
                          type="number"
                          min="0"
                          value={resultDrafts[team.id]?.kills ?? ""}
                          onChange={(event) =>
                            setResultDrafts((current) => ({
                              ...current,
                              [team.id]: {
                                kills: event.target.value,
                                placement: current[team.id]?.placement ?? "",
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
                          value={resultDrafts[team.id]?.placement ?? ""}
                          onChange={(event) =>
                            setResultDrafts((current) => ({
                              ...current,
                              [team.id]: {
                                kills: current[team.id]?.kills ?? "",
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
                        Guardar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="bf-empty">Crea o selecciona una ronda para cargar resultados.</p>
            )
          ) : (
            <p className="bf-empty">La carga de resultados aplica a torneos battle royale.</p>
          )}
        </article>

        <article className="bf-panel">
          <div className="bf-panel-header">
            <div>
              <p className="bf-eyebrow">Leaderboard</p>
              <h2>Puntaje acumulado</h2>
            </div>
          </div>
          {battleRoyaleEnabled ? (
            <div className="bf-list">
              {leaderboard.length === 0 ? (
                <p className="bf-empty">Todavia no hay puntos cargados.</p>
              ) : null}
              {leaderboard.map((entry, index) => (
                <div key={entry.team_id} className="bf-score-row">
                  <div>
                    <span>#{index + 1}</span>
                    <strong>{entry.team_name}</strong>
                  </div>
                  <div className="bf-score-metrics">
                    <small>{entry.total_points} pts</small>
                    <small>{entry.kills} kills</small>
                    <small>{entry.placement_points} place pts</small>
                    <small>{entry.matches_played} rounds</small>
                    <small>best {entry.best_placement ?? "-"}</small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="bf-empty">El leaderboard aparece para formatos battle royale.</p>
          )}
        </article>
      </section>

      <section className="bf-panel">
        <div className="bf-panel-header">
          <div>
            <p className="bf-eyebrow">Rounds</p>
            <h2>Detalle por ronda</h2>
          </div>
        </div>
        {battleRoyaleEnabled ? (
          <div className="bf-list">
            {sortedRounds.length === 0 ? (
              <p className="bf-empty">Todavia no hay resultados detallados por ronda.</p>
            ) : null}
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
        ) : (
          <p className="bf-empty">El detalle por ronda aparece para formatos battle royale.</p>
        )}
      </section>

      <section className="bf-panel">
        <div className="bf-panel-header">
          <div>
            <p className="bf-eyebrow">Classic</p>
            <h2>Bracket clasico</h2>
          </div>
          <button
            type="button"
            className="bf-secondary-button"
            onClick={handleGenerateBracket}
            disabled={
              submitting ||
              selectedTournamentId === null ||
              selectedTournament?.format !== "single_elimination"
            }
          >
            Generar bracket
          </button>
        </div>
        {selectedTournament ? (
          selectedTournament.format === "single_elimination" ? (
            <div className="bf-list">
              {classicMatches.length === 0 ? (
                <p className="bf-empty">Todavia no hay matches de bracket para este torneo.</p>
              ) : null}
              {classicMatches.map((match) => (
                <div key={match.id} className="bf-match">
                  <div>
                    <span>Round</span>
                    <strong>{match.round}</strong>
                  </div>
                  <div>
                    <span>team_a_id</span>
                    <strong>{match.team_a_id ?? "null"}</strong>
                  </div>
                  <div>
                    <span>team_b_id</span>
                    <strong>{match.team_b_id ?? "null"}</strong>
                  </div>
                  <div>
                    <span>winner_id</span>
                    <strong>{match.winner_id ?? "null"}</strong>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="bf-empty">
              Este torneo usa formato {getFormatLabel(selectedTournament.format)}. El bracket
              clasico queda disponible solo para eliminacion directa.
            </p>
          )
        ) : (
          <p className="bf-empty">Selecciona un torneo para ver el bracket clasico.</p>
        )}
      </section>
    </main>
  );
}
