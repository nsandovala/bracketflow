"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { useWorldSeriesPractice } from "../lib/useWorldSeriesPractice";
import {
  IconArrowRight,
  IconDashboard,
  IconPlus,
  IconStandings,
  IconStream,
  IconTeams,
  IconTrophy,
  IconUpload,
} from "./icons";

function parseTournamentId(value: string | null) {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const DASH = "—";

export default function DashboardHome() {
  const searchParams = useSearchParams();
  const preferredTournamentId = parseTournamentId(searchParams.get("tournamentId"));

  const {
    loading,
    tournaments,
    teams,
    matches,
    selectedTournament,
    selectedTournamentId,
    sortedStandings,
    latestReportedRound,
    currentGameNumber,
  } = useWorldSeriesPractice(preferredTournamentId);

  const query = selectedTournamentId ? `?tournamentId=${selectedTournamentId}` : "";

  const stat = (value: number) => (loading ? DASH : String(value));
  const tournamentsCount = tournaments.length;
  const teamsCount = teams.length;
  const gamesCount = matches.length;

  const top3 = sortedStandings.slice(0, 3);
  const gameNumber = currentGameNumber || latestReportedRound;

  return (
    <div className="bf-dash">
      {/* ---- Franja de estado (1 línea) ---- */}
      <div className="bf-dash-statline">
        <span className="bf-dash-statline-name">
          {selectedTournament ? selectedTournament.name : "Sin torneo activo"}
        </span>
        {selectedTournament ? (
          <>
            <span className="bf-dash-statline-sep" aria-hidden="true">·</span>
            <span className="bf-dash-badge">{selectedTournament.game}</span>
            {gameNumber > 0 ? (
              <span className="bf-dash-badge is-live">
                <i className="bf-op-dot" />
                Game {gameNumber}
              </span>
            ) : null}
            {top3[0] ? (
              <>
                <span className="bf-dash-statline-sep" aria-hidden="true">·</span>
                <span className="bf-dash-statline-leader">
                  Líder: <strong>{top3[0].team_name}</strong>
                </span>
              </>
            ) : null}
          </>
        ) : null}
      </div>

      {/* ---- Fila de stat-cards ---- */}
      <section className="bf-dash-stats">
        <article className="bf-dash-stat">
          <span className="bf-dash-stat-icon">
            <IconTrophy size={22} />
          </span>
          <div className="bf-dash-stat-body">
            <span className="bf-dash-stat-label">Torneos activos</span>
            <span className="bf-dash-stat-value">{stat(tournamentsCount)}</span>
            <span className="bf-dash-stat-sub">World Series Practice</span>
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
            <span className="bf-dash-stat-sub">Games cargados en esta práctica</span>
          </div>
        </article>
      </section>

      {/* ---- Podio Top 3 ---- */}
      <section className="bf-dash-podio">
        <span className="bf-dash-podio-kicker">Podio</span>
        {top3.length > 0 ? (
          <div className="bf-dash-podio-grid">
            {top3.map((entry, index) => (
              <article
                key={entry.team_id}
                className={`bf-dash-podio-card${index === 0 ? " is-champion" : ""}`}
              >
                <span className="bf-dash-rank">{index + 1}</span>
                <div className="bf-dash-team">
                  <span className="bf-dash-team-name">{entry.team_name}</span>
                  <span className="bf-dash-team-roster">
                    {entry.players.length > 0 ? entry.players.join(" / ") : "Roster pendiente"}
                  </span>
                </div>
                <span className="bf-dash-podio-pts">{entry.total_points.toFixed(1)}</span>
              </article>
            ))}
          </div>
        ) : (
          <p className="bf-dash-empty">
            {loading ? "Cargando podio…" : "Todavía no hay resultados para este torneo."}
          </p>
        )}
        <Link href={`/standings${query}`} className="bf-dash-cta">
          Ver clasificación completa
          <IconArrowRight size={16} />
        </Link>
      </section>

      {/* ---- 4 acciones héroe ---- */}
      <section className="bf-dash-hero-actions">
        <Link href="/" className="bf-dash-hero-action">
          <span className="bf-dash-hero-action-icon">
            <IconPlus size={26} />
          </span>
          <strong>Crear torneo</strong>
          <span>Nueva práctica</span>
        </Link>
        <Link href={`/operator${query}`} className="bf-dash-hero-action">
          <span className="bf-dash-hero-action-icon">
            <IconUpload size={26} />
          </span>
          <strong>Abrir Operator</strong>
          <span>Cargar games</span>
        </Link>
        <Link href={`/standings${query}`} className="bf-dash-hero-action">
          <span className="bf-dash-hero-action-icon">
            <IconStandings size={26} />
          </span>
          <strong>Abrir Standings</strong>
          <span>Tabla general</span>
        </Link>
        <Link href={`/stream${query}`} className="bf-dash-hero-action">
          <span className="bf-dash-hero-action-icon">
            <IconStream size={26} />
          </span>
          <strong>Abrir Stream</strong>
          <span>Vista broadcast</span>
        </Link>
      </section>

      <footer className="bf-dash-footer">
        <span>© BracketFlow</span>
        <span>World Series Practice · esports LATAM</span>
      </footer>
    </div>
  );
}
