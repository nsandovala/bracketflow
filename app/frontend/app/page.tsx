"use client";

import Image from "next/image";
import Link from "next/link";
import { CSSProperties, useEffect, useRef, useState } from "react";

import AppTopbar from "./components/AppTopbar";
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
    href: "/torneos",
  },
];

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

function HeroCircuitField() {
  const traces = [
    "M60 140 H220 L280 200 H400 V280",
    "M30 300 H190 L250 260 H380",
    "M90 460 H250 L310 400 H400",
    "M50 620 H210 L270 560 H390 V480",
    "M160 80 V180 L220 240",
    "M120 720 V620 L180 560",
    "M1140 160 H980 L920 220 H800 V300",
    "M1170 320 H1010 L950 280 H820",
    "M1110 480 H950 L890 420 H800",
    "M1150 640 H990 L930 580 H810 V500",
    "M1040 100 V200 L980 260",
    "M1080 740 V640 L1020 580",
  ];
  const nodes: Array<[number, number]> = [
    [60, 140],
    [30, 300],
    [90, 460],
    [50, 620],
    [160, 80],
    [120, 720],
    [400, 280],
    [380, 260],
    [400, 400],
    [390, 480],
    [1140, 160],
    [1170, 320],
    [1110, 480],
    [1150, 640],
    [1040, 100],
    [1080, 740],
    [800, 300],
    [820, 280],
    [800, 420],
    [810, 500],
  ];
  const pads: Array<[number, number]> = [
    [280, 200],
    [250, 260],
    [310, 400],
    [270, 560],
    [920, 220],
    [950, 280],
    [890, 420],
    [930, 580],
  ];

  return (
    <svg
      className="bf-home-circuit-field"
      viewBox="0 0 1200 800"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="bfCircuitFade" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0" />
          <stop offset="45%" stopColor="#fff" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id="bfCircuitMask">
          <rect width="1200" height="800" fill="url(#bfCircuitFade)" />
        </mask>
      </defs>
      <g mask="url(#bfCircuitMask)" fill="none">
        {traces.map((d, i) => (
          <path
            key={d}
            d={d}
            className="bf-home-trace"
            style={{
              animationDelay: `${(i * 0.7) % 5}s`,
              animationDuration: `${4.5 + (i % 3)}s`,
            }}
          />
        ))}
        {nodes.map(([x, y], i) => (
          <circle
            key={`${x}-${y}`}
            cx={x}
            cy={y}
            r="2.4"
            className="bf-home-node"
            style={{ animationDelay: `${(i * 1.1) % 7}s` }}
          />
        ))}
        {pads.map(([x, y], i) => (
          <rect
            key={`pad-${x}-${y}`}
            x={x - 2.5}
            y={y - 2.5}
            width="5"
            height="5"
            className="bf-home-pad"
            style={{ animationDelay: `${(i * 0.9) % 5}s` }}
          />
        ))}
      </g>
    </svg>
  );
}

function GoldenSand() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let width = 0;
    let height = 0;

    type Dot = {
      x: number;
      y: number;
      r: number;
      vy: number;
      sway: number;
      swayPhase: number;
      phase: number;
      speed: number;
      warm: number;
    };

    const dots: Dot[] = Array.from({ length: 130 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.4 + Math.random() * 1.6,
      vy: -(0.004 + Math.random() * 0.014),
      sway: 0.002 + Math.random() * 0.004,
      swayPhase: Math.random() * Math.PI * 2,
      phase: Math.random() * Math.PI * 2,
      speed: 0.25 + Math.random() * 0.5,
      warm: Math.random(),
    }));

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      width = canvas.width = canvas.offsetWidth * dpr;
      height = canvas.height = canvas.offsetHeight * dpr;
    };

    resize();
    window.addEventListener("resize", resize);

    let t = 0;
    const tick = () => {
      const dpr = window.devicePixelRatio || 1;
      t += 0.016;
      ctx.clearRect(0, 0, width, height);

      for (const dot of dots) {
        dot.y += dot.vy * 0.016;
        const sx = dot.x + Math.sin(t * 0.3 + dot.swayPhase) * dot.sway;

        if (dot.y < -0.02) {
          dot.y = 1.02;
          dot.x = Math.random();
        }

        const alpha = 0.18 + 0.38 * (0.5 + 0.5 * Math.sin(t * dot.speed + dot.phase));
        const green = Math.round(150 + dot.warm * 55);
        const blue = Math.round(60 + dot.warm * 60);

        ctx.beginPath();
        ctx.arc(sx * width, dot.y * height, dot.r * dpr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(226, ${green}, ${blue}, ${alpha})`;
        ctx.fill();
      }

      raf = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="bf-home-golden-sand" aria-hidden="true" />;
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
        <HeroCircuitField />
        <GoldenSand />

        <div className="bf-home-hero-inner">
          <span className="bf-home-hero-badge">
            <i />
            Plataforma de operación de torneos
          </span>

          <div className="bf-home-helmet-stage">
            <div className="bf-home-helmet-glow" />
            <Image
              src="/gedeon/helmet-hero.webp"
              alt="Casco Gedeon"
              width={1151}
              height={712}
              priority
              quality={90}
              sizes="(max-width: 720px) 92vw, 760px"
              className="bf-home-helmet-img"
            />
          </div>

          <div className="bf-home-brandmark">GEDEON BRACKETFLOW</div>
          <div className="bf-home-submark">Tournament Operating System</div>

          <h2 className="bf-home-headline">El control de la arena</h2>
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
            <a href="#bf-home-cards" className="bf-button bf-button-ghost bf-button-hero">
              Saber Más
            </a>
          </div>
        </div>
      </section>

      <section id="bf-home-cards" className="bf-home-cards-section" ref={cardsRef}>
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
                <span aria-hidden="true">→</span>
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
