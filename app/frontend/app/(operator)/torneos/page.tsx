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
  type RosterPolicy,
  type TeamSize,
} from "../../../lib/tournamentModel";

const TOURNAMENT_MOTORS = [
  {
    id: "world-series",
    engineKey: "wsow_classic",
    name: "World Series Clasico",
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
    name: "Gedeon Style / Roulette WS",
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
  } = useWorldSeriesPractice();

  const [tournamentName, setTournamentName] = useState("");
  const [tournamentGame, setTournamentGame] = useState("Warzone");
  const [selectedEngineKey, setSelectedEngineKey] =
    useState<TournamentEngineKey>("wsow_classic");
  const [teamSize, setTeamSize] = useState<TeamSize>(2);
  const [lobbySize, setLobbySize] = useState("150");
  const [killRaceStructure, setKillRaceStructure] =
    useState<TournamentStructure>("single_elim");
  const [killRaceRoster, setKillRaceRoster] = useState<RosterPolicy>("fixed_squad");
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
    setKillRaceStructure(preset.tournament_structure);
    setKillRaceRoster(preset.roster_policy);
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
    const created = await createEngineTournament({
      name: tournamentName,
      game: tournamentGame,
      preset: selectedPreset,
      teamSize,
      lobbySize:
        !isKillRace && Number.isFinite(parsedLobbySize) && parsedLobbySize > 0
          ? parsedLobbySize
          : undefined,
      rosterPolicy: isKillRace ? killRaceRoster : selectedPreset.roster_policy,
      tournamentStructure: isKillRace
        ? killRaceStructure
        : selectedPreset.tournament_structure,
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
                  <span>Estructura</span>
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
                  <span>Roster</span>
                  <select
                    value={killRaceRoster}
                    onChange={(event) =>
                      setKillRaceRoster(event.target.value as RosterPolicy)
                    }
                  >
                    <option value="fixed_squad">Fijo</option>
                    <option value="roulette">Ruleta</option>
                  </select>
                </label>
                <p className="bf-empty">Gana quien sume más kills. Placement no aplica.</p>
              </>
            ) : (
              <>
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
