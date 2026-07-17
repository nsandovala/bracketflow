"use client";

import Link from "next/link";
import { CSSProperties, useEffect, useRef, useState } from "react";

import AppTopbar from "./components/AppTopbar";
import GedeonHeroFX from "./components/GedeonHeroFX";
import { useWorldSeriesPractice } from "./lib/useWorldSeriesPractice";

type CapabilityId = "dashboard" | "standings" | "casters" | "experience";

type Capability = {
  id: CapabilityId;
  title: string;
  copy: string;
  cta: string;
  href: string;
  live?: boolean;
};

type ArenaMovement = {
  eyebrow: string;
  title: string;
  copy: string;
  points: string[];
  cta: string;
  href: string;
};

const CAPABILITIES: Capability[] = [
  {
    id: "dashboard",
    title: "Dashboard Operativo",
    copy: "Control central del torneo con contexto claro y acciones rápidas.",
    cta: "Ver Dashboard",
    href: "/dashboard",
  },
  {
    id: "standings",
    title: "Standings en Vivo",
    copy: "Kills, posiciones y avance del torneo en tiempo real.",
    cta: "Ver Standings",
    href: "/standings",
    live: true,
  },
  {
    id: "casters",
    title: "Stream para Broadcast",
    copy: "Una vista clara del torneo para transmisión, staff y comunidad.",
    cta: "Ver Stream",
    href: "/stream",
  },
  {
    id: "experience",
    title: "Experiencia Optimizada",
    copy: "Velocidad, orden y estabilidad para la arena competitiva.",
    cta: "Saber Más",
    href: "#bf-home-story",
  },
];

const ARENA_MOVEMENTS: ArenaMovement[] = [
  {
    eyebrow: "01",
    title: "CREA LA ARENA",
    copy: "Configura motor, equipos y reglas en una sola superficie antes de abrir la competencia.",
    points: ["World Series BR", "Rebirth WS", "Gedeon Roulette", "Kill Race"],
    cta: "Configurar torneo",
    href: "/torneos",
  },
  {
    eyebrow: "02",
    title: "OPERA EN VIVO",
    copy: "Carga resultados, valida el estado y sigue la próxima acción sin perder el control del torneo.",
    points: ["Reportes manual-first", "Push Mode", "Estado compartido", "OCR como próxima capa"],
    cta: "Abrir cockpit",
    href: "/operator",
  },
  {
    eyebrow: "03",
    title: "MUESTRA EL TORNEO",
    copy: "Standings y stream mantienen a staff, caster y comunidad mirando el mismo estado competitivo.",
    points: ["Standings", "Stream overlay", "Lectura para caster", "Señal para comunidad"],
    cta: "Ver Stream",
    href: "/stream",
  },
];

const AVAILABLE_TODAY = ["Motores base", "Dashboard operativo", "Operator manual-first", "Push Mode", "Standings", "Stream View"];
const NEXT_LAYER = ["OCR Draft Intake", "Discord Bot", "Caster Console", "HEO Copilot / agentes", "OGL/WebGL premium"];

function CapabilityIcon({ id }: { id: CapabilityId }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {id === "dashboard" ? (
        <>
          <rect x="3" y="3" width="8" height="10" rx="1.5" />
          <rect x="13" y="3" width="8" height="6" rx="1.5" />
          <rect x="13" y="11" width="8" height="10" rx="1.5" />
          <rect x="3" y="15" width="8" height="6" rx="1.5" />
        </>
      ) : null}
      {id === "standings" ? (
        <>
          <path d="M4 20V12" />
          <path d="M10 20V6" />
          <path d="M16 20V9" />
          <path d="M2 20h20" />
        </>
      ) : null}
      {id === "casters" ? (
        <>
          <path d="M4 13a8 8 0 0 1 16 0" />
          <rect x="2" y="13" width="5" height="7" rx="2" />
          <rect x="17" y="13" width="5" height="7" rx="2" />
        </>
      ) : null}
      {id === "experience" ? (
        <>
          <path d="M12 4A8.5 8.5 0 1 0 20.5 12.5" />
          <path d="M12 12.5 17.5 7" />
          <circle cx="12" cy="12.5" r="1.4" fill="currentColor" stroke="none" />
        </>
      ) : null}
    </svg>
  );
}

