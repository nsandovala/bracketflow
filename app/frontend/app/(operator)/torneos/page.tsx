"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CSSProperties, FormEvent, useEffect, useRef, useState } from "react";

import { IconDashboard, IconStandings, IconTeams, IconTrophy } from "../../components/icons";
import { useWorldSeriesPractice } from "../../lib/useWorldSeriesPractice";

const TOURNAMENT_MOTORS = [
  {
    id: "world-series",
    name: "World Series",
    tags: ["BR", "WSOW", "Acumulativo"],
    status: "Disponible",
    tone: "available",
  },
  {
    id: "rebirth",
    name: "Rebirth",
    tags: ["Rebirth", "Squad fijo", "Experimental"],
    status: "Experimental",
    tone: "experimental",
  },
  {
    id: "roulette",
    name: "Roulette",
    tags: ["Ruleta", "Broadcast", "Experimental"],
    status: "Experimental",
    tone: "experimental",
  },
  {
    id: "kill-race",
    name: "Kill Race",
    tags: ["Challonge", "Bracket", "Próximamente"],
    status: "Próximamente",
    tone: "soon",
  },
] as const;

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
    createWorldSeriesTournament,
  } = useWorldSeriesPractice();

  const [tournamentName, setTournamentName] = useState("");
  const [tournamentGame, setTournamentGame] = useState("Warzone");
  const [showForm, setShowForm] = useState(false);
  const [motorsVisible, setMotorsVisible] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const motorsRef = useRef<HTMLElement>(null);

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

  function revealTournamentForm() {
    setShowForm(true);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  async function handleCreateTournament(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const created = await createWorldSeriesTournament({
      name: tournamentName,
      game: tournamentGame,
    });
    if (created) {
      setTournamentName("");
      setTournamentGame("Warzone");
      setShowForm(false);
      router.push(`/dashboard?tournamentId=${created.id}`);
    }
  }

  function handleSelectTournament(tournamentId: number) {
    selectTournament(tournamentId);
    router.push(`/dashboard?tournamentId=${tournamentId}`);
  }

  return (
    <main className="bf-tournaments-page">
      {message ? <p className="bf-message">{message}</p> : null}

      <section className="bf-tournaments-hero">
        <div>
          <span className="bf-dash-section-label">Hub operativo</span>
          <h2>Mis torneos</h2>
          <p>Lista, selección y creación viven acá. El cockpit queda para operar el torneo activo.</p>
        </div>
        <button
          type="button"
          className="bf-button bf-button-primary bf-button-hero"
          onClick={revealTournamentForm}
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
                    Seleccionar
                  </button>
                  <Link href={`/dashboard?tournamentId=${tournament.id}`} className="bf-button bf-button-ghost">
                    Dashboard
                  </Link>
                </div>
              </article>
            );
          })
        ) : (
          <p className="bf-empty">
            No hay torneos creados. Abre Nuevo torneo para iniciar una práctica World Series.
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
                  onClick={revealTournamentForm}
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
            <h3>Crear práctica World Series</h3>
            <p>El submit usa el mismo flujo existente del hub, sin endpoints nuevos.</p>
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
            <label className="bf-field">
              <span>Juego</span>
              <input
                value={tournamentGame}
                onChange={(event) => setTournamentGame(event.target.value)}
                placeholder="Warzone"
                required
              />
            </label>
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
