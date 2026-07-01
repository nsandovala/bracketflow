"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { useWorldSeriesPractice } from "../lib/useWorldSeriesPractice";
import {
  IconArrowRight,
  IconDashboard,
  IconStream,
  IconTeams,
  IconTrophy,
} from "./icons";
import { resolveTournamentEngine } from "../../lib/tournamentModel";
import { buildSingleElimBracket } from "../../lib/bracketDisplay";

function parseTournamentId(value: string | null) {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const DASH = "—";

export default function DashboardHome() {
  const router = useRouter();
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
    reportsLoaded,
    totalTeams,
    selectedEngine,
    selectTournament,
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
  const engine = selectedTournament ? selectedEngine ?? resolveTournamentEngine(selectedTournament) : null;
  const needsRoulette = engine?.rosterPolicy === "roulette" && totalTeams === 0;
  const isKillRace = engine?.engineKey === "kill_race_bracket";
  const bracketPreview = isKillRace ? buildSingleElimBracket(matches, teams, engine?.teamSize ?? 2)[0] : null;
  const setupMissing = Boolean(selectedTournament && totalTeams === 0);
  const cta = !selectedTournament
    ? { label: "Completar setup", href: "/torneos" }
    : needsRoulette
      ? { label: "Abrir Ruleta", href: `/operator${query}&roulette=1` }
      : isKillRace
        ? { label: "Preparar bracket", href: `/operator${query}&tab=bracket` }
        : setupMissing
          ? { label: "Completar setup", href: `/operator${query}` }
          : { label: "Ir a Operator · cargar partida", href: `/operator${query}` };

  function handleSelectTournament(tournamentId: number) {
    selectTournament(tournamentId);
    router.replace(`/dashboard?tournamentId=${tournamentId}`);
  }

  return (
    <div className="bf-dash bf-dash-v2">
      <section className="bf-dash-active">
        <div className="bf-dash-active-main">
          <span className="bf-dash-section-label">Práctica activa</span>
          <h2>{selectedTournament?.name ?? "Sin torneo activo"}</h2>
          {tournaments.length > 0 ? (
            <label className="bf-standings-selector">
              <span>Torneo activo</span>
              <select
                value={selectedTournamentId ?? ""}
                onChange={(event) => handleSelectTournament(Number(event.target.value))}
              >
                {tournaments.map((tournament) => (
                  <option key={tournament.id} value={tournament.id}>
                    {tournament.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="bf-dash-active-meta">
            <span>{engine?.label ?? selectedTournament?.game ?? "Selecciona o crea una práctica"}</span>
            <span aria-hidden="true">·</span>
            <span>
              {isKillRace
                ? totalTeams > 0
                  ? "Seed listo"
                  : "Falta generar bracket"
                : gameNumber > 0
                  ? `Partida ${gameNumber}`
                  : "Sin partida abierta"}
            </span>
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
            {selectedTournament
              ? `${totalTeams} equipos · ${reportsLoaded} resultados cargados`
              : "Sistema listo"}
          </span>
          <Link href={cta.href} className="bf-dash-operator-cta">
            {cta.label}
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
              {selectedTournament ? "Contexto heredado por Operator y Standings" : "Sin torneo activo"}
            </span>
          </div>
        </article>

        <article className="bf-dash-stat">
          <span className="bf-dash-stat-icon">
            <IconDashboard size={22} />
          </span>
          <div className="bf-dash-stat-body">
            <span className="bf-dash-stat-label">{isKillRace ? "Ronda actual" : "Partidas jugadas"}</span>
            <span className="bf-dash-stat-value">{stat(gamesCount)}</span>
            <span className="bf-dash-stat-sub">
              {isKillRace ? "Bracket real pendiente" : "Partidas con resultados"}
            </span>
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
          ) : isKillRace && bracketPreview ? (
            <div className="bf-dash-seed-preview">
              {bracketPreview.matches.slice(0, 4).map((match) => (
                <article key={match.id} className="bf-dash-seed-row">
                  <span>{match.label}</span>
                  <strong>{match.left}</strong>
                  <em>vs</em>
                  <strong>{match.right}</strong>
                </article>
              ))}
            </div>
          ) : (
            <p className="bf-dash-empty">
              {loading
                ? "Cargando clasificación…"
                : isKillRace
                  ? "Falta generar bracket. No hay tabla WSOW para Kill Race."
                  : "Todavía no hay resultados cargados."}
            </p>
          )}

          <Link href={isKillRace ? `/operator${query}&tab=bracket` : `/standings${query}`} className="bf-dash-cta">
            {isKillRace ? "Preparar bracket" : "Ver clasificación completa"}
            <IconArrowRight size={16} />
          </Link>
        </div>

      </section>
    </div>
  );
}
