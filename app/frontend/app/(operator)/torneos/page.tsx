"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CSSProperties, FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { IconDashboard, IconStandings, IconTeams, IconTrophy } from "../../components/icons";
import { useWorldSeriesPractice } from "../../lib/useWorldSeriesPractice";
import type { Tournament } from "../../../lib/api";
import { getOperatorNextAction } from "../../../lib/operatorNextAction";
import {
  ENGINE_PRESETS,
  resolveTournamentEngine,
  type TournamentEngineKey,
  type TournamentStructure,
  type TeamSize,
} from "../../../lib/tournamentModel";
import { findChampion, getMatchPointStatus, getTournamentStatusLabel } from "../../../lib/tournamentStatus";

const TOURNAMENT_MOTORS = [
  {
    id: "world-series",
    engineKey: "wsow_br",
    name: "World Series BR",
    tags: ["BR", "3v3", "WSOW"],
    status: "Disponible",
    tone: "available",
  },
  {
    id: "rebirth",
    engineKey: "rebirth_ws",
    name: "Resurgence / Rebirth WS",
    tags: ["Rebirth", "Squad fijo", "WSOW-like"],
    status: "Disponible",
    tone: "available",
  },
  {
    id: "roulette",
    engineKey: "roulette_ws",
    name: "Gedeon Roulette WS",
    tags: ["Ruleta", "BR/Rebirth", "WSOW-like"],
    status: "Disponible",
    tone: "available",
  },
  {
    id: "kill-race",
    engineKey: "kill_race_bracket",
    name: "Kill Race",
    tags: ["Kills", "Single/Double", "Sin placement"],
    status: "Disponible",
    tone: "available",
  },
] as const satisfies ReadonlyArray<{
  id: string;
  engineKey: TournamentEngineKey;
  name: string;
  tags: readonly string[];
  status: string;
  tone: "available" | "experimental" | "soon";
}>;

const MOTOR_ICONS = [IconTrophy, IconTeams, IconDashboard, IconStandings];

type ArenaFilterId = "all" | "active" | "draft" | "bracket_ready" | "teams_ready";

const ARENA_FILTERS: ReadonlyArray<{ id: ArenaFilterId; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "active", label: "Activos" },
  { id: "draft", label: "Borrador" },
  { id: "bracket_ready", label: "Bracket listo" },
  { id: "teams_ready", label: "Equipos listos" },
];