export default function Home() {
  const { backendOnline, loading, tournaments, selectedTournamentId } = useWorldSeriesPractice();
  const [cardsVisible, setCardsVisible] = useState(false);
  const cardsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = cardsRef.current;
    if (!section || typeof IntersectionObserver === "undefined") {
      setCardsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setCardsVisible(true);
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
      </div>
      <AppTopbar
        title="BracketFlow"
        subtitle="Tournament Operating System"
        showBackendStatus
        backendOnline={backendOnline}
      />

      <section className="bf-home-hero-v2 bf-home-arena-hero">
        <div className="bf-home-hero-bg" aria-hidden="true" />
        <div className="bf-home-hero-dust" aria-hidden="true" />
        <GedeonHeroFX />

        <div className="bf-home-hero-inner">
          <span className="bf-home-hero-badge">
            <i />
            PLATAFORMA DE OPERACIÓN DE TORNEOS
          </span>

          <div className="bf-home-hero-copy">
            <div className="bf-home-brandmark">GEDEON BRACKETFLOW</div>

            <h2 className="bf-home-headline">EL CONTROL DE LA ARENA</h2>
            <p className="bf-home-value">
              Opera torneos con una experiencia más visual, más clara y más competitiva.
            </p>

            <div className="bf-home-primary-actions">
              <Link
                href={hasActiveTournament ? dashboardHref : "/dashboard"}
                className="bf-button bf-button-primary bf-button-hero"
              >
                Ver Dashboard
              </Link>
              <a href="#bf-home-story" className="bf-button bf-button-ghost bf-button-hero">
                Saber Más
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="bf-home-cards" className="bf-home-cards-section" ref={cardsRef}>
        <GedeonHeroFX className="bf-home-cards-fx" traceCount={0} emberDensity={28} emberTealChance={0.08} />
        <div className="bf-home-section-head">
          <span className="bf-hub-section-kicker">Capacidades</span>
          <h3>Todo el torneo, en una sola arena</h3>
        </div>
        <div className="bf-home-pitch-grid bf-home-cards-grid">
          {CAPABILITIES.map((cap, index) => (
            <article
              key={cap.id}
              className={`bf-home-cap-card${cardsVisible ? " is-visible" : ""}`}
              style={{ "--cap-i": index } as CSSProperties}
            >
              {cap.live ? (
                <span className="bf-home-cap-live">
                  <i />
                  LIVE
                </span>
              ) : null}
              <span className="bf-home-cap-icon">
                <CapabilityIcon id={cap.id} />
              </span>
              <h4 className="bf-home-cap-title">{cap.title}</h4>
              <p className="bf-home-cap-copy">{cap.copy}</p>
              <Link href={cap.href} className="bf-home-cap-cta">
                {cap.cta}
                <span aria-hidden="true">â†’</span>
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section id="bf-home-story" className="bf-home-arena-story" aria-labelledby="bf-home-story-title">
        <GedeonHeroFX
          className="bf-home-arena-story-embers"
          traceCount={0}
          emberDensity={56}
          emberTealChance={0.22}
        />
        <div className="bf-home-arena-story-shell">
          <header className="bf-home-arena-story-head">
            <span className="bf-hub-section-kicker">Control de arena</span>
            <h3 id="bf-home-story-title">Tres movimientos para controlar la arena</h3>
            <p>Menos caos operativo. Una sola lectura del torneo, desde la configuración hasta la transmisión.</p>
          </header>

          <div className="bf-home-arena-movements">
            {ARENA_MOVEMENTS.map((movement) => (
              <article key={movement.eyebrow} className="bf-home-arena-movement">
                <span className="bf-home-arena-index">{movement.eyebrow}</span>
                <div className="bf-home-arena-movement-copy">
                  <h4>{movement.title}</h4>
                  <p>{movement.copy}</p>
                </div>
                <div className="bf-home-arena-signals">
                  {movement.points.map((point) => <span key={point}>{point}</span>)}
                </div>
                <Link href={movement.href} className="bf-home-arena-link">
                  {movement.cta}<span aria-hidden="true">→</span>
                </Link>
              </article>
            ))}
          </div>

          <section className="bf-home-arena-status" aria-label="Estado del producto">
            <div className="bf-home-arena-status-band is-live">
              <span className="bf-home-arena-status-label"><i />Disponible hoy</span>
              <div>{AVAILABLE_TODAY.map((item) => <span key={item}>{item}</span>)}</div>
            </div>
            <div className="bf-home-arena-status-band is-next">
              <span className="bf-home-arena-status-label">Próxima capa</span>
              <div>{NEXT_LAYER.map((item) => <span key={item}>{item}</span>)}</div>
            </div>
          </section>

          <footer className="bf-home-arena-final">
            <div>
              <span className="bf-hub-section-kicker">Manual-first hoy · asistido mañana</span>
              <h3>Primero control. Luego espectáculo.</h3>
              <p>BracketFlow parte con operación manual confiable y crece hacia OCR, bot de comunidad, herramientas para caster y automatización asistida.</p>
            </div>
            <div className="bf-home-arena-final-actions">
              <Link href={hasActiveTournament ? dashboardHref : "/dashboard"} className="bf-button bf-button-primary">Ver Dashboard</Link>
              <Link href="/torneos" className="bf-button bf-button-ghost">Crear torneo</Link>
            </div>
          </footer>
        </div>
      </section>
    </main>
  );
}
