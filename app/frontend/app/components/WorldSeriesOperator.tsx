"use client";

import { FormEventHandler, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Match, Player, Team, TeamResultDetail, Tournament } from "../../lib/api";
import { estimateWorldSeriesPoints } from "../../lib/tournamentMode";
import { getEffectiveLobbySize, ResolvedTournamentEngine } from "../../lib/tournamentModel";
import { getTournamentPhase, isTournamentCompleted, findChampion } from "../../lib/tournamentStatus";
import { KillRaceMapDraft, ResultDraft } from "../lib/useWorldSeriesPractice";
import BracketView from "./BracketView";
import RouletteArena from "./RouletteArena";

type WorldSeriesOperatorProps = {
  backendOnline: boolean;
  message: string | null;
  tournaments: Tournament[];
  selectedTournamentId: number | null;
  selectedTournament: Tournament | null;
  teams: Team[];
  matches: Match[];
  players: Player[];
  activeMatch: Match | null;
  activeMatchResults: TeamResultDetail[];
  pendingTeams: Team[];
  reportsLoaded: number;
  totalTeams: number;
  latestReportedRound: number;
  canCreateNextGame: boolean;
  selectedEngine: ResolvedTournamentEngine | null;
  nextGameNumber: number;
  submitting: boolean;
  teamName: string;
  teamRoster: string;
  teamFormError: string | null;
  resultDrafts: Record<string, ResultDraft>;
  killRaceMapDrafts: Record<number, KillRaceMapDraft>;
  onSelectTournament: (tournamentId: number) => void;
  onTeamNameChange: (value: string) => void;
  onTeamRosterChange: (value: string) => void;
  onCreateTeam: FormEventHandler<HTMLFormElement>;
  onImportParticipants: (nicknames: string[]) => Promise<unknown>;
  onRemoveParticipant: (playerId: number) => Promise<unknown>;
  onClearParticipants: () => Promise<unknown>;
  onGenerateRoulette: (shuffleSeed?: string | number) => Promise<unknown>;
  onOpenRosterRespin: (durationMinutes: number) => Promise<unknown>;
  onLockRosterRespin: () => Promise<unknown>;
  onGenerateBracket: () => Promise<unknown>;
  onOpenBracketRespin: (durationMinutes: number) => Promise<unknown>;
  onLockBracketRespin: () => Promise<unknown>;
  onUpdateDraft: (matchId: number, teamId: number, patch: Partial<ResultDraft>) => void;
  onUpdateKillRaceMapDraft: (matchId: number, patch: Partial<KillRaceMapDraft>) => void;
  onSaveTeamReport: (matchId: number, teamId: number) => void;
  onSaveKillRaceMap: (matchId: number) => void;
  onCreateNextGame: () => void;
  onBulkImportTeams?: (teams: Array<{ name: string; roster: string }>) => Promise<unknown>;
};

type OperatorMode = "op" | "setup" | "bracket";
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

