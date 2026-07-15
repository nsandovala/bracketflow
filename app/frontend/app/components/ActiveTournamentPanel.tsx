import { Tournament } from "../../lib/api";

type ActiveTournamentPanelProps = {
  tournament: Tournament;
  formatLabel: string;
};

export default function ActiveTournamentPanel({
  tournament,
  formatLabel,
}: ActiveTournamentPanelProps) {
  return (
    <div className="bf-panel bf-panel-compact">
      <p className="bf-eyebrow">Torneo activo</p>
      <div className="bf-toolbar-row">
        <div>
          <h2>{tournament.name}</h2>
          <p>
            {tournament.game} - {formatLabel}
          </p>
        </div>
        <span className="bf-pill">{tournament.status}</span>
      </div>
    </div>
  );
}
