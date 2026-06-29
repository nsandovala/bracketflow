"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CSSProperties, FormEvent, useEffect, useRef, useState } from "react";

import { IconDashboard, IconStandings, IconTeams, IconTrophy } from "../../components/icons";
import { useWorldSeriesPractice } from "../../lib/useWorldSeriesPractice";
import {
  ENGINE_PRESETS,
  type TournamentEngineKey,
  type TournamentStructure,
  type TeamSize,
} from "../../../lib/tournamentModel";

const TOURNAMENT_MOTORS = [
  {
    id: "world-series",
    engineKey: "wsow_br",
    name: "World Series BR",
    tags: ["BR", "WSOW", "Acumulativo"],
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
    tags: ["Ruleta", "Rebirth", "WSOW-like"],
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

export default function TorneosPage() {
  const router = useRouter();
  const {
    loading,
    submitting,
    message,
    tournaments,
    selectedTournamentId,
    selectedTournament,
    selectTournament,
    createEngineTournament,
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
  const [motorsVisible, setMotorsVisible] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const motorsRef = useRef<HTMLElement>(null);
  const selectedPreset = ENGINE_PRESETS[selectedEngineKey];
  const isKillRace = selectedEngineKey === "kill_race_bracket";

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
    setTeamSize(mode === "br" ? 4 : 3);
    setLobbySize(mode === "br" ? "50" : "16");
  }

  function updateMatchPointPreset(value: "125" | "150" | "custom") {
    setMatchPointPreset(value);
    if (value !== "custom") {
      setMatchPointThreshold(value);
    }
  }

  function revealTournamentForm(engineKey: TournamentEngineKey = selectedEngineKey) {
    selectEngine(engineKey);
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
    const created = await createEngineTournament({
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
    });
    if (created) {
      setTournamentName("");
      setTournamentGame("Warzone");
      setShowForm(false);
      router.push(`/operator?tournamentId=${created.id}`);
    }
  }

  function handleSelectTournament(tournamentId: number) {
    selectTournament(tournamentId);
    router.push(`/operator?tournamentId=${tournamentId}`);
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

      <section className="bf-tournaments-hero">
        <div>
          <span className="bf-dash-section-label">Hub operativo</span>
          <h2>Torneos</h2>
          <p>Crea, selecciona y opera torneos desde un solo lugar.</p>
        </div>
        <button
          type="button"
          className="bf-button bf-button-primary bf-button-hero"
          onClick={() => revealTournamentForm()}
        >
          + Nuevo torneo
        </button>
      </section>

      <section className="bf-tournaments-list">
        {loading ? (
          <p className="bf-empty">Cargando torneos...</p>
        ) : tournaments.length > 0 ? (
          tournaments.map((tournament) => {
            const isSelected = tournament.id === selectedTournamentId;
            return (
              <article
                key={tournament.id}
                className={`bf-hub-tournament-card${isSelected ? " is-active" : ""}`}
              >
                <div className="bf-hub-tournament-info">
                  <strong className="bf-hub-tournament-name">{tournament.name}</strong>
                  <span className="bf-hub-tournament-meta">
                    <span className="bf-hub-tournament-game">{tournament.game}</span>
                    <span className="bf-hub-tournament-status">
                      {isSelected ? "Activo" : tournament.status}
                    </span>
                  </span>
                </div>
                <div className="bf-hub-tournament-actions">
                  <button
                    type="button"
                    className="bf-button bf-button-primary"
                    onClick={() => handleSelectTournament(tournament.id)}
                  >
                    Operar
                  </button>
                  <Link href={`/dashboard?tournamentId=${tournament.id}`} className="bf-button bf-button-ghost">
                    Dashboard
                  </Link>
                  <Link href={`/standings?tournamentId=${tournament.id}`} className="bf-button bf-button-ghost">
                    Standings
                  </Link>
                  <Link href={`/stream?tournamentId=${tournament.id}`} className="bf-button bf-button-ghost">
                    Stream
                  </Link>
                  <button
                    type="button"
                    className="bf-button bf-button-ghost"
                    onClick={() => handleArchiveTournament(tournament.id)}
                    disabled={submitting}
                  >
                    Archivar
                  </button>
                  <button
                    type="button"
                    className="bf-button bf-button-danger"
                    onClick={() => handleDeleteTournament(tournament.id)}
                    disabled={submitting}
                  >
                    Eliminar
                  </button>
                </div>
              </article>
            );
          })
        ) : (
          <p className="bf-empty">
            No hay torneos creados. Abre Nuevo torneo para elegir formato competitivo.
          </p>
        )}
      </section>

      <section className="bf-hub-motors bf-tournaments-motors" ref={motorsRef}>
        <div className="bf-home-section-head">
          <span className="bf-hub-section-kicker">Selector visual</span>
          <h3>Motores de torneo</h3>
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

      {showForm ? (
        <section className="bf-tournaments-create">
          <div>
            <span className="bf-dash-section-label">Nuevo torneo</span>
            <h3>Nuevo torneo</h3>
            <p>Elige el formato competitivo y luego completa los detalles.</p>
          </div>
          <form className="bf-hub-form" onSubmit={handleCreateTournament} ref={formRef}>
            <div className="bf-field">
              <span>Elige el formato competitivo</span>
              <div className="bf-hub-format-chips">
                {TOURNAMENT_MOTORS.map((motor) => (
                  <button
                    key={motor.engineKey}
                    type="button"
                    className={`bf-hub-format-chip${
                      selectedEngineKey === motor.engineKey ? " is-active" : ""
                    }`}
                    onClick={() => selectEngine(motor.engineKey)}
                  >
                    {motor.name}
                  </button>
                ))}
              </div>
            </div>
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
            <label className="bf-field">
              <span>Juego</span>
              <input
                value={tournamentGame}
                onChange={(event) => setTournamentGame(event.target.value)}
                placeholder="Warzone"
                required
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
                    min={1}
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
                <label className="bf-field">
                  <span>Team size</span>
                  <select
                    value={teamSize}
                    onChange={(event) => setTeamSize(Number(event.target.value) as TeamSize)}
                  >
                    <option value={2}>2v2</option>
                    <option value={3}>3v3</option>
                    <option value={4}>4v4</option>
                  </select>
                </label>
                <label className="bf-field">
                  <span>Lobby size</span>
                  <input
                    type="number"
                    min={1}
                    value={lobbySize}
                    onChange={(event) => setLobbySize(event.target.value)}
                    required
                  />
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
                {submitting ? "Creando..." : "Crear torneo"}
              </button>
              <button
                type="button"
                className="bf-button bf-button-ghost"
                onClick={() => setShowForm(false)}
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