export default function TorneosPage() {
  const router = useRouter();
  const {
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
    activeMatch,
    reportsLoaded,
    totalTeams,
    sortedStandings,
    canCreateNextGame,
    createEngineTournament,
    updateEngineTournament,
    archiveSelectedTournament,
    deleteSelectedTournament,
  } = useWorldSeriesPractice();

  const [tournamentName, setTournamentName] = useState("");
  const [tournamentGame, setTournamentGame] = useState("Warzone");
  const [selectedEngineKey, setSelectedEngineKey] =
    useState<TournamentEngineKey>("wsow_br");
  const [teamSize, setTeamSize] = useState<TeamSize>(3);
  const [lobbySize, setLobbySize] = useState("50");
  const [rouletteGameMode, setRouletteGameMode] = useState<"br" | "rebirth">("rebirth");
  const [matchPointPreset, setMatchPointPreset] = useState<"125" | "150" | "custom">("125");
  const [matchPointThreshold, setMatchPointThreshold] = useState("125");
  const [bestOf, setBestOf] = useState("3");
  const [killRaceStructure, setKillRaceStructure] =
    useState<TournamentStructure>("single_elim");
  const [showForm, setShowForm] = useState(false);
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
  const [motorsVisible, setMotorsVisible] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [arenaFilter, setArenaFilter] = useState<ArenaFilterId>("all");
  const [arenaSearch, setArenaSearch] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const motorsRef = useRef<HTMLElement>(null);
  const selectedPreset = ENGINE_PRESETS[selectedEngineKey];
  const isKillRace = selectedEngineKey === "kill_race_bracket";
  const formTitle = editingTournament ? "Editar torneo" : "Crear torneo";
  const motorSummary = {
    "Cómo se arma": selectedPreset.roster_policy === "roulette" ? "Ruleta" : "Squad fijo",
    "Vista final": selectedPreset.primaryView === "bracket" ? "Bracket" : "Standings",
    "Team size": `${teamSize} jugadores por equipo`,
    "Reglas clave": isKillRace
      ? "BO3 por kills, sin placement"
      : "Kills + placement, match point configurable",
  };

  useEffect(() => {
    const section = motorsRef.current;
    if (!section || typeof IntersectionObserver === "undefined") {
      setMotorsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setMotorsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.18 },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  const visibleTournaments = useMemo(() => {
    const searchTerm = arenaSearch.trim().toLocaleLowerCase();
    return tournaments.filter((tournament) => {
      const status = tournament.status.toLocaleLowerCase();
      const matchesFilter =
        arenaFilter === "all"
          ? true
          : arenaFilter === "active"
            ? status === "active" || status === "running" || status === "in_progress"
            : arenaFilter === "draft"
              ? status === "draft"
              : arenaFilter === "bracket_ready"
                ? status === "bracket_generated" || status === "bracket_ready"
                : status === "teams_generated";
      if (!matchesFilter) {
        return false;
      }
      if (!searchTerm) {
        return true;
      }
      return tournament.name.toLocaleLowerCase().includes(searchTerm);
    });
  }, [arenaFilter, arenaSearch, tournaments]);

  function selectEngine(engineKey: TournamentEngineKey) {
    const preset = ENGINE_PRESETS[engineKey];
    setSelectedEngineKey(engineKey);
    setTeamSize(preset.team_size);
    setLobbySize(preset.defaultLobbySize ? String(preset.defaultLobbySize) : "");
    setMatchPointPreset("125");
    setMatchPointThreshold(preset.defaultMatchPoint ? String(preset.defaultMatchPoint) : "");
    setBestOf(preset.bestOf ? String(preset.bestOf) : "3");
    setKillRaceStructure(preset.tournament_structure);
    setRouletteGameMode(preset.game_mode === "br" ? "br" : "rebirth");
  }

  function updateRouletteMode(mode: "br" | "rebirth") {
    setRouletteGameMode(mode);
    // Override de producto 2026-07-07: Gedeon opera con 3 tanto en BR como Rebirth.
    setTeamSize(3);
    setLobbySize(mode === "br" ? "50" : "16");
  }

  function updateMatchPointPreset(value: "125" | "150" | "custom") {
    setMatchPointPreset(value);
    if (value !== "custom") {
      setMatchPointThreshold(value);
    }
  }

  function revealTournamentForm(engineKey: TournamentEngineKey = selectedEngineKey) {
    setEditingTournament(null);
    selectEngine(engineKey);
    setShowForm(true);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function revealEditForm(tournament: Tournament) {
    const engine = resolveTournamentEngine(tournament);
    const preset = ENGINE_PRESETS[engine.engineKey];
    setEditingTournament(tournament);
    setSelectedEngineKey(engine.engineKey);
    setTournamentName(tournament.name);
    setTournamentGame(tournament.game || "Warzone");
    setTeamSize(engine.teamSize);
    setLobbySize(engine.config.lobbySize ? String(engine.config.lobbySize) : preset.defaultLobbySize ? String(preset.defaultLobbySize) : "");
    setRouletteGameMode(engine.gameMode === "br" ? "br" : "rebirth");
    const matchPoint = engine.matchPointThreshold ?? preset.defaultMatchPoint;
    setMatchPointThreshold(matchPoint ? String(matchPoint) : "");
    setMatchPointPreset(matchPoint === 150 ? "150" : matchPoint === 125 ? "125" : "custom");
    setBestOf(engine.bestOf ? String(engine.bestOf) : preset.bestOf ? String(preset.bestOf) : "3");
    setKillRaceStructure(engine.tournamentStructure);
    setShowForm(true);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  async function handleCreateTournament(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedLobbySize = Number(lobbySize);
    const parsedMatchPoint = Number(matchPointThreshold);
    const parsedBestOf = Number(bestOf);
    const gameMode =
      selectedEngineKey === "roulette_ws" ? rouletteGameMode : selectedPreset.game_mode;
    const payload = {
      name: tournamentName,
      game: tournamentGame,
      preset: selectedPreset,
      teamSize,
      lobbySize:
        !isKillRace && Number.isFinite(parsedLobbySize) && parsedLobbySize > 0
          ? parsedLobbySize
          : undefined,
      rosterPolicy: selectedPreset.roster_policy,
      tournamentStructure: isKillRace
        ? killRaceStructure
        : selectedPreset.tournament_structure,
      gameMode,
      bestOf: isKillRace && Number.isFinite(parsedBestOf) ? parsedBestOf : undefined,
      matchPointThreshold:
        !isKillRace && Number.isFinite(parsedMatchPoint) && parsedMatchPoint > 0
          ? parsedMatchPoint
          : undefined,
    };
    const saved = editingTournament
      ? await updateEngineTournament(editingTournament.id, payload)
      : await createEngineTournament(payload);
    if (saved) {
      setTournamentName("");
      setTournamentGame("Warzone");
      setEditingTournament(null);
      setShowForm(false);
      if (!editingTournament) {
        router.push(`/operator?tournamentId=${saved.id}`);
      }
    }
  }

  function toggleSelection(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAllVisible() {
    const visibleIds = visibleTournaments.map((t) => t.id);
    const allSelected = visibleIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleBulkArchive() {
    if (selectedIds.size === 0) return;
    const confirmed = window.confirm(
      `¿Archivar ${selectedIds.size} torneo(s)? No aparecerán en la lista activa.`
    );
    if (!confirmed) return;
    for (const id of selectedIds) {
      await archiveSelectedTournament(id);
    }
    clearSelection();
  }

  function handleBulkDeleteInit() {
    if (selectedIds.size === 0) return;
    setShowBulkDeleteConfirm(true);
  }

  async function handleBulkDeleteConfirm() {
    for (const id of selectedIds) {
      await deleteSelectedTournament(id);
    }
    setShowBulkDeleteConfirm(false);
    clearSelection();
  }

  function handleArchiveTournament(tournamentId: number) {
    const confirmed = window.confirm("¿Archivar este torneo? No aparecerá en la lista activa.");
    if (confirmed) {
      void archiveSelectedTournament(tournamentId);
    }
  }

  function handleDeleteTournament(tournamentId: number) {
    const confirmed = window.confirm("¿Eliminar este torneo? Esta acción no se puede deshacer.");
    if (confirmed) {
      void deleteSelectedTournament(tournamentId);
    }
  }

  return (
    <main className="bf-tournaments-page">
      {message ? <p className="bf-message">{message}</p> : null}

      {/* No duplicar el H1 en titulos internos. */}
      <section className="bf-tournaments-hero">
        <div>
          <span className="bf-dash-section-label">Arena activa</span>
          <h2>Próxima acción</h2>
          <p>Elige motor, crea torneo o vuelve al torneo seleccionado.</p>
        </div>
        <button
          type="button"
          className="bf-button bf-button-primary bf-button-hero"
          onClick={() => revealTournamentForm()}
        >
          + Nuevo torneo
        </button>
      </section>

      <section className="bf-hub-motors bf-tournaments-motors" ref={motorsRef}>
        <div className="bf-home-section-head">
          <span className="bf-hub-section-kicker">Entrada principal</span>
          <h3>Motores disponibles</h3>
        </div>
        <div className="bf-hub-motor-grid">
          {TOURNAMENT_MOTORS.map((motor, index) => {
            const Icon = MOTOR_ICONS[index];
            return (
              <article
                key={motor.id}
                className={`bf-hub-motor-card is-${motor.tone}${motorsVisible ? " is-visible" : ""}`}
                style={{ "--motor-i": index } as CSSProperties}
              >
                <div className="bf-hub-motor-head">
                  <span className="bf-hub-motor-icon">
                    <Icon size={21} />
                  </span>
                  <span className={`bf-hub-motor-status is-${motor.tone}`}>
                    {motor.status}
                  </span>
                </div>
                <strong className="bf-hub-motor-name">{motor.name}</strong>
                <ul className="bf-hub-motor-tags">
                  {motor.tags.map((tag) => (
                    <li key={tag}>{tag}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="bf-hub-motor-cta"
                  onClick={() => revealTournamentForm(motor.engineKey)}
                >
                  Usar este motor <span aria-hidden="true">-&gt;</span>
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="bf-tournaments-list bf-arena-board">
        <div className="bf-arena-board-head">
          <div className="bf-home-section-head">
            <span className="bf-hub-section-kicker">Arena</span>
            <h3>Arena Board</h3>
          </div>
          <span className="bf-arena-board-count">
            {visibleTournaments.length} de {tournaments.length} torneos
          </span>
        </div>
        <div className="bf-arena-board-controls">
          <div className="bf-arena-filters" role="tablist" aria-label="Filtro de torneos">
            {ARENA_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={`bf-arena-filter${arenaFilter === filter.id ? " is-active" : ""}`}
                onClick={() => setArenaFilter(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <label className="bf-arena-search">
            <span>Buscar torneo</span>
            <input
              type="search"
              value={arenaSearch}
              onChange={(event) => setArenaSearch(event.target.value)}
              placeholder="WS Practice..."
            />
          </label>
        </div>

        {selectedIds.size > 0 && (
          <div className="bf-bulk-bar">
            <div className="bf-bulk-info">
              <input
                type="checkbox"
                checked={
                  visibleTournaments.length > 0 &&
                  visibleTournaments.every((tournament) => selectedIds.has(tournament.id))
                }
                onChange={toggleSelectAllVisible}
                aria-label="Seleccionar todos los visibles"
              />
              <strong>{selectedIds.size} seleccionado(s)</strong>
            </div>
            <div className="bf-bulk-actions">
              <button
                type="button"
                className="bf-button bf-button-ghost"
                onClick={handleBulkArchive}
                disabled={submitting}
              >
                Archivar seleccionados
              </button>
              <button
                type="button"
                className="bf-button bf-button-danger"
                onClick={handleBulkDeleteInit}
                disabled={submitting}
              >
                Eliminar seleccionados
              </button>
              <button
                type="button"
                className="bf-button bf-button-ghost"
                onClick={clearSelection}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {showBulkDeleteConfirm && (
          <div className="bf-bulk-confirm">
            <div className="bf-bulk-confirm-panel">
              <strong>Borrar {selectedIds.size} torneo(s)</strong>
              <p>
                Se eliminarán torneos, equipos, matches, mapas y resultados asociados.
                Esta acción no se puede deshacer.
              </p>
              <div className="bf-hub-form-actions">
                <button
                  type="button"
                  className="bf-button bf-button-danger"
                  onClick={handleBulkDeleteConfirm}
                  disabled={submitting}
                >
                  Borrar {selectedIds.size} torneo(s)
                </button>
                <button
                  type="button"
                  className="bf-button bf-button-ghost"
                  onClick={() => setShowBulkDeleteConfirm(false)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <p className="bf-empty">Cargando torneos...</p>
        ) : visibleTournaments.length > 0 ? (
          <div className="bf-arena-board-grid">
            {visibleTournaments.map((tournament) => {
            const isSelected = tournament.id === selectedTournamentId;
            const engine = resolveTournamentEngine(tournament);
            const selectedMatchPointStatus = isSelected && engine.primaryView !== "bracket"
              ? getMatchPointStatus({
                  tournament,
                  threshold: engine.matchPointThreshold,
                  standings: sortedStandings,
                  teams,
                  matches,
                })
              : undefined;
            const pushModeAction = getOperatorNextAction({
              tournament,
              engine,
              backendOnline,
              teamsCount: isSelected ? totalTeams : undefined,
              participantsCount: isSelected ? players.length : undefined,
              matches: isSelected ? matches : undefined,
              activeMatch: isSelected ? activeMatch : undefined,
              reportsLoaded: isSelected ? reportsLoaded : undefined,
              totalTeams: isSelected ? totalTeams : undefined,
              matchPointStatus: selectedMatchPointStatus,
              canCreateNextMatch: isSelected ? canCreateNextGame : undefined,
            });
            const isChecked = selectedIds.has(tournament.id);
            const statusLabel = isSelected ? "Activo" : getTournamentStatusLabel(tournament.status);
            const engineSummary = `${engine.label} · ${engine.primaryView === "bracket" ? "Bracket" : "Standings"}`;
            const bracketMatches = isSelected
              ? matches.filter((match) => match.team_a_id !== null && match.team_b_id !== null)
              : [];
            const completedBracketMatches = isSelected
              ? bracketMatches.filter(
                  (match) => match.status === "completed" || match.winner_id !== null
                ).length
              : 0;
            const pendingReports = isSelected ? Math.max(totalTeams - reportsLoaded, 0) : 0;
            const progressMeta = !isSelected
              ? "Detalle operativo no cargado"
              : engine.primaryView === "standings" && activeMatch
                ? pendingReports > 0
                  ? `${pendingReports} pendiente(s)`
                  : "Partida lista para cierre"
                : "Operación estable";
            const champion = isSelected && engine.primaryView === "bracket"
              ? findChampion(matches, teams)
              : null;
            const leaderLabel = champion?.displayName
              ?? (isSelected && sortedStandings.length > 0
                ? sortedStandings[0].team_name
                : "Sin líder");
            const dashboardHref = `/dashboard?tournamentId=${tournament.id}`;
            const standingsHref = `/standings?tournamentId=${tournament.id}`;
            const isCompleted = pushModeAction.kind === "TOURNAMENT_COMPLETED";
            const operationalMetric = isCompleted
              ? "Finalizado · Ver resultado"
              : isSelected && engine.primaryView === "standings" && activeMatch && totalTeams > 0
                ? `${reportsLoaded}/${totalTeams} reportes · ${leaderLabel}`
                : isSelected && engine.primaryView === "bracket" && bracketMatches.length > 0
                  ? `Series ${completedBracketMatches}/${bracketMatches.length} · ${leaderLabel}`
                  : "Detalle operativo no cargado";
            return (
              <article
                key={tournament.id}
                className={`bf-hub-tournament-card bf-arena-row${isSelected ? " is-active" : ""}${isChecked ? " is-checked" : ""}`}
              >
                <div className="bf-arena-row-grid">
                  <div className="bf-arena-cell bf-arena-cell-selector">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSelection(tournament.id)}
                      aria-label={`Seleccionar ${tournament.name}`}
                    />
                  </div>
                  <div className="bf-arena-cell bf-arena-cell-tournament">
                    <strong className="bf-hub-tournament-name">{tournament.name}</strong>
                    <span className="bf-arena-cell-meta">{engineSummary}</span>
                  </div>
                  <div className="bf-arena-cell bf-arena-cell-signals">
                    <span className="bf-arena-status-chip">{statusLabel}</span>
                    <span className={`bf-push-chip is-${pushModeAction.tone}`}>
                      <span>Push</span>
                      <span className="bf-arena-push-label">{pushModeAction.label}</span>
                    </span>
                  </div>
                  <div className="bf-arena-cell bf-arena-cell-metric">
                    <strong className="bf-arena-cell-value">{operationalMetric}</strong>
                    {isSelected && !isCompleted ? (
                      <span className="bf-arena-cell-meta">{progressMeta}</span>
                    ) : null}
                  </div>
                  <div className="bf-arena-cell bf-arena-cell-actions">
                    <Link href={pushModeAction.href} className="bf-button bf-button-primary bf-arena-cta">
                      {pushModeAction.ctaLabel}
                    </Link>
                    <div className="bf-arena-quick-actions">
                      {pushModeAction.href !== dashboardHref ? (
                        <Link href={dashboardHref} className="bf-button bf-button-ghost bf-arena-quick">
                          Dashboard
                        </Link>
                      ) : null}
                      {pushModeAction.href !== standingsHref ? (
                        <Link href={standingsHref} className="bf-button bf-button-ghost bf-arena-quick">
                          Standings
                        </Link>
                      ) : null}
                    </div>
                    <details className="bf-arena-overflow">
                      <summary aria-label={`Más acciones para ${tournament.name}`}>
                        <span aria-hidden="true">⋮</span>
                      </summary>
                      <div className="bf-arena-overflow-menu">
                        {pushModeAction.href !== dashboardHref ? (
                          <Link href={dashboardHref} className="bf-arena-overflow-mobile-link">
                            Dashboard
                          </Link>
                        ) : null}
                        {pushModeAction.href !== standingsHref ? (
                          <Link href={standingsHref} className="bf-arena-overflow-mobile-link">
                            Standings
                          </Link>
                        ) : null}
                        <Link href={`/stream?tournamentId=${tournament.id}`}>Stream</Link>
                        <button type="button" onClick={() => revealEditForm(tournament)} disabled={submitting}>
                          Editar
                        </button>
                        <button type="button" onClick={() => handleArchiveTournament(tournament.id)} disabled={submitting}>
                          Archivar
                        </button>
                        <button
                          type="button"
                          className="is-danger"
                          onClick={() => handleDeleteTournament(tournament.id)}
                          disabled={submitting}
                        >
                          Eliminar
                        </button>
                      </div>
                    </details>
                  </div>
                </div>
              </article>
            );
          })}
          </div>
        ) : (
          <p className="bf-empty">
            {tournaments.length === 0
              ? "No hay torneos creados. Abre Nuevo torneo para elegir formato competitivo."
              : "No hay torneos para ese filtro o búsqueda."}
          </p>
        )}
      </section>

      {showForm ? (
        <section className="bf-tournaments-create">
          <div>
            <span className="bf-dash-section-label">{editingTournament ? "Edición" : "Nuevo torneo"}</span>
            <h3>{formTitle}</h3>
            <p>
              Motor: <strong>{selectedPreset.label}</strong>{" "}
              {!editingTournament ? (
                <button
                  type="button"
                  className="bf-hub-motor-cta"
                  onClick={() => setShowForm(false)}
                >
                  Cambiar motor
                </button>
              ) : (
                <span>Los campos estructurales quedan protegidos si ya existen resultados.</span>
              )}
            </p>
            <dl className="bf-engine-summary">
              {Object.entries(motorSummary).map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <form className="bf-hub-form" onSubmit={handleCreateTournament} ref={formRef}>
            <label className="bf-field">
              <span>Nombre del torneo</span>
              <input
                value={tournamentName}
                onChange={(event) => setTournamentName(event.target.value)}
                placeholder="WS Practice LATAM"
                required
                autoFocus
              />
            </label>
            {isKillRace ? (
              <>
                <label className="bf-field">
                  <span>Modalidad</span>
                  <select
                    value={teamSize}
                    onChange={(event) => setTeamSize(Number(event.target.value) as TeamSize)}
                  >
                    <option value={1}>1v1</option>
                    <option value={2}>2v2</option>
                    <option value={3}>3v3</option>
                  </select>
                </label>
                <label className="bf-field">
                  <span>Bracket type</span>
                  <select
                    value={killRaceStructure}
                    onChange={(event) =>
                      setKillRaceStructure(event.target.value as TournamentStructure)
                    }
                  >
                    <option value="single_elim">Single elim</option>
                    <option value="double_elim">Double elim</option>
                  </select>
                </label>
                <label className="bf-field">
                  <span>Best of</span>
                  <input
                    type="number"
                    min={3}
                    step={2}
                    value={bestOf}
                    onChange={(event) => setBestOf(event.target.value)}
                    required
                  />
                </label>
                <p className="bf-empty">
                  La ruleta armará equipos y luego se generará la llave. Placement NO aplica.
                </p>
              </>
            ) : (
              <>
                {selectedEngineKey === "roulette_ws" ? (
                  <label className="bf-field">
                    <span>Game mode</span>
                    <select
                      value={rouletteGameMode}
                      onChange={(event) => updateRouletteMode(event.target.value as "br" | "rebirth")}
                    >
                      <option value="rebirth">Rebirth</option>
                      <option value="br">BR</option>
                    </select>
                  </label>
                ) : null}
                <div className="bf-field">
                  <span>Team size</span>
                  <strong>{teamSize} jugadores por equipo</strong>
                </div>
                <label className="bf-field">
                  <span>Lobby size</span>
                  {selectedEngineKey === "rebirth_ws" ? (
                    <select
                      value={lobbySize}
                      onChange={(event) => setLobbySize(event.target.value)}
                    >
                      <option value="16">16</option>
                      <option value="17">17</option>
                    </select>
                  ) : (
                    <input
                      type="number"
                      min={1}
                      value={lobbySize}
                      onChange={(event) => setLobbySize(event.target.value)}
                      required
                    />
                  )}
                </label>
                <p className="bf-empty">
                  Placement se valida contra lobby size, no contra equipos registrados.
                </p>
                <label className="bf-field">
                  <span>Match point</span>
                  <select
                    value={matchPointPreset}
                    onChange={(event) =>
                      updateMatchPointPreset(event.target.value as "125" | "150" | "custom")
                    }
                  >
                    <option value="125">125</option>
                    <option value="150">150</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>
                <label className="bf-field">
                  <span>Match point threshold</span>
                  <input
                    type="number"
                    min={1}
                    value={matchPointThreshold}
                    onChange={(event) => {
                      setMatchPointThreshold(event.target.value);
                      setMatchPointPreset("custom");
                    }}
                    required
                  />
                </label>
                {selectedEngineKey === "roulette_ws" ? (
                  <p className="bf-empty">La ruleta armará equipos antes de operar.</p>
                ) : null}
              </>
            )}
            <div className="bf-hub-form-actions">
              <button
                type="submit"
                className="bf-button bf-button-primary bf-button-hero"
                disabled={submitting}
              >
                {submitting ? "Guardando..." : editingTournament ? "Guardar cambios" : "Crear torneo"}
              </button>
              <button
                type="button"
                className="bf-button bf-button-ghost"
                onClick={() => {
                  setShowForm(false);
                  setEditingTournament(null);
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {selectedTournament && tournaments.length === 0 ? (
        <p className="bf-empty">{selectedTournament.name}</p>
      ) : null}
    </main>
  );
}