function formatCountdown(deadline: string | null, now: number) {
  if (!deadline) {
    return null;
  }
  const diffMs = new Date(deadline).getTime() - now;
  if (diffMs <= 0) {
    return "00:00";
  }
  const totalSeconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function WorldSeriesOperator({
  backendOnline,
  message,
  tournaments,
  selectedTournamentId,
  selectedTournament,
  teams,
  matches,
  players,
  activeMatch,
  activeMatchResults,
  pendingTeams,
  reportsLoaded,
  totalTeams,
  latestReportedRound,
  canCreateNextGame,
  selectedEngine,
  nextGameNumber,
  submitting,
  teamName,
  teamRoster,
  teamFormError,
  resultDrafts,
  killRaceMapDrafts,
  onSelectTournament,
  onTeamNameChange,
  onTeamRosterChange,
  onCreateTeam,
  onImportParticipants,
  onRemoveParticipant,
  onClearParticipants,
  onGenerateRoulette,
  onOpenRosterRespin,
  onLockRosterRespin,
  onGenerateBracket,
  onOpenBracketRespin,
  onLockBracketRespin,
  onUpdateDraft,
  onUpdateKillRaceMapDraft,
  onSaveTeamReport,
  onSaveKillRaceMap,
  onCreateNextGame,
  onBulkImportTeams,
}: WorldSeriesOperatorProps) {
  const searchParams = useSearchParams();
  const [now, setNow] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const [mode, setMode] = useState<OperatorMode>(
    searchParams.get("roulette") === "1"
      ? "setup"
      : searchParams.get("tab") === "bracket"
        ? "bracket"
        : "op"
  );
  const [filter, setFilter] = useState<ResultFilter>("all");
  const [teamImportMessage, setTeamImportMessage] = useState<string | null>(null);
  const teamFileInputRef = useRef<HTMLInputElement>(null);

  const currentGame = activeMatch ? activeMatch.round : nextGameNumber;
  const pendingCount = pendingTeams.length;
  const progressPct = totalTeams > 0 ? (reportsLoaded / totalTeams) * 100 : 0;
  const visibleTeams = filter === "pending" ? pendingTeams : teams;
  const usesPlacement = selectedEngine?.usesPlacement ?? true;
  const isKillRace = selectedEngine?.scoringProfile === "kill_race";
  const requiresRoulette = selectedEngine?.rosterPolicy === "roulette";
  const canRegenerateRoulette = latestReportedRound === 0;
  const effectiveLobbySize = selectedEngine
    ? getEffectiveLobbySize(selectedEngine, totalTeams)
    : totalTeams;

  const gameStats = useMemo(() => {
    if (activeMatchResults.length === 0) {
      return null;
    }
    const leader = activeMatchResults.reduce((best, result) =>
      result.total_points > best.total_points ? result : best
    );
    const totalKills = activeMatchResults.reduce((sum, result) => sum + result.kills, 0);
    const bestPlacement = activeMatchResults.reduce(
      (min, result) => (result.placement < min ? result.placement : min),
      activeMatchResults[0].placement
    );
    const bestPlacementResult = activeMatchResults.find(
      (result) => result.placement === bestPlacement
    );
    return { leader, totalKills, bestPlacement, bestPlacementResult };
  }, [activeMatchResults]);

  const leaderTeam = gameStats
    ? teams.find((team) => team.id === gameStats.leader.team_id)
    : undefined;
  const activeMatchTeamA = activeMatch?.team_a_id
    ? teams.find((team) => team.id === activeMatch.team_a_id) ?? null
    : null;
  const activeMatchTeamB = activeMatch?.team_b_id
    ? teams.find((team) => team.id === activeMatch.team_b_id) ?? null
    : null;
  const bracketCountdown = formatCountdown(
    selectedTournament?.bracket_respin_deadline_at ?? null,
    now
  );
  const bracketOpen =
    selectedTournament?.bracket_status === "respin_open" && bracketCountdown !== "00:00";
  const killRaceDraft = activeMatch
    ? killRaceMapDrafts[activeMatch.id] ?? {
        mapNumber: String(Math.min(activeMatch.maps.length + 1, activeMatch.best_of)),
        killsA: "",
        killsB: "",
      }
    : null;

  return (
    <main className="bf-page bf-page-operator">
      <div className="opr-amb" aria-hidden="true" />

      {message ? <p className="bf-message">{message}</p> : null}

      {!selectedTournament ? (
        <p className="bf-empty">No hay torneo seleccionado.</p>
      ) : totalTeams === 0 && requiresRoulette && selectedEngine ? (
        <>
          {/* No duplicar el H1 en titulos internos. */}
          <div className="opr-controls bf-roulette-tabs">
            <div className="opr-seg">
              <button type="button" className="is-on">
                Setup de ruleta
              </button>
              <button type="button" disabled>
                Operación
              </button>
            </div>
          </div>
          <RouletteArena
            tournament={selectedTournament}
            engine={selectedEngine}
            players={players}
            teams={teams}
            submitting={submitting}
            onImportParticipants={onImportParticipants}
            onRemoveParticipant={onRemoveParticipant}
            onClearParticipants={onClearParticipants}
            onConfirmRoulette={onGenerateRoulette}
            onOpenRosterRespin={onOpenRosterRespin}
            onLockRosterRespin={onLockRosterRespin}
            canRegenerate={canRegenerateRoulette}
          />
        </>
      ) : totalTeams === 0 ? (
        <section className="opr-panel">
          <div className="opr-eyebrow">Setup requerido</div>
          <h2>Agrega equipos antes de operar la partida.</h2>
          <p className="sub">
            Primero deja listo el roster del torneo. Despues vuelve a Operator para cargar resultados.
          </p>
          <div className="bf-hub-form-actions">
            <button
              type="button"
              className="bf-button bf-button-primary"
              onClick={() => setMode("setup")}
            >
              Configurar equipos
            </button>
            <Link href="/torneos" className="bf-button bf-button-ghost">
              Volver a Torneos
            </Link>
          </div>

          {mode === "setup" && !requiresRoulette ? (
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
          ) : null}

          {!requiresRoulette && teamFormError ? <p className="bf-inline-error">{teamFormError}</p> : null}
        </section>
      ) : isKillRace ? (
        <>
          {/* ---- Context bar sticky ---- */}
          <div className="opr-context-bar">
            <div className="opr-context-main">
              <button
                type="button"
                className="opr-context-back"
                onClick={() => {
                  if (mode === "bracket" || mode === "op") {
                    // Si ya estamos en bracket, ir a standings
                    window.location.href = `/standings?tournamentId=${selectedTournament?.id ?? ""}`;
                  } else {
                    setMode("bracket");
                  }
                }}
              >
                ← Volver al bracket
              </button>
              <div className="opr-context-info">
                <strong>{selectedTournament?.name ?? "Torneo"}</strong>
                <span className="opr-context-sep">·</span>
                <span className="opr-context-phase">
                  {getTournamentPhase(matches, selectedTournament?.status)}
                </span>
                {isTournamentCompleted(matches) ? (
                  <>
                    <span className="opr-context-sep">·</span>
                    <span className="opr-context-champion">
                      Campeón: {findChampion(matches, teams)?.team.name ?? "—"}
                    </span>
                  </>
                ) : null}
              </div>
            </div>
          </div>

        <section className="opr-panel">
          <div className="opr-eyebrow">Kill Race · {selectedEngine?.teamSize ?? 2}v{selectedEngine?.teamSize ?? 2}</div>
          <h2>Bracket</h2>
          <p className="sub">
            {totalTeams > 0
              ? `${totalTeams} equipos de ${selectedEngine?.teamSize ?? 2} jugadores. Serie BO3: gana quien tenga más kills por mapa. Primero a 2 mapas avanza.`
              : "Falta generar equipos. Ve a Setup de ruleta para cargar participantes."}
          </p>

          <div className="opr-stats">
            <div className="opr-stat">
              <span className="opr-stat-ico" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h10"/></svg>
              </span>
              <div className="opr-stat-body">
                <div className="opr-stat-label">Regla de avance</div>
                <div className="opr-stat-value">Más kills</div>
                <div className="opr-stat-sub">Sin placement</div>
              </div>
            </div>
            <div className="opr-stat">
              <span className="opr-stat-ico" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16"/><path d="M4 12h10"/><path d="M4 19h7"/></svg>
              </span>
              <div className="opr-stat-body">
                <div className="opr-stat-label">Formato</div>
                <div className="opr-stat-value">Seed listo</div>
                <div className="opr-stat-sub">
                  {selectedEngine?.tournamentStructure === "double_elim"
                    ? "Double elim"
                    : "Single elim"}
                </div>
              </div>
            </div>
          </div>

          <div className="opr-controls">
            <div className="opr-seg">
              <button
                type="button"
                className={mode === "bracket" || mode === "op" ? "is-on" : ""}
                onClick={() => setMode("bracket")}
              >
                Bracket
              </button>
              <button
                type="button"
                className={mode === "setup" ? "is-on" : ""}
                onClick={() => setMode("setup")}
              >
                Setup
              </button>
            </div>
          </div>

          {mode === "bracket" || mode === "op" ? (
            <BracketView
              tournament={selectedTournament}
              engine={selectedEngine}
              teams={teams}
              matches={matches}
              mode="operator"
            />
          ) : null}

          {(mode === "bracket" || mode === "op") && matches.length === 0 ? (
            <section className="opr-panel">
              <div className="opr-eyebrow">Bracket respin</div>
              <h2>Semilla persistida</h2>
              <p className="sub">
                {selectedTournament.roster_status !== "locked"
                  ? "Primero bloquea el roster para habilitar el bracket."
                  : bracketOpen
                    ? `Ventana abierta. El contador vive en DB y no se reinicia con F5: ${bracketCountdown}.`
                    : selectedTournament.bracket_status === "locked"
                      ? "Bracket locked. No se aceptan respins posteriores."
                      : selectedTournament.bracket_status === "running"
                        ? "Bracket running. La llave ya no se puede regenerar."
                        : selectedTournament.bracket_status === "completed"
                          ? "Bracket completed."
                          : "Abre una ventana de respin para generar o regenerar la llave."}
              </p>

              {selectedTournament.roster_status === "locked" &&
              selectedTournament.bracket_status === "pending" ? (
                <div className="bf-hub-form-actions">
                  {[3, 4, 5].map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      className="bf-button bf-button-primary"
                      disabled={submitting}
                      onClick={() => void onOpenBracketRespin(minutes)}
                    >
                      Abrir respin {minutes} min
                    </button>
                  ))}
                </div>
              ) : null}

              {bracketOpen ? (
                <div className="bf-hub-form-actions">
                  <button
                    type="button"
                    className="opr-save"
                    disabled={submitting}
                    onClick={() => void onGenerateBracket()}
                  >
                    Generar bracket
                  </button>
                  <button
                    type="button"
                    className="bf-button bf-button-ghost"
                    disabled={submitting}
                    onClick={() => void onLockBracketRespin()}
                  >
                    Locked bracket ahora
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}

          {mode !== "setup" ? (
            activeMatch && activeMatchTeamA && activeMatchTeamB ? (
              <section className="opr-panel">
                <div className="opr-eyebrow">Serie actual</div>
                <h2>{activeMatchTeamA.name} vs {activeMatchTeamB.name}</h2>
                <p className="sub">
                  Match {activeMatch.id} · Round {activeMatch.round} · BO{activeMatch.best_of} · Serie {activeMatch.maps_won_a}-{activeMatch.maps_won_b}
                </p>

                <div className="opr-teamgrid">
                  <div className="opr-teamcard">
                    <div className="h">
                      <span className="n">{activeMatchTeamA.name}</span>
                      <span className="opr-tag t-saved">
                        <i />
                        {activeMatch.maps_won_a} mapas
                      </span>
                    </div>
                    <span className="r">{rosterText(activeMatchTeamA)}</span>
                  </div>
                  <div className="opr-teamcard">
                    <div className="h">
                      <span className="n">{activeMatchTeamB.name}</span>
                      <span className="opr-tag t-saved">
                        <i />
                        {activeMatch.maps_won_b} mapas
                      </span>
                    </div>
                    <span className="r">{rosterText(activeMatchTeamB)}</span>
                  </div>
                </div>

                <div className="opr-inputs">
                  <div className="opr-field">
                    <label>Mapa</label>
                    <input
                      type="number"
                      min="1"
                      max={activeMatch.best_of}
                      value={killRaceDraft?.mapNumber ?? ""}
                      onChange={(event) =>
                        onUpdateKillRaceMapDraft(activeMatch.id, { mapNumber: event.target.value })
                      }
                    />
                  </div>
                  <div className="opr-field">
                    <label>Kills A</label>
                    <input
                      type="number"
                      min="0"
                      value={killRaceDraft?.killsA ?? ""}
                      onChange={(event) =>
                        onUpdateKillRaceMapDraft(activeMatch.id, { killsA: event.target.value })
                      }
                    />
                  </div>
                  <div className="opr-field">
                    <label>Kills B</label>
                    <input
                      type="number"
                      min="0"
                      value={killRaceDraft?.killsB ?? ""}
                      onChange={(event) =>
                        onUpdateKillRaceMapDraft(activeMatch.id, { killsB: event.target.value })
                      }
                    />
                  </div>
                  <div className="opr-total">
                    <label>Estado</label>
                    <b className="has-val">{activeMatch.maps_won_a}-{activeMatch.maps_won_b}</b>
                  </div>
                </div>

                {activeMatch.maps.length > 0 ? (
                  <div className="opr-teamgrid">
                    {activeMatch.maps
                      .slice()
                      .sort((left, right) => left.map_number - right.map_number)
                      .map((map) => (
                        <div key={map.id} className="opr-teamcard">
                          <div className="h">
                            <span className="n">Mapa {map.map_number}</span>
                            <span className="opr-tag t-saved">
                              <i />
                              {map.kills_a}-{map.kills_b}
                            </span>
                          </div>
                          <span className="r">
                            {map.map_winner_id === activeMatch.team_a_id
                              ? `Gana ${activeMatchTeamA.name}`
                              : `Gana ${activeMatchTeamB.name}`}
                          </span>
                        </div>
                      ))}
                  </div>
                ) : null}

                <div className="bf-hub-form-actions">
                  <button
                    type="button"
                    className="opr-save"
                    disabled={submitting || activeMatch.status === "completed"}
                    onClick={() => onSaveKillRaceMap(activeMatch.id)}
                  >
                    {activeMatch.status === "completed" ? "Serie finalizada" : "Guardar mapa"}
                  </button>
                </div>
              </section>
            ) : (
              <section className="opr-panel">
                {isTournamentCompleted(matches) ? (
                  <>
                    <div className="opr-eyebrow">Torneo finalizado</div>
                    <h2>Campeón: {findChampion(matches, teams)?.team.name ?? "—"}</h2>
                    <p className="sub">
                      No quedan series pendientes. El bracket está completo.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="opr-eyebrow">Serie actual</div>
                    <h2>Bracket listo para operar</h2>
                    <p className="sub">
                      {matches.length === 0
                        ? "Genera la llave para habilitar el BO3."
                        : "No hay un match con dos equipos listos en este momento."}
                    </p>
                  </>
                )}
                {matches.length === 0 && !isTournamentCompleted(matches) ? (
                  <div className="bf-hub-form-actions">
                    <span className="bf-empty">
                      Abre respin de bracket para generar la llave.
                    </span>
                  </div>
                ) : null}
              </section>
            )
          ) : null}

          {mode === "setup" ? (
            selectedEngine ? (
              <RouletteArena
                tournament={selectedTournament}
                engine={selectedEngine}
                players={players}
                teams={teams}
                submitting={submitting}
                onImportParticipants={onImportParticipants}
                onRemoveParticipant={onRemoveParticipant}
                onClearParticipants={onClearParticipants}
                onConfirmRoulette={onGenerateRoulette}
                onOpenRosterRespin={onOpenRosterRespin}
                onLockRosterRespin={onLockRosterRespin}
                canRegenerate={canRegenerateRoulette}
              />
            ) : null
          ) : null}
        </section>
        </>
      ) : (
        <>
          {/* ---- Command bar ---- */}
          {requiresRoulette ? (
            <section className="opr-panel">
              <div className="opr-eyebrow">Equipos generados por ruleta</div>
              <h2>Listo para operar</h2>
              <p className="sub">
                La ruleta confirmó {totalTeams} equipos. Ya puedes crear partida y cargar resultados.
              </p>
            </section>
          ) : null}

          <section className="opr-command">
            <div className="opr-game">
              <div>
                <div className="eye">Operando</div>
                <strong>Partida {currentGame}</strong>
              </div>
              <span className="t">{totalTeams} equipos</span>
              <span className="t">{selectedEngine?.label ?? "World Series BR"}</span>
              <span className="t">
                {selectedEngine?.scoringProfile === "kill_race"
                  ? "Kill race"
                  : `Lobby ${effectiveLobbySize}`}
              </span>
              {usesPlacement && selectedEngine?.requiresUniquePlacement ? (
                <span className="t">Placement unico</span>
              ) : null}
              {selectedEngine?.rosterPolicy === "roulette" ? (
                <span className="t">Roster policy: roulette</span>
              ) : null}
              {selectedEngine?.engineKey === "roulette_ws" ? (
                <span className="t">Scoring profile: wsow_like</span>
              ) : null}
            </div>

            <div className="opr-progress">
              <div className="opr-progress-top">
                <span>Reportes de la partida</span>
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
              Crear Partida {nextGameNumber} <span className="arrow">→</span>
            </button>
          </section>

          <div className="opr-stats">
            <div className={`opr-stat${gameStats ? "" : " is-empty"}`}>
              <span className="opr-stat-ico" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
              </span>
              <div className="opr-stat-body">
                <div className="opr-stat-label">Líder de la partida</div>
                <div className="opr-stat-value">
                  {gameStats ? (
                    <>
                      {gameStats.leader.team_name} · <em>{gameStats.leader.total_points.toFixed(1)}</em> pts
                    </>
                  ) : (
                    "—"
                  )}
                </div>
                {gameStats && leaderTeam ? (
                  <div className="opr-stat-sub">{rosterText(leaderTeam)}</div>
                ) : null}
              </div>
            </div>

            <div className={`opr-stat${gameStats ? "" : " is-empty"}`}>
              <span className="opr-stat-ico" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 13c0-1 1-2 2-2s2 1 2 2-1 5 5 5 5-4 5-5 1-2 2-2 2 1 2 2c0 3.5-3 6-9 6s-9-2.5-9-6Z"/><path d="M12 2v4"/><path d="m4.93 6.93 1.41 1.41"/><path d="m17.66 8.34 1.41-1.41"/></svg>
              </span>
              <div className="opr-stat-body">
                <div className="opr-stat-label">Kills totales de la partida</div>
                <div className="opr-stat-value">{gameStats ? gameStats.totalKills : "—"}</div>
                {gameStats ? (
                  <div className="opr-stat-sub">sumados de {activeMatchResults.length} reportes</div>
                ) : null}
              </div>
            </div>

            {usesPlacement ? (
              <div className={`opr-stat${gameStats ? "" : " is-empty"}`}>
                <span className="opr-stat-ico" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v8"/><path d="M22 22H2"/><path d="m8 6 4-4 4 4"/><path d="M16 18a4 4 0 0 0-8 0"/></svg>
                </span>
                <div className="opr-stat-body">
                  <div className="opr-stat-label">Mejor placement reportado</div>
                  <div className="opr-stat-value">
                    {gameStats ? <em>#{gameStats.bestPlacement}</em> : "—"}
                  </div>
                  {gameStats && gameStats.bestPlacementResult ? (
                    <div className="opr-stat-sub">por {gameStats.bestPlacementResult.team_name}</div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className={`opr-stat${gameStats ? "" : " is-empty"}`}>
                <span className="opr-stat-ico" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h10"/></svg>
                </span>
                <div className="opr-stat-body">
                  <div className="opr-stat-label">Regla de avance</div>
                  <div className="opr-stat-value">Más kills</div>
                  <div className="opr-stat-sub">Empates requieren desempate manual</div>
                </div>
              </div>
            )}
          </div>

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
                {requiresRoulette ? "Setup de ruleta" : "Equipos & Roster"}
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
                    (usesPlacement
                      ? estimateWorldSeriesPoints(
                          draft.kills,
                          draft.placement,
                          totalTeams
                        )
                      : draft.kills);
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
                        {usesPlacement ? (
                          <div className="opr-field">
                            <label>Placement</label>
                            <input
                              type="number"
                              inputMode="numeric"
                              value={draft.placement}
                              placeholder={`1-${effectiveLobbySize}`}
                              onChange={(event) =>
                                onUpdateDraft(activeMatch.id, team.id, {
                                  placement: event.target.value,
                                })
                              }
                            />
                          </div>
                        ) : null}
                        <div className="opr-total">
                          <label>{usesPlacement ? "Total" : "Kills"}</label>
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
                          {isSaved ? "Editar" : "Guardar reporte"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="bf-empty">Crea la primera partida para comenzar a cargar reportes.</p>
            )
          ) : null}

          {/* ---- SETUP: equipos ---- */}
          {mode === "setup" ? (
            requiresRoulette && selectedEngine ? (
              <RouletteArena
                tournament={selectedTournament}
                engine={selectedEngine}
                players={players}
                teams={teams}
                submitting={submitting}
                onImportParticipants={onImportParticipants}
                onRemoveParticipant={onRemoveParticipant}
                onClearParticipants={onClearParticipants}
                onConfirmRoulette={onGenerateRoulette}
                onOpenRosterRespin={onOpenRosterRespin}
                onLockRosterRespin={onLockRosterRespin}
                canRegenerate={canRegenerateRoulette}
              />
            ) : (
            <div className="opr-panel">
              <div className="opr-eyebrow">Equipos</div>
              <h2>Agregar equipo real</h2>
              <p className="sub">
                Carga nombre del equipo y roster real en una sola acción. O importa un archivo .txt/.csv con el formato: Equipo,Jugador1,Jugador2,Jugador3,Jugador4
              </p>

              <input
                ref={teamFileInputRef}
                type="file"
                accept=".txt,.csv,text/plain,text/csv"
                className="bf-roulette-file-input"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file || !onBulkImportTeams) return;
                  const text = await file.text();
                  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
                  const parsed: Array<{ name: string; roster: string }> = [];
                  for (const line of lines) {
                    const parts = line.split(/,\s*|,/);
                    if (parts.length < 2) continue;
                    const name = parts[0].trim();
                    const roster = parts.slice(1).map((p) => p.trim()).filter(Boolean).join(", ");
                    if (name && roster) parsed.push({ name, roster });
                  }
                  if (parsed.length === 0) {
                    setTeamImportMessage("No se detectaron equipos válidos. Formato esperado: Equipo,Jugador1,Jugador2...");
                    return;
                  }
                  await onBulkImportTeams(parsed);
                  setTeamImportMessage(`${parsed.length} equipo(s) importado(s).`);
                  if (teamFileInputRef.current) teamFileInputRef.current.value = "";
                }}
                disabled={submitting}
              />
              <div className="bf-hub-form-actions" style={{ marginBottom: 14 }}>
                <button
                  type="button"
                  className="bf-button bf-button-ghost"
                  onClick={() => teamFileInputRef.current?.click()}
                  disabled={submitting || !onBulkImportTeams}
                >
                  Importar equipos .txt/.csv
                </button>
                {teamImportMessage ? (
                  <span className="bf-inline-note">{teamImportMessage}</span>
                ) : null}
              </div>

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
            )
          ) : null}
        </>
      )}
    </main>
  );
}
