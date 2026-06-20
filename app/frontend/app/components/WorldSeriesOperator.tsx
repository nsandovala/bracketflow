"use client";

import { FormEventHandler, useState } from "react";

import { Match, Team, TeamResultDetail, Tournament } from "../../lib/api";
import { estimateWorldSeriesPoints } from "../../lib/tournamentMode";
import { ResultDraft } from "../lib/useWorldSeriesPractice";

import AppTopbar from "./AppTopbar";

type WorldSeriesOperatorProps = {
  backendOnline: boolean;
  message: string | null;
  tournaments: Tournament[];
  selectedTournamentId: number | null;
  selectedTournament: Tournament | null;
  teams: Team[];
  activeMatch: Match | null;
  activeMatchResults: TeamResultDetail[];
  pendingTeams: Team[];
  reportsLoaded: number;
  totalTeams: number;
  canCreateNextGame: boolean;
  nextGameNumber: number;
  submitting: boolean;
  teamName: string;
  teamRoster: string;
  teamFormError: string | null;
  resultDrafts: Record<string, ResultDraft>;
  onSelectTournament: (tournamentId: number) => void;
  onTeamNameChange: (value: string) => void;
  onTeamRosterChange: (value: string) => void;
  onCreateTeam: FormEventHandler<HTMLFormElement>;
  onUpdateDraft: (matchId: number, teamId: number, patch: Partial<ResultDraft>) => void;
  onSaveTeamReport: (matchId: number, teamId: number) => void;
  onCreateNextGame: () => void;
};

type OperatorMode = "op" | "setup";
type ResultFilter = "all" | "pending";

function getDraftKey(matchId: number, teamId: number) {
  return `${matchId}:${teamId}`;
}

function rosterText(team: Team) {
  return team.members.length > 0
    ? team.members.map((member) => member.player.nickname).join(" / ")
    : "Roster pendiente";
}

