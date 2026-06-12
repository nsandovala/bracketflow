import { ReactNode } from "react";

import { Tournament, TournamentFormat } from "../../lib/api";

import StatusStepper, { StatusStep } from "./StatusStepper";
import TournamentSummary from "./TournamentSummary";

type ModeShellProps = {
  backendOnline: boolean;
  message: string | null;
  tournaments: Tournament[];
  loading: boolean;
  selectedTournamentId: number | null;
  selectedTournament: Tournament;
  getFormatLabel: (format: TournamentFormat) => string;
  onSelectTournament: (tournamentId: number) => void;
  steps: StatusStep[];
  participantsRequired: string;
  teamsCount: number;
  roundsCount: number;
  resultsCount: number;
  nextAction: string;
  children: ReactNode;
};

export default function ModeShell({
  backendOnline,
  message,
  tournaments,
  loading,
  selectedTournamentId,
  selectedTournament,
  getFormatLabel,
  onSelectTournament,
  steps,
  participantsRequired,
  teamsCount,
  roundsCount,
  resultsCount,
  nextAction,
  children,
}: ModeShellProps) {
  return (
    <main className="bf-page">
      <header className="bf-topbar">
        <div className="bf-brand">
          <h1>BracketFlow</h1>
          <p>Torneo activo · {selectedTournament.name}</p>
        </div>

        <div className="bf-topbar-controls">
          <label className="bf-field">
            <span>Torneo activo</span>
            <select
              value={selectedTournamentId ?? ""}
              onChange={(event) => onSelectTournament(Number(event.target.value))}
              disabled={loading || tournaments.length === 0}
            >
              {tournaments.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>
                  {tournament.name} · {getFormatLabel(tournament.format)}
                </option>
              ))}
            </select>
          </label>

          <div className={`bf-status ${backendOnline ? "is-online" : "is-offline"}`}>
            <span className="bf-status-dot" />
            {backendOnline ? "Backend online" : "Backend offline"}
          </div>
        </div>
      </header>

      {message ? <p className="bf-message">{message}</p> : null}

      <div className="bf-mode-grid">
        <section className="bf-mode-main">
          <StatusStepper steps={steps} />
          <div className="bf-panel bf-main-panel">{children}</div>
        </section>

        <TournamentSummary
          formatLabel={getFormatLabel(selectedTournament.format)}
          participantsRequired={participantsRequired}
          teamsCount={teamsCount}
          roundsCount={roundsCount}
          resultsCount={resultsCount}
          nextAction={nextAction}
        />
      </div>
    </main>
  );
}
