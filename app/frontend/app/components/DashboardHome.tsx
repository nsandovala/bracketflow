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

// Placeholder honesto cuando un dato aún no está disponible.
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
    activeMatch,
    activeMatchResults,
  } = useWorldSeriesPractice(preferredTournamentId);

  const query = selectedTournamentId ? `?tournamentId=${selectedTournamentId}` : "";

  // Stat-cards (todos los números vienen del backend del torneo activo).
  const stat = (value: number) => (loading ? DASH : String(value));
  const tournamentsCount = tournaments.length;
  const teamsCount = teams.length;
  const gamesCount = matches.length;

  const top3 = sortedStandings.slice(0, 3);
  const compactStandings = sortedStandings.slice(0, 6);

  // Panel "cargar game": un card por equipo con su reporte del game actual.
  const gameNumber = currentGameNumber || latestReportedRound;
  const gameCards = teams.map((team) => {
    const report = activeMatchResults.find((result) => result.team_id === team.id);
    return { team, report };
  });

  return (
    <div className="bf-dash">
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

      {/* ---- Torneo activo + Standings ---- */}
      <section className="bf-dash-grid">
        <article className="bf-dash-panel">
          <div className="bf-dash-panel-head">
            <div>
              <span className="bf-dash-panel-kicker">Torneo activo</span>
              <h2 className="bf-dash-panel-title">
                {selectedTournament ? selectedTournament.name : "Sin torneo activo"}
              </h2>
            </div>
            <div className="bf-dash-panel-meta">
              {selectedTournament ? (
                <>
                  <span className="bf-dash-badge">{selectedTournament.game}</span>
                  <span className="bf-dash-badge is-live">
                    <i className="bf-op-dot" />
                    After Game {latestReportedRound}
                  </span>
                </>
              ) : null}
            </div>
          </div>

          {top3.length > 0 ? (
            <div className="bf-dash-table">
              <div className="bf-dash-thead">
                <span>#</span>
                <span>Equipo</span>
                <span className="bf-dash-numhead">Pts</span>
                <span className="bf-dash-numhead">Kills</span>
                <span className="bf-dash-numhead">Best</span>
                <span className="bf-dash-numhead">Games</span>
              </div>
              {top3.map((entry, index) => (
                <div key={entry.team_id} className="bf-dash-trow" data-rank={index + 1}>
                  <span className="bf-dash-rank">{index + 1}</span>
                  <span className="bf-dash-team">
                    <span className="bf-dash-team-name">{entry.team_name}</span>
                    <span className="bf-dash-team-roster">
                      {entry.players.length > 0 ? entry.players.join(" / ") : "Roster pendiente"}
                    </span>
                  </span>
                  <span className="bf-dash-num is-pts">{entry.total_points.toFixed(1)}</span>
                  <span className="bf-dash-num">{entry.kills}</span>
                  <span className="bf-dash-num">{entry.best_placement ?? DASH}</span>
                  <span className="bf-dash-num">{entry.matches_played}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="bf-dash-empty">
              {loading ? "Cargando torneo activo…" : "Todavía no hay standings para este torneo."}
            </p>
          )}

          <Link href={`/standings${query}`} className="bf-dash-cta">
            Ver clasificación completa
            <IconArrowRight size={16} />
          </Link>
        </article>

        <article className="bf-dash-panel">
          <div className="bf-dash-panel-head">
            <div>
              <span className="bf-dash-panel-kicker">Standings</span>
              <h2 className="bf-dash-panel-title">Tabla general</h2>
            </div>
          </div>

          {compactStandings.length > 0 ? (
            <div className="bf-dash-table">
              <div className="bf-dash-thead">
                <span>#</span>
                <span>Equipo</span>
                <span className="bf-dash-numhead">Pts</span>
                <span className="bf-dash-numhead">Kills</span>
                <span className="bf-dash-numhead">Best</span>
                <span className="bf-dash-numhead">Games</span>
              </div>
              {compactStandings.map((entry, index) => (
                <div key={entry.team_id} className="bf-dash-trow" data-rank={index + 1}>
                  <span className="bf-dash-rank is-green">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="bf-dash-team">
                    <span className="bf-dash-team-name">{entry.team_name}</span>
                    <span className="bf-dash-team-roster">
                      {entry.players.length > 0 ? entry.players.join(" / ") : "Roster pendiente"}
                    </span>
                  </span>
                  <span className="bf-dash-num is-pts">{entry.total_points.toFixed(1)}</span>
                  <span className="bf-dash-num">{entry.kills}</span>
                  <span className="bf-dash-num">{entry.best_placement ?? DASH}</span>
                  <span className="bf-dash-num">{entry.matches_played}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="bf-dash-empty">
              {loading ? "Cargando standings…" : "Sin standings disponibles."}
            </p>
          )}

          <Link href={`/standings${query}`} className="bf-dash-cta">
            Ver standings completos
            <IconArrowRight size={16} />
          </Link>
        </article>
      </section>

      {/* ---- Cargar game + Accesos rápidos ---- */}
      <section className="bf-dash-grid">
        <article className="bf-dash-panel">
          <div className="bf-dash-panel-head">
            <div>
              <span className="bf-dash-panel-kicker">Cargar game</span>
              <h2 className="bf-dash-panel-title">
                {activeMatch ? `Game ${gameNumber}` : "Sin game en curso"}
              </h2>
            </div>
            <div className="bf-dash-panel-meta">
              <span className="bf-dash-badge">
                {activeMatchResults.length}/{teams.length} reportes
              </span>
            </div>
          </div>

          {gameCards.length > 0 ? (
            <div className="bf-dash-games">
              {gameCards.map(({ team, report }) => (
                <div
                  key={team.id}
                  className={`bf-dash-gamecard ${report ? "" : "is-pending"}`.trim()}
                >
                  <span className="bf-dash-gamecard-name">{team.name}</span>
                  <div className="bf-dash-gamecard-stats">
                    <span className="bf-dash-gamecard-stat">
                      <span>Kills</span>
                      <strong>{report ? report.kills : DASH}</strong>
                    </span>
                    <span className="bf-dash-gamecard-stat">
                      <span>Place</span>
                      <strong>{report ? report.placement : DASH}</strong>
                    </span>
                    <span className="bf-dash-gamecard-stat">
                      <span>Total</span>
                      <strong className={report ? "is-total" : ""}>
                        {report ? report.total_points.toFixed(1) : DASH}
                      </strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="bf-dash-empty">
              {loading ? "Cargando game…" : "Carga equipos para empezar a reportar games."}
            </p>
          )}

          <Link href={`/operator${query}`} className="bf-dash-cta">
            Ir a cargar partida
            <IconArrowRight size={16} />
          </Link>
        </article>

        <article className="bf-dash-panel">
          <div className="bf-dash-panel-head">
            <div>
              <span className="bf-dash-panel-kicker">Accesos rápidos</span>
              <h2 className="bf-dash-panel-title">Atajos del operador</h2>
            </div>
          </div>

          <div className="bf-dash-quick">
            {/* Crear torneo: el formulario vive en el hub actual (`/`). */}
            <Link href="/" className="bf-dash-quick-link">
              <span className="bf-dash-quick-icon">
                <IconPlus size={20} />
              </span>
              <span className="bf-dash-quick-copy">
                <strong>Crear Torneo</strong>
                <span>Nueva práctica</span>
              </span>
            </Link>

            <Link href={`/operator${query}`} className="bf-dash-quick-link">
              <span className="bf-dash-quick-icon">
                <IconUpload size={20} />
              </span>
              <span className="bf-dash-quick-copy">
                <strong>Abrir Operator</strong>
                <span>Cargar games</span>
              </span>
            </Link>

            <Link href={`/standings${query}`} className="bf-dash-quick-link">
              <span className="bf-dash-quick-icon">
                <IconStandings size={20} />
              </span>
              <span className="bf-dash-quick-copy">
                <strong>Abrir Standings</strong>
                <span>Tabla general</span>
              </span>
            </Link>

            <Link href={`/stream${query}`} className="bf-dash-quick-link">
              <span className="bf-dash-quick-icon">
                <IconStream size={20} />
              </span>
              <span className="bf-dash-quick-copy">
                <strong>Abrir Stream</strong>
                <span>Vista broadcast</span>
              </span>
            </Link>
          </div>
        </article>
      </section>

      <footer className="bf-dash-footer">
        <span>© BracketFlow</span>
        <span>World Series Practice · esports LATAM</span>
      </footer>
    </div>
  );
}