function jumpToTeam(teamId: number) {
  const el = document.getElementById(`opr-card-${teamId}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.querySelector<HTMLInputElement>("input")?.focus();
}

export default function WorldSeriesOperator({
  backendOnline,
  message,
  tournaments,
  selectedTournamentId,
  selectedTournament,
  teams,
  activeMatch,
  activeMatchResults,
  pendingTeams,
  reportsLoaded,
  totalTeams,
  canCreateNextGame,
  nextGameNumber,
  submitting,
  teamName,
  teamRoster,
  teamFormError,
  resultDrafts,
  onSelectTournament,
  onTeamNameChange,
  onTeamRosterChange,
  onCreateTeam,
  onUpdateDraft,
  onSaveTeamReport,
  onCreateNextGame,
}: WorldSeriesOperatorProps) {
  const tournamentQuery = selectedTournamentId ? `?tournamentId=${selectedTournamentId}` : "";

  const [mode, setMode] = useState<OperatorMode>("op");
  const [filter, setFilter] = useState<ResultFilter>("all");

  const currentGame = activeMatch ? activeMatch.round : nextGameNumber;
  const pendingCount = pendingTeams.length;
  const progressPct = totalTeams > 0 ? (reportsLoaded / totalTeams) * 100 : 0;
  const visibleTeams = filter === "pending" ? pendingTeams : teams;

  return (
    <main className="bf-page bf-page-operator">
      <div className="opr-amb" aria-hidden="true" />

      <AppTopbar
        title="BracketFlow"
        subtitle={selectedTournament ? selectedTournament.name : "World Series Practice"}
        navLinks={[
          { href: "/", label: "Hub" },
          { href: "/operator", label: "Operator" },
          { href: `/standings${tournamentQuery}`, label: "Standings" },
          { href: `/stream${tournamentQuery}`, label: "Stream" },
        ]}
        backHref="/"
        showBackendStatus
        backendOnline={backendOnline}
        tournamentSelector={{
          tournaments,
          selectedTournamentId,
          onSelectTournament,
        }}
      />

      {message ? <p className="bf-message">{message}</p> : null}

      {!selectedTournament ? (
        <p className="bf-empty">No hay torneo World Series Practice seleccionado.</p>
      ) : (
        <>
          {/* ---- Command bar ---- */}
          <section className="opr-command">
            <div className="opr-game">
              <div>
                <div className="eye">Operando</div>
                <strong>Game {currentGame}</strong>
              </div>
              <span className="t">{totalTeams} equipos</span>
            </div>

            <div className="opr-progress">
              <div className="opr-progress-top">
                <span>Reportes del game</span>
                <b>
                  <em>{reportsLoaded}</em>/{totalTeams} cargados ·{" "}
                  <span className="opr-pending-n">{pendingCount}</span> pendientes
                </b>
              </div>
              <div className="opr-bar">
                <i style={{ width: `${progressPct}%` }} />
              </div>
            </div>

            <button
              type="button"
              className={`opr-next${canCreateNextGame ? " is-ready" : ""}`}
              disabled={!canCreateNextGame || submitting}
              onClick={onCreateNextGame}
            >
              Crear Game {nextGameNumber} <span className="arrow">→</span>
            </button>
          </section>

          {/* ---- Toggle modo + filtro ---- */}
          <div className="opr-controls">
            <div className="opr-seg">
              <button
                type="button"
                className={mode === "op" ? "is-on" : ""}
                onClick={() => setMode("op")}
              >
                Operación
              </button>
              <button
                type="button"
                className={mode === "setup" ? "is-on" : ""}
                onClick={() => setMode("setup")}
              >
                Setup · Equipos
              </button>
            </div>

            {mode === "op" ? (
              <div className="opr-filter">
                <button
                  type="button"
                  className={filter === "all" ? "is-on" : ""}
                  onClick={() => setFilter("all")}
                >
                  Todos <span className="c">{totalTeams}</span>
                </button>
                <button
                  type="button"
                  className={filter === "pending" ? "is-on" : ""}
                  onClick={() => setFilter("pending")}
                >
                  Pendientes <span className="c">{pendingCount}</span>
                </button>
              </div>
            ) : null}
          </div>

          {/* ---- Chips de pendientes (saltar a) ---- */}
          {mode === "op" && pendingCount > 0 ? (
            <div className="opr-chips">
              <span className="opr-chips-label">Saltar a:</span>
              {pendingTeams.map((team) => (
                <button
                  key={team.id}
                  type="button"
                  className="opr-chip"
                  onClick={() => jumpToTeam(team.id)}
                >
                  <i />
                  {team.name.replace(/^TEAM\s+/i, "")}
                </button>
              ))}
            </div>
          ) : null}

          {/* ---- OPERACIÓN: grilla de reportes ---- */}
          {mode === "op" ? (
            activeMatch ? (
              <div className="opr-grid">
                {visibleTeams.map((team) => {
                  const savedResult = activeMatchResults.find(
                    (result) => result.team_id === team.id
                  );
                  const key = getDraftKey(activeMatch.id, team.id);
                  const draft = {
                    kills: resultDrafts[key]?.kills ?? (savedResult ? String(savedResult.kills) : ""),
                    placement:
                      resultDrafts[key]?.placement ??
                      (savedResult ? String(savedResult.placement) : ""),
                  };
                  const estimatedTotal =
                    savedResult?.total_points.toFixed(1) ??
                    estimateWorldSeriesPoints(draft.kills, draft.placement);
                  const isSaved = Boolean(savedResult);
                  const hasVal = estimatedTotal != null && estimatedTotal !== "";

                  return (
                    <article
                      key={team.id}
                      id={`opr-card-${team.id}`}
                      className={`opr-card ${isSaved ? "is-saved" : "is-pending"}`}
                    >
                      <div className="opr-card-head">
                        <div>
                          <div className="opr-team-name">{team.name}</div>
                          <p className="opr-team-roster">{rosterText(team)}</p>
                        </div>
                        <span className={`opr-tag ${isSaved ? "t-saved" : "t-pending"}`}>
                          <i />
                          {isSaved ? "Guardado" : "Pendiente"}
                        </span>
                      </div>

                      <div className="opr-inputs">
                        <div className="opr-field">
                          <label>Kills</label>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={draft.kills}
                            placeholder="0"
                            onChange={(event) =>
                              onUpdateDraft(activeMatch.id, team.id, { kills: event.target.value })
                            }
                          />
                        </div>
                        <div className="opr-field">
                          <label>Placement</label>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={draft.placement}
                            placeholder="0"
                            onChange={(event) =>
                              onUpdateDraft(activeMatch.id, team.id, {
                                placement: event.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="opr-total">
                          <label>Total</label>
                          <b className={hasVal ? "has-val" : ""}>{hasVal ? estimatedTotal : "—"}</b>
                        </div>
                      </div>

                      <div className="opr-card-foot">
                        <button
                          type="button"
                          className="opr-save"
                          disabled={submitting}
                          onClick={() => onSaveTeamReport(activeMatch.id, team.id)}
                        >
                          {isSaved ? "Editar / reguardar" : "Guardar reporte"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="bf-empty">Crea el primer game para comenzar a cargar reportes.</p>
            )
          ) : null}

          {/* ---- SETUP: equipos ---- */}
          {mode === "setup" ? (
            <div className="opr-panel">
              <div className="opr-eyebrow">Equipos</div>
              <h2>Agregar equipo real</h2>
              <p className="sub">
                Carga nombre del equipo y roster real en una sola acción. Setup previo — no lo
                necesitas durante el live.
              </p>

              <form className="opr-form" onSubmit={onCreateTeam}>
                <div className="opr-field">
                  <label>Nombre del equipo</label>
                  <input
                    value={teamName}
                    onChange={(event) => onTeamNameChange(event.target.value)}
                    placeholder="Team Alpha"
                    required
                  />
                </div>
                <div className="opr-field">
                  <label>Roster</label>
                  <input
                    value={teamRoster}
                    onChange={(event) => onTeamRosterChange(event.target.value)}
                    placeholder="player1, player2, player3"
                    required
                  />
                </div>
                <button type="submit" className="opr-save" disabled={submitting}>
                  Agregar equipo
                </button>
              </form>

              {teamFormError ? <p className="bf-inline-error">{teamFormError}</p> : null}

              {teams.length > 0 ? (
                <div className="opr-teamgrid">
                  {teams.map((team) => (
                    <div key={team.id} className="opr-teamcard">
                      <div className="h">
                        <span className="n">{team.name}</span>
                        <span className="opr-tag t-saved">
                          <i />
                          {team.members.length} players
                        </span>
                      </div>
                      <span className="r">{rosterText(team)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}
