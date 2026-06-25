"use client";

import Link from "next/link";
import { CSSProperties, FormEvent, useEffect, useRef, useState } from "react";

import AppTopbar from "./components/AppTopbar";
import DashboardParticles from "./components/DashboardParticles";
import { IconBell, IconStandings, IconStream, IconTeams, IconTrophy } from "./components/icons";
import { useWorldSeriesPractice } from "./lib/useWorldSeriesPractice";

const MOTORS = [
  {
    id: "ws-classic",
    name: "World Series Clásico",
    tags: ["BR", "WSOW", "Squad fijo", "Acumulativo"],
    status: "Disponible",
    tone: "available",
  },
  {
    id: "resurgence-ws",
    name: "Resurgence / Rebirth WS",
    tags: ["Rebirth", "WSOW", "Squad fijo", "Acumulativo"],
    status: "Experimental",
    tone: "experimental",
  },
  {
    id: "gedeon-style",
    name: "Gedeon Style / Roulette WS",
    tags: ["Rebirth", "WSOW", "Ruleta", "Acumulativo"],
    status: "Experimental",
    tone: "experimental",
  },
  {
    id: "challonge",
    name: "Challonge Competitivo",
    tags: ["Kill Race", "Ruleta/Squad", "Single/Double Elim"],
    status: "Próximamente",
    tone: "soon",
  },
] as const;

const MOTOR_ICONS = [IconTrophy, IconTeams, IconStandings, IconStream];

const TOOLS = [
  {
    id: "discord",
    name: "Discord Bot",
    sub: "Resultados y alertas en tiempo real",
    href: null,
    status: "Próximamente",
    Icon: IconBell,
  },
  {
    id: "overlay",
    name: "Overlay OBS",
    sub: "Overlays oficiales listos para usar",
    href: "/stream",
    status: "Disponible",
    Icon: IconStream,
  },
  {
    id: "caster",
    name: "Caster Center",
    sub: "Recursos para casters",
    href: null,
    status: "Próximamente",
    Icon: IconTeams,
  },
] as const;

