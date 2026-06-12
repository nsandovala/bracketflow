import { Team, TeamResultDetail } from "../../lib/api";

import GlassPanel from "./GlassPanel";
import StatusBadge from "./StatusBadge";

type TeamResultFormProps = {
  team: Team;
  draft: {
    kills: string;
    placement: string;
  };
  savedResult?: TeamResultDetail;
  estimatedTotal: string | null;
  submitting: boolean;
  onKillsChange: (value: string) => void;
  onPlacementChange: (value: string) => void;
  onSave: () => void;
};

export default function TeamResultForm({
  team,
  draft,
  savedResult,
  estimatedTotal,
  submitting,
  onKillsChange,
  onPlacementChange,
  onSave,
}: TeamResultFormProps) {
  return (
    <GlassPanel as="article" className="bf-team-result-card">
      <div className="bf-result-card-head">
        <div className="bf-result-card-copy">
          <strong>{team.name}</strong>
          <p>
            {team.members.length > 0
              ? team.members.map((member) => member.player.nickname).join(" / ")
              : "Roster pendiente"}
          </p>
        </div>
        <StatusBadge tone={savedResult ? "success" : "pending"} label={savedResult ? "Guardado" : "Pendiente"} />
      </div>

      <div className="bf-result-card-grid">
        <label className="bf-field">
          <span>Kills</span>
          <input
            type="number"
            min="0"
            value={draft.kills}
            onChange={(event) => onKillsChange(event.target.value)}
          />
        </label>

        <label className="bf-field">
          <span>Placement</span>
          <input
            type="number"
            min="1"
            value={draft.placement}
            onChange={(event) => onPlacementChange(event.target.value)}
          />
        </label>

        <div className="bf-readonly bf-readonly-accent">
          <span>Total calculado</span>
          <strong>{estimatedTotal ? `${estimatedTotal} pts` : "-"}</strong>
        </div>
      </div>

      <div className="bf-result-card-actions">
        <button
          type="button"
          className="bf-button bf-button-primary"
          onClick={onSave}
          disabled={submitting}
        >
          {savedResult ? "Actualizar reporte" : "Guardar reporte"}
        </button>
      </div>
    </GlassPanel>
  );
}
