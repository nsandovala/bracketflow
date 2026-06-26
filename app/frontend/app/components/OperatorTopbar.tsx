"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { useWorldSeriesPractice } from "../lib/useWorldSeriesPractice";
import { IconBell } from "./icons";

function parseTournamentId(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const ROUTE_COPY: Record<string, { title: string; subtitle: string }> = {
  "/": {
    title: "BRACKETFLOW",
    subtitle: "Tournament Operating System.",
  },
  "/dashboard": {
    title: "Dashboard Operativo",
    subtitle: "Control rápido para prácticas World Series.",
  },
  "/torneos": {
    title: "Torneos",
    subtitle: "Hub operativo para listar, seleccionar y crear torneos.",
  },
  "/equipos": {
    title: "Equipos",
    subtitle: "Gestiona equipos y rosters del torneo.",
  },
  "/ajustes": {
    title: "Ajustes",
    subtitle: "Preferencias del entorno operator.",
  },
};

function StandingsTopbarCopy() {
  const searchParams = useSearchParams();
  const preferredTournamentId = parseTournamentId(searchParams.get("tournamentId"));
  const { selectedTournament, latestReportedRound } =
    useWorldSeriesPractice(preferredTournamentId);

  const subtitle = selectedTournament
    ? `${selectedTournament.name} · ${
        latestReportedRound > 0 ? `Después de la Partida ${latestReportedRound}` : "Sin partidas reportadas"
      }`
    : "Selecciona un torneo activo.";

  return (
    <div className="bf-op-greeting">
      <h1>Standings</h1>
      <p>{subtitle}</p>
    </div>
  );
}

export default function OperatorTopbar() {
  const pathname = usePathname();
  const routeCopy = ROUTE_COPY[pathname] ?? {
    title: "Operator Suite",
    subtitle: "Centro de control de BracketFlow.",
  };

  return (
    <header className="bf-op-topbar">
      {pathname === "/standings" ? (
        <StandingsTopbarCopy />
      ) : (
        <div className="bf-op-greeting">
          <h1>{routeCopy.title}</h1>
          <p>{routeCopy.subtitle}</p>
        </div>
      )}

      <div className="bf-op-topbar-side">
        <span className="bf-op-livebadge">
          <i className="bf-op-dot" />
          En vivo
        </span>
        <button
          type="button"
          className="bf-op-iconbtn"
          aria-label="Notificaciones"
        >
          <IconBell size={18} />
        </button>
      </div>
    </header>
  );
}
