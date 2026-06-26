"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { useWorldSeriesPractice } from "../lib/useWorldSeriesPractice";
import {
  IconArrowRight,
  IconDashboard,
  IconStandings,
  IconStream,
  IconTeams,
  IconTrophy,
} from "./icons";

function parseTournamentId(value: string | null) {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const DASH = "—";

const DASHBOARD_MOTORS = [
  {
    name: "World Series Clásico",
    axes: "BR · WSOW · Squad fijo",
    status: "Disponible",
    Icon: IconTrophy,
  },
  {
    name: "Resurgence / Rebirth WS",
    axes: "Rebirth · WSOW · Squad fijo",
    status: "Experimental",
    Icon: IconDashboard,
  },
  {
    name: "Gedeon Style / Roulette WS",
    axes: "Rebirth · WSOW · Ruleta",
    status: "Experimental",
    Icon: IconTeams,
  },
  {
    name: "Challonge Competitivo",
    axes: "Kill Race · Single/Double Elim",
    status: "Próximamente",
    Icon: IconStandings,
  },
] as const;

export default function DashboardHome() {
  const searchParams = useSearchParams();
  const preferredTournamentId = parseTournamentId(searchParams.get("tournamentId"));

  const {
    loading,
    tournaments,
    teams,
    selectedTournament,
    selectedTournamentId,
    sortedStandings,
    latestReportedRound,
    currentGameNumber,
    reportsLoaded,
    totalTeams,
  } = useWorldSeriesPractice(preferredTournamentId);

  const query = selectedTournamentId ? `?tournamentId=${selectedTournamentId}` : "";

  const stat = (value: number) => (loading ? DASH : String(value));
  const tournamentsCount = tournaments.length;
  const teamsCount = teams.length;
  const gamesCount = latestReportedRound;

  const top3 = sortedStandings.slice(0, 3);
  const gameNumber = currentGameNumber || latestReportedRound;
  const leader = top3[0];
  const streamReady = Boolean(selectedTournament);

  return (
    <div className="bf-dash bf-dash-v2">
      <section className="bf-dash-active">
        <div className="bf-dash-active-main">
          <span className="bf-dash-section-label">Práctica activa</span>
          <h2>{selectedTournament?.name ?? "Sin torneo activo"}</h2>
          <div className="bf-dash-active-meta">
            <span>{selectedTournament?.game ?? "Selecciona o crea una práctica"}</span>
            <span aria-hidden="true">·</span>
            <span>{gameNumber > 0 ? `Partida ${gameNumber}` : "Sin partida abierta"}</span>
            <span aria-hidden="true">·</span>
            <span>
              {leader ? (
                <>
                  Líder: <strong>{leader.team_name}</strong>
                </>
              ) : (
                "Sin líder todavía"
              )}
            </span>
          </div>
        </div>

        <div className="bf-dash-active-side">
          <span className="bf-dash-results-state">
            <i className="bf-op-dot" />
            {selectedTournament ? `${reportsLoaded}/${totalTeams} resultados cargados` : "Sistema listo"}
          </span>
          <Link href={`/operator${query}`} className="bf-dash-operator-cta">
            Ir a Operator · cargar {gameNumber > 0 ? `Partida ${gameNumber}` : "Partida 1"}
            <IconArrowRight size={17} />
          </Link>
        </div>
      </section>

      <section className="bf-dash-stats">
        <article className="bf-dash-stat">
          <span className="bf-dash-stat-icon">
            <IconTrophy size={22} />
          </span>
          <div className="bf-dash-stat-body">
            <span className="bf-dash-stat-label">Torneos activos</span>
            <span className="bf-dash-stat-value">{stat(tournamentsCount)}</span>
            <span className="bf-dash-stat-sub">Operación World Series</span>
          </div>
        </article>

        <article className="bf-dash-stat">
          <span className="bf-dash-stat-icon">
            <IconTeams size={22} />
          </span>
          <div className="bf-dash-stat-body">
            <span className="bf-dash-stat-label">Equipos registrados</span>
            <span className="bf-dash-stat-value">{stat(teamsCount)}</span>
            <span className="bf-dash-stat-sub">
              {selectedTournament ? selectedTournament.name : "Sin torneo activo"}
            </span>
          </div>
        </article>

        <article className="bf-dash-stat">
          <span className="bf-dash-stat-icon">
            <IconDashboard size={22} />
          </span>
          <div className="bf-dash-stat-body">
            <span className="bf-dash-stat-label">Partidas jugadas</span>
            <span className="bf-dash-stat-value">{stat(gamesCount)}</span>
            <span className="bf-dash-stat-sub">Partidas con resultados</span>
          </div>
        </article>

        <article className="bf-dash-stat is-stream">
          <span className="bf-dash-stat-icon">
            <IconStream size={22} />
          </span>
          <div className="bf-dash-stat-body">
            <span className="bf-dash-stat-label">Stream listo</span>
            <span className="bf-dash-stat-value is-state">
              {loading ? DASH : streamReady ? "LISTO" : "ESPERA"}
            </span>
            <span className="bf-dash-stat-sub">
              {streamReady ? "Sistema listo para transmisión" : "Activa una práctica"}
            </span>
          </div>
        </article>
      </section>

      <section className="bf-dash-workspace">
        <div className="bf-dash-podium-panel">
          <div className="bf-dash-panel-heading">
            <div>
              <span className="bf-dash-section-label">Clasificación</span>
              <h3>Podio actual</h3>
            </div>
            <span className="bf-dash-badge">{gameNumber > 0 ? `Partida ${gameNumber}` : "Sin resultados"}</span>
          </div>

          {top3.length > 0 ? (
            <div className="bf-dash-podium-list">
              {top3.map((entry, index) => (
                <article
                  key={entry.team_id}
                  className={`bf-dash-podium-row${index === 0 ? " is-leader" : ""}`}
                >
                  <span className="bf-dash-rank">{index + 1}</span>
                  <div className="bf-dash-team">
                    <span className="bf-dash-team-name">{entry.team_name}</span>
                    <span className="bf-dash-team-roster">
                      {entry.players.length > 0 ? entry.players.join(" / ") : "Roster pendiente"}
                    </span>
                  </div>
                  <span className="bf-dash-podium-kills">{entry.kills} K</span>
                  <span className="bf-dash-podio-pts">{entry.total_points.toFixed(1)}</span>
                </article>
              ))}
            </div>
          ) : (
            <p className="bf-dash-empty">
              {loading ? "Cargando clasificación…" : "Todavía no hay resultados cargados."}
            </p>
          )}

          <Link href={`/standings${query}`} className="bf-dash-cta">
            Ver clasificación completa
            <IconArrowRight size={16} />
          </Link>
        </div>

      </section>

      <section className="bf-dash-motors">
        <div className="bf-dash-panel-heading">
          <div>
            <span className="bf-dash-section-label">Taxonomía operativa</span>
            <h3>Motores de torneo</h3>
          </div>
          <span className="bf-dash-motors-note">Informativo</span>
        </div>

        <div className="bf-dash-motors-grid">
          {DASHBOARD_MOTORS.map(({ name, axes, status, Icon }) => (
            <article key={name} className="bf-dash-motor">
              <span className="bf-dash-motor-icon">
                <Icon size={18} />
              </span>
              <span className="bf-dash-motor-copy">
                <strong>{name}</strong>
                <small>{axes}</small>
              </span>
              <span className={`bf-dash-motor-status${status === "Disponible" ? " is-ready" : ""}`}>
                {status}
              </span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
