import { FormEventHandler } from "react";

import { Match, Team, TeamResultDetail, Tournament } from "../../lib/api";
import { estimateWorldSeriesPoints } from "../../lib/tournamentMode";
import { ResultDraft } from "../lib/useWorldSeriesPractice";

import AppTopbar from "./AppTopbar";
import GlassPanel from "./GlassPanel";
import PendingReports from "./PendingReports";
import SectionHeader from "./SectionHeader";
import StatusBadge from "./StatusBadge";
import TeamResultForm from "./TeamResultForm";

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

function getDraftKey(matchId: number, teamId: number) {
  return `${matchId}:${teamId}`;
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

  return (
    <main className="bf-page bf-page-operator">
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
        <GlassPanel className="bf-main-panel">
          <p className="bf-empty">No hay torneo World Series Practice seleccionado.</p>
        </GlassPanel>
      ) : (
        <div className="bf-operator-grid">
          <section className="bf-stack">
            <GlassPanel className="bf-main-panel">
              <SectionHeader
                eyebrow="Operator View"
                title={activeMatch ? `Game ${activeMatch.round}` : `Game ${nextGameNumber}`}
                subtitle="Cabina de control para cargar resultados, revisar pendientes y avanzar al siguiente game."
              />

              <div className="bf-hero-metrics">
                <div className="bf-hero-stat">
                  <span>Torneo activo</span>
                  <strong>{selectedTournament.name}</strong>
                </div>
                <div className="bf-hero-stat">
                  <span>Equipos</span>
                  <strong>{teams.length}</strong>
                </div>
                <div className="bf-hero-stat">
                  <span>Reportes</span>
                  <strong>
                    {reportsLoaded}/{totalTeams}
                  </strong>
                </div>
                <div className="bf-hero-stat">
                  <span>Pendientes</span>
                  <strong>{pendingTeams.length}</strong>
                </div>
              </div>

              <div className="bf-chip-cloud">
                <StatusBadge tone="live" label="World Series Practice" />
                <StatusBadge
                  tone={pendingTeams.length > 0 ? "pending" : "success"}
                  label={activeMatch ? `Game ${activeMatch.round}` : "Sin game activo"}
                />
                <StatusBadge tone="neutral" label={`${teams.length} equipos`} />
              </div>
            </GlassPanel>

            <GlassPanel className="bf-main-panel">
              <SectionHeader
                eyebrow="Equipos"
                title="Agregar equipo real"
                subtitle="Carga nombre del equipo y roster real en una sola accion."
              />

              <form className="bf-form" onSubmit={onCreateTeam}>
                <div className="bf-form-grid">
                  <label className="bf-field">
                    <span>Nombre del equipo</span>
                    <input
                      value={teamName}
                      onChange={(event) => onTeamNameChange(event.target.value)}
                      placeholder="Team Alpha"
                      required
                    />
                  </label>

                  <label className="bf-field">
                    <span>Roster</span>
                    <input
                      value={teamRoster}
                      onChange={(event) => onTeamRosterChange(event.target.value)}
                      placeholder="player1, player2, player3, player4"
                      required
                    />
                  </label>
                </div>

                <div className="bf-inline-actions">
                  <button type="submit" className="bf-button bf-button-primary" disabled={submitting}>
                    Agregar equipo
                  </button>
                  {teamFormError ? <p className="bf-inline-error">{teamFormError}</p> : null}
                </div>
              </form>

              {teams.length > 0 ? (
                <div className="bf-team-grid">
                  {teams.map((team) => (
                    <article key={team.id} className="bf-team-card">
                      <div className="bf-team-head">
                        <strong>{team.name}</strong>
                        <StatusBadge
                          tone={team.members.length > 0 ? "success" : "pending"}
                          label={`${team.members.length} players`}
                        />
                      </div>
                      <p className="bf-team-roster">
                        {team.members.length > 0
                          ? team.members.map((member) => member.player.nickname).join(" / ")
                          : "Roster pendiente"}
                      </p>
                    </article>
                  ))}
                </div>
              ) : null}
            </GlassPanel>

            <GlassPanel className="bf-main-panel">
              <SectionHeader
                eyebrow="Resultados"
                title={activeMatch ? `Cargar Game ${activeMatch.round}` : "Esperando game"}
                subtitle="Guarda kills, placement y total calculado por equipo."
              />

              {activeMatch ? (
                <div className="bf-results-grid">
                  {teams.map((team) => {
                    const savedResult = activeMatchResults.find((result) => result.team_id === team.id);
                    const key = getDraftKey(activeMatch.id, team.id);
                    const draft = {
                      kills: resultDrafts[key]?.kills ?? (savedResult ? String(savedResult.kills) : ""),
                      placement:
                        resultDrafts[key]?.placement ?? (savedResult ? String(savedResult.placement) : ""),
                    };
                    const estimatedTotal =
                      savedResult?.total_points.toFixed(1) ??
                      estimateWorldSeriesPoints(draft.kills, draft.placement);

                    return (
                      <TeamResultForm
                        key={team.id}
                        team={team}
                        draft={draft}
                        savedResult={savedResult}
                        estimatedTotal={estimatedTotal}
                        submitting={submitting}
                        onKillsChange={(value) =>
                          onUpdateDraft(activeMatch.id, team.id, { kills: value })
                        }
                        onPlacementChange={(value) =>
                          onUpdateDraft(activeMatch.id, team.id, { placement: value })
                        }
                        onSave={() => onSaveTeamReport(activeMatch.id, team.id)}
                      />
                    );
                  })}
                </div>
              ) : (
                <p className="bf-empty">Crea el primer game para comenzar a cargar reportes.</p>
              )}
            </GlassPanel>
          </section>

          <PendingReports
            currentGameNumber={activeMatch?.round ?? 0}
            reportsLoaded={reportsLoaded}
            totalTeams={totalTeams}
            pendingTeams={pendingTeams}
            canCreateNextGame={canCreateNextGame}
            nextGameNumber={nextGameNumber}
            submitting={submitting}
            tournamentQuery={tournamentQuery}
            onCreateNextGame={onCreateNextGame}
          />
        </div>
      )}
    </main>
  );
}
