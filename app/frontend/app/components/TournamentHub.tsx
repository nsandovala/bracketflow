import { FormEventHandler } from "react";

import { Tournament } from "../../lib/api";
import { HUB_MODE_OPTIONS, HubMode, getModeLabel } from "../../lib/tournamentMode";

import ModeCard from "./ModeCard";

type TournamentHubProps = {
  backendOnline: boolean;
  message: string | null;
  tournaments: Tournament[];
  loading: boolean;
  submitting: boolean;
  selectedTournamentId: number | null;
  selectedHubMode: HubMode | null;
  tournamentName: string;
  tournamentGame: string;
  onSelectTournament: (tournamentId: number) => void;
  onSelectHubMode: (mode: HubMode) => void;
  onTournamentNameChange: (value: string) => void;
  onTournamentGameChange: (value: string) => void;
  onCreateTournament: FormEventHandler<HTMLFormElement>;
};

export default function TournamentHub({
  backendOnline,
  message,
  tournaments,
  loading,
  submitting,
  selectedTournamentId,
  selectedHubMode,
  tournamentName,
  tournamentGame,
  onSelectTournament,
  onSelectHubMode,
  onTournamentNameChange,
  onTournamentGameChange,
  onCreateTournament,
}: TournamentHubProps) {
  return (
    <main className="bf-page">
      <header className="bf-topbar">
        <div className="bf-brand">
          <h1>BracketFlow</h1>
          <p>Elige el formato competitivo y luego crea el torneo real.</p>
        </div>

        <div className={`bf-status ${backendOnline ? "is-online" : "is-offline"}`}>
          <span className="bf-status-dot" />
          {backendOnline ? "Backend online" : "Backend offline"}
        </div>
      </header>

      {message ? <p className="bf-message">{message}</p> : null}

      <section className="bf-hub-grid">
        <div className="bf-panel bf-hub-panel">
          <div className="bf-panel-head">
            <div>
              <p className="bf-kicker">Abrir</p>
              <h2>Torneos existentes</h2>
            </div>
          </div>

          {loading ? <p className="bf-empty">Cargando torneos...</p> : null}
          {!loading && tournaments.length === 0 ? (
            <p className="bf-empty">Todavia no hay torneos creados.</p>
          ) : null}

          {!loading && tournaments.length > 0 ? (
            <div className="bf-list">
              {tournaments.map((tournament) => (
                <button
                  key={tournament.id}
                  type="button"
                  className={`bf-list-card ${selectedTournamentId === tournament.id ? "is-selected" : ""}`}
                  onClick={() => onSelectTournament(tournament.id)}
                >
                  <strong>{tournament.name}</strong>
                  <span>{tournament.game}</span>
                  <small>{getModeLabel(tournament.format)}</small>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="bf-panel bf-hub-panel">
          <div className="bf-panel-head">
            <div>
              <p className="bf-kicker">Crear</p>
              <h2>Seleccion de modo</h2>
            </div>
          </div>

          <div className="bf-hub-options">
            {HUB_MODE_OPTIONS.map((option, index) => (
              <ModeCard
                key={option.id}
                index={index + 1}
                label={option.label}
                description={option.description}
                selected={selectedHubMode === option.id}
                disabled={option.disabled}
                badge={option.comingSoonLabel}
                onSelect={() => onSelectHubMode(option.id)}
              />
            ))}
          </div>

          {selectedHubMode && selectedHubMode !== "league-round-robin" ? (
            <form className="bf-form bf-hub-form" onSubmit={onCreateTournament}>
              <div className="bf-form-grid">
                <label className="bf-field">
                  <span>Nombre del torneo</span>
                  <input
                    value={tournamentName}
                    onChange={(event) => onTournamentNameChange(event.target.value)}
                    placeholder="Torneo Warzone"
                    required
                  />
                </label>

                <label className="bf-field">
                  <span>Juego</span>
                  <input
                    value={tournamentGame}
                    onChange={(event) => onTournamentGameChange(event.target.value)}
                    placeholder="Warzone"
                    required
                  />
                </label>
              </div>

              <button type="submit" className="bf-button bf-button-primary" disabled={submitting}>
                {submitting ? "Creando..." : "Crear torneo"}
              </button>
            </form>
          ) : null}

          {!selectedHubMode ? (
            <p className="bf-empty">Selecciona un modo para mostrar el formulario minimo.</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
