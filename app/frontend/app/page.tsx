"use client";

import Link from "next/link";
import { CSSProperties, useEffect, useRef, useState } from "react";

import AppTopbar from "./components/AppTopbar";
import DashboardParticles from "./components/DashboardParticles";
import { IconStandings, IconStream, IconTeams, IconTrophy } from "./components/icons";
import { useWorldSeriesPractice } from "./lib/useWorldSeriesPractice";

const PRODUCT_MOTORS = [
  {
    id: "world-series",
    name: "World Series",
    copy: "Formato acumulativo para Battle Royale con clasificación clara durante toda la transmisión.",
    tags: ["BR", "WSOW", "Acumulativo"],
    status: "Disponible",
    tone: "available",
  },
  {
    id: "rebirth",
    name: "Rebirth",
    copy: "Operación compacta para torneos rápidos con ritmo de lobby y lectura simple para casters.",
    tags: ["Rebirth", "Squad fijo", "Live ops"],
    status: "Experimental",
    tone: "experimental",
  },
  {
    id: "roulette",
    name: "Roulette",
    copy: "Cards visuales para formatos con ruleta sin depender de herramientas genéricas fuera del torneo.",
    tags: ["Ruleta", "Reglas visuales", "Broadcast"],
    status: "Experimental",
    tone: "experimental",
  },
  {
    id: "kill-race",
    name: "Kill Race",
    copy: "Base competitiva para brackets y carreras de kills con foco en seguimiento operativo.",
    tags: ["Kill Race", "Bracket", "Challonge"],
    status: "Próximamente",
    tone: "soon",
  },
] as const;

const MOTOR_ICONS = [IconTrophy, IconTeams, IconStandings, IconStream];

const PITCH_POINTS = [
  "No más Excel para corregir standings durante el vivo.",
  "No más Google Sheets como consola de producción.",
  "No más ruletas genéricas desconectadas del torneo.",
  "No más overlays armados a mano antes de cada fecha.",
] as const;

export default function Home() {
  const { backendOnline, loading, tournaments, selectedTournamentId } = useWorldSeriesPractice();
  const [motorsVisible, setMotorsVisible] = useState(false);
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

  const hasActiveTournament = !loading && tournaments.length > 0;
  const dashboardHref = `/dashboard${selectedTournamentId ? `?tournamentId=${selectedTournamentId}` : ""}`;

  return (
    <main className="bf-page bf-hub-page bf-home-v2">
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

      <section className="bf-home-hero-v2">
        <span className="bf-hub-eyebrow">Broadcast-first tournament ops</span>
        <h2>BRACKETFLOW</h2>
        <p className="bf-home-deck">Tournament Operating System</p>
        <p className="bf-home-value">
          Cada clic debe acercarte al torneo, nunca al software.
        </p>

        <div className="bf-home-primary-actions">
          <Link href="/torneos" className="bf-button bf-button-primary bf-button-hero">
            Crear torneo
          </Link>
          {hasActiveTournament ? (
            <Link href={dashboardHref} className="bf-button bf-button-ghost bf-button-hero">
              Continuar torneo
            </Link>
          ) : null}
        </div>

        <nav className="bf-home-secondary-actions" aria-label="Recursos">
          <a href="#">Documentación</a>
          <a href="#">Discord</a>
          <a href="#">GitHub</a>
          <a href="#">Demo</a>
        </nav>
      </section>

      <section className="bf-hub-motors" ref={motorsRef}>
        <div className="bf-home-section-head">
          <span className="bf-hub-section-kicker">Casos de uso</span>
          <h3>Cuatro motores, una operación</h3>
        </div>
        <div className="bf-hub-motor-grid">
          {PRODUCT_MOTORS.map((motor, index) => {
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
                <p className="bf-home-motor-copy">{motor.copy}</p>
                <ul className="bf-hub-motor-tags">
                  {motor.tags.map((tag) => (
                    <li key={tag}>{tag}</li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </section>

      <section className="bf-home-pitch">
        <div className="bf-home-section-head">
          <span className="bf-hub-section-kicker">Por qué BracketFlow</span>
          <h3>Menos herramientas sueltas, más torneo en pantalla</h3>
        </div>
        <div className="bf-home-pitch-grid">
          {PITCH_POINTS.map((point) => (
            <article key={point} className="bf-home-pitch-card">
              {point}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
