type TournamentSummaryProps = {
  formatLabel: string;
  participantsRequired: string;
  teamsCount: number;
  roundsCount: number;
  resultsCount: number;
  nextAction: string;
};

export default function TournamentSummary({
  formatLabel,
  participantsRequired,
  teamsCount,
  roundsCount,
  resultsCount,
  nextAction,
}: TournamentSummaryProps) {
  return (
    <aside className="bf-panel bf-summary-panel">
      <div className="bf-panel-head">
        <div>
          <p className="bf-kicker">Resumen</p>
          <h2>Torneo activo</h2>
        </div>
      </div>

      <dl className="bf-summary-list">
        <div className="bf-summary-item">
          <dt>Formato</dt>
          <dd>{formatLabel}</dd>
        </div>
        <div className="bf-summary-item">
          <dt>Participantes requeridos</dt>
          <dd>{participantsRequired}</dd>
        </div>
        <div className="bf-summary-item">
          <dt>Equipos</dt>
          <dd>{teamsCount}</dd>
        </div>
        <div className="bf-summary-item">
          <dt>Rondas</dt>
          <dd>{roundsCount}</dd>
        </div>
        <div className="bf-summary-item">
          <dt>Resultados</dt>
          <dd>{resultsCount}</dd>
        </div>
        <div className="bf-summary-item">
          <dt>Siguiente accion</dt>
          <dd>{nextAction}</dd>
        </div>
      </dl>
    </aside>
  );
}