export default function Home() {
  const {
    backendOnline,
    loading,
    submitting,
    message,
    tournaments,
    selectedTournamentId,
    selectedTournament,
    currentGameNumber,
    reportsLoaded,
    totalTeams,
    createWorldSeriesTournament,
  } = useWorldSeriesPractice();

  const [tournamentName, setTournamentName] = useState("");
  const [tournamentGame, setTournamentGame] = useState("Warzone");
  const [showForm, setShowForm] = useState(false);
  const [motorsVisible, setMotorsVisible] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
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
    }
  }

  const hasActiveTournament = !loading && tournaments.length > 0;

  function scrollToMotors() {
    document.getElementById("hub-motors")?.scrollIntoView({ behavior: "smooth" });
  }

  function revealTournamentForm() {
    setShowForm(true);
    requestAnimationFrame(() => {
      heroRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  return (
    <main className="bf-page bf-hub-page">
      {/* ---- Fondo Arena OS ---- */}
      <div className="bf-hub-arena" aria-hidden="true">
        <div className="bf-hub-arena-h1" />
        <div className="bf-hub-arena-h2" />
        <div className="bf-hub-arena-h3" />
        <div className="bf-hub-arena-particles">
          <DashboardParticles count={28} speed={0.5} />
        </div>
      </div>

      <AppTopbar
        title="BracketFlow"
        subtitle="Tournament Operating System"
        showBackendStatus
        backendOnline={backendOnline}
      />

      {message ? <p className="bf-message">{message}</p> : null}

      {/* ---- Hero ---- */}
      <section className="bf-hub-hero" ref={heroRef}>
        <div className="bf-hub-command">
          <div className="bf-hub-command-head">
            <div>
              <span className="bf-hub-eyebrow">Arena Control</span>
              <h2 className="bf-hub-title">Command Deck</h2>
            </div>
            <span className={`bf-hub-command-state${selectedTournament ? " is-live" : ""}`}>
              <i className="bf-op-dot" />
              {selectedTournament ? "Operativo" : "En espera"}
            </span>
          </div>

          <p className="bf-hub-sub">
            Del lobby al leaderboard: resultados, standings y stream en un solo flujo.
          </p>

          <div className="bf-hub-command-grid">
            <div className="bf-hub-command-stat is-tournament">
              <span>Torneo activo</span>
              <strong>{selectedTournament?.name ?? "Sin práctica activa"}</strong>
              <small>{selectedTournament?.game ?? "Crea una práctica para comenzar"}</small>
            </div>
            <div className="bf-hub-command-stat">
              <span>Game actual</span>
              <strong>{currentGameNumber > 0 ? `#${currentGameNumber}` : "—"}</strong>
              <small>{currentGameNumber > 0 ? "Ronda en operación" : "Sin game abierto"}</small>
            </div>
            <div className="bf-hub-command-stat">
              <span>Reportes cargados</span>
              <strong>
                {selectedTournament ? `${reportsLoaded}/${totalTeams}` : "—"}
              </strong>
              <small>{selectedTournament ? "Equipos reportados" : "Sin actividad"}</small>
            </div>
          </div>
        </div>

        <div className="bf-hub-hero-cta">
          {!showForm ? (
            <>
              <button
                type="button"
                className="bf-button bf-button-primary bf-button-hero"
                onClick={revealTournamentForm}
              >
                Crear práctica
              </button>
              {hasActiveTournament ? (
                <Link
                  href={`/dashboard${selectedTournamentId ? `?tournamentId=${selectedTournamentId}` : ""}`}
                  className="bf-button bf-button-ghost bf-button-hero"
                >
                  Continuar torneo
                </Link>
              ) : null}
              <button
                type="button"
                className="bf-button bf-button-ghost"
                onClick={scrollToMotors}
              >
                Explorar motores
              </button>
            </>
          ) : (
            <form className="bf-hub-form" onSubmit={handleCreateTournament}>
              <label className="bf-field">
                <span>Nombre del torneo</span>
                <input
                  value={tournamentName}
                  onChange={(e) => setTournamentName(e.target.value)}
                  placeholder="WS Practice LATAM"
                  required
                  autoFocus
                />
              </label>
              <label className="bf-field">
                <span>Juego</span>
                <input
                  value={tournamentGame}
                  onChange={(e) => setTournamentGame(e.target.value)}
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
                  {submitting ? "Creando…" : "Crear torneo"}
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
          )}
        </div>
      </section>

      {/* ---- Prácticas en curso ---- */}
      {loading || tournaments.length > 0 ? (
        <section className="bf-hub-active">
          <span className="bf-hub-section-kicker">Prácticas en curso</span>
          {loading ? (
            <p className="bf-empty">Cargando torneos…</p>
          ) : (
            <div className="bf-hub-tournament-list">
              {tournaments.map((tournament) => (
                <article key={tournament.id} className="bf-hub-tournament-card">
                  <div className="bf-hub-tournament-info">
                    <strong className="bf-hub-tournament-name">{tournament.name}</strong>
                    <span className="bf-hub-tournament-meta">
                      <span className="bf-hub-tournament-game">{tournament.game}</span>
                      <span className="bf-hub-tournament-status">{tournament.status}</span>
                    </span>
                  </div>
                  <div className="bf-hub-tournament-actions">
                    <Link
                      href={`/operator?tournamentId=${tournament.id}`}
                      className="bf-button bf-button-primary"
                    >
                      Operator
                    </Link>
                    <Link
                      href={`/standings?tournamentId=${tournament.id}`}
                      className="bf-button bf-button-ghost"
                    >
                      Standings
                    </Link>
                    <Link
                      href={`/stream?tournamentId=${tournament.id}`}
                      className="bf-button bf-button-ghost"
                    >
                      Stream
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {/* ---- 4 Motores de torneo ---- */}
      <section className="bf-hub-motors" id="hub-motors" ref={motorsRef}>
        <span className="bf-hub-section-kicker">Motores de torneo</span>
        <div className="bf-hub-motor-grid">
          {MOTORS.map((motor, i) => {
            const Icon = MOTOR_ICONS[i];
            return (
              <article
                key={motor.id}
                className={`bf-hub-motor-card is-${motor.tone}${motorsVisible ? " is-visible" : ""}`}
                style={{ "--motor-i": i } as CSSProperties}
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
                  Seleccionar motor <span aria-hidden="true">→</span>
                </button>
              </article>
            );
          })}
        </div>
      </section>

      {/* ---- Herramientas esenciales ---- */}
      <section className="bf-hub-tools">
        <div className="bf-hub-tools-head">
          <span className="bf-hub-section-kicker">Ecosistema próximo</span>
          <p>Módulos que expanden la operación sin salir del torneo.</p>
        </div>
        <div className="bf-hub-tool-row">
          {TOOLS.map(({ id, name, sub, href, status, Icon }) => {
            const content = (
              <>
                <span className="bf-hub-tool-icon">
                  <Icon size={18} />
                </span>
                <span className="bf-hub-tool-copy">
                  <strong className="bf-hub-tool-name">{name}</strong>
                  <span className="bf-hub-tool-sub">{sub}</span>
                </span>
                <span
                  className={`bf-hub-tool-state${status === "Disponible" ? " is-available" : ""}`}
                >
                  {status}
                </span>
              </>
            );

            return href ? (
              <Link key={id} href={href} className="bf-hub-tool-item">
                {content}
              </Link>
            ) : (
              <div key={id} className="bf-hub-tool-item is-placeholder">
                {content}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
