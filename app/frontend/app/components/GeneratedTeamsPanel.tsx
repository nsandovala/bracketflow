import { Player, Team } from "../../lib/api";

import TeamsSnapshot from "./TeamsSnapshot";

type GeneratedTeamsPanelProps = {
  canResort: boolean;
  submitting: boolean;
  teams: Team[];
  rouletteBench: Player[];
  onGenerateRoulette: () => void;
};

export default function GeneratedTeamsPanel({
  canResort,
  submitting,
  teams,
  rouletteBench,
  onGenerateRoulette,
}: GeneratedTeamsPanelProps) {
  return (
    <section className="bf-secondary-section">
      <div className="bf-panel">
        <div className="bf-panel-header">
          <div>
            <p className="bf-eyebrow">Resultado</p>
            <h2>Equipos generados</h2>
          </div>
          {canResort ? (
            <button
              type="button"
              className="bf-button bf-cta-secondary"
              onClick={onGenerateRoulette}
              disabled={submitting}
            >
              Volver a sortear
            </button>
          ) : null}
        </div>
        <TeamsSnapshot teams={teams} rouletteBench={rouletteBench} animated />
      </div>
    </section>
  );
}
