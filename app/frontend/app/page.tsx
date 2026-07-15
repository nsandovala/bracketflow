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

type StoryOverview = {
  eyebrow: string;
  title: string;
  copy: string;
  points: string[];
};

type StoryBlock = {
  eyebrow: string;
  title: string;
  copy: string;
  points: string[];
};

type StoryStep = {
  step: string;
  title: string;
  copy: string;
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
    title: "Herramientas para Casters",
    copy: "Overlays, paneles y soporte visual para transmisión.",
    cta: "Ver Herramientas",
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

const STORY_OVERVIEW: StoryOverview[] = [
  {
    eyebrow: "Que es",
    title: "BracketFlow",
    copy:
      "Una arena operativa para organizar torneos, operar en vivo y mostrar la historia competitiva sin saltar entre herramientas desconectadas.",
    points: ["torneos competitivos", "operacion manual-first", "standings y stream", "misma lectura visual"],
  },
  {
    eyebrow: "Para quien es",
    title: "Operadores, staff y casters",
    copy:
      "Pensado para quien necesita ver contexto claro, confirmar el siguiente paso y sostener una experiencia consistente para comunidad y transmision.",
    points: ["desktop/laptop cockpit", "tablet para staff", "streamview/OBS", "mobile safe para viewer"],
  },
  {
    eyebrow: "Que problema resuelve",
    title: "Menos caos, mas control",
    copy:
      "Reduce la friccion entre planillas, mensajes, capturas y overlays improvisados para que la operacion del torneo no dependa de memoria ni parches.",
    points: ["menos planillas sueltas", "menos copy manual", "menos contexto perdido", "mas legibilidad"],
  },
];

const STORY_BLOCKS: StoryBlock[] = [
  {
    eyebrow: "01",
    title: "Crea la arena",
    copy:
      "Configura el formato, registra equipos y prepara el torneo sin perderte entre planillas, mensajes y capturas sueltas.",
    points: ["WSOW Battle Royale", "Rebirth WS", "Gedeon Roulette", "Kill Race BO3"],
  },
  {
    eyebrow: "02",
    title: "Opera en vivo",
    copy:
      "El operador ve que falta, que partida esta activa, que equipos reportaron y cual es la proxima accion.",
    points: ["resultados manual-first", "validacion clara", "avance de bracket", "estados persistentes"],
  },
  {
    eyebrow: "03",
    title: "Muestra el torneo",
    copy:
      "Standings, stream view y herramientas para caster permiten contar la historia competitiva sin improvisar overlays.",
    points: ["standings en vivo", "vista stream", "soporte para casters", "foco en legibilidad"],
  },
  {
    eyebrow: "04",
    title: "Roadmap",
    copy:
      "El core manual queda primero. Luego vienen automatizaciones controladas para reducir carga operativa sin inventar resultados.",
    points: ["Push Mode", "OCR MVP", "OGL/WebGL premium", "Copilot/agentes"],
  },
];

const STORY_FLOW: StoryStep[] = [
  {
    step: "Paso 1",
    title: "Configura formato y roster",
    copy: "El torneo arranca con reglas claras, equipos cargados y una superficie comun para toda la operacion.",
  },
  {
    step: "Paso 2",
    title: "Confirma estado y avance",
    copy: "Cada cambio deja una lectura visible: que esta listo, que falta validar y cual es la siguiente accion.",
  },
  {
    step: "Paso 3",
    title: "Opera partida a partida",
    copy: "El operador mantiene control del flujo sin depender de memoria, chats dispersos ni overlays armados a ultimo minuto.",
  },
  {
    step: "Paso 4",
    title: "Cuenta la historia competitiva",
    copy: "Standings, bracket y stream view permiten mostrar avance real con mejor contexto para staff, comunidad y caster.",
  },
];

const STORY_ENGINES = ["WSOW Battle Royale", "Rebirth WS", "Gedeon Roulette", "Kill Race BO3"];

const STORY_NEXT = ["Dashboard operativo premium", "Push Mode", "OGL/WebGL", "OCR", "Discord bot", "Copilot/agentes"];

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

      <section id="bf-home-story" className="bf-home-story-section" aria-labelledby="bf-home-story-title">
        <div className="bf-home-story-shell">
          <div className="bf-home-story-head">
            <span className="bf-hub-section-kicker">Saber mas</span>
            <h3 id="bf-home-story-title">Una arena operativa para torneos competitivos</h3>
            <p>
              BracketFlow une creacion de torneos, operacion en vivo, standings y herramientas para
              transmision en una experiencia clara, visual y lista para comunidad.
            </p>
          </div>

          <div className="bf-home-story-overview">
            {STORY_OVERVIEW.map((item) => (
              <article key={item.title} className="bf-home-story-overview-card">
                <span className="bf-home-story-overview-kicker">{item.eyebrow}</span>
                <h4>{item.title}</h4>
                <p>{item.copy}</p>
                <ul className="bf-home-story-list">
                  {item.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div className="bf-home-story-grid">
            {STORY_BLOCKS.map((block) => (
              <article key={block.title} className="bf-home-story-card">
                <span className="bf-home-story-card-index">{block.eyebrow}</span>
                <h4>{block.title}</h4>
                <p>{block.copy}</p>
                <ul className="bf-home-story-list">
                  {block.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div className="bf-home-story-lower">
            <article className="bf-home-story-flow">
              <div className="bf-home-story-flow-head">
                <span className="bf-home-story-panel-kicker">Como fluye la arena</span>
                <h4>Un flujo visible para operar sin improvisar</h4>
                <p>
                  La operacion no depende de una sola pantalla. BracketFlow ordena el trabajo para que
                  staff, caster y comunidad lean el mismo torneo desde superficies distintas.
                </p>
              </div>

              <div className="bf-home-story-flow-grid">
                {STORY_FLOW.map((item) => (
                  <div key={item.title} className="bf-home-story-flow-step">
                    <span>{item.step}</span>
                    <strong>{item.title}</strong>
                    <p>{item.copy}</p>
                  </div>
                ))}
              </div>
            </article>

            <aside className="bf-home-story-side">
              <article className="bf-home-story-side-card">
                <span className="bf-home-story-panel-kicker">Motores soportados hoy</span>
                <h4>Listo para formatos competitivos reales</h4>
                <div className="bf-home-story-chip-cloud" aria-label="Motores soportados">
                  {STORY_ENGINES.map((engine) => (
                    <span key={engine} className="bf-home-story-chip">
                      {engine}
                    </span>
                  ))}
                </div>
              </article>

              <article className="bf-home-story-side-card">
                <span className="bf-home-story-panel-kicker">Que viene despues</span>
                <h4>Primero core manual, luego automatizacion controlada</h4>
                <ul className="bf-home-story-list">
                  {STORY_NEXT.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>

              <div className="bf-home-story-actions">
                <Link href={hasActiveTournament ? dashboardHref : "/dashboard"} className="bf-button bf-button-primary">
                  Ver Dashboard
                </Link>
                <Link href="/torneos" className="bf-button bf-button-ghost">
                  Ver Torneos
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
