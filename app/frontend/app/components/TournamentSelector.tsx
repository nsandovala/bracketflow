import { Tournament, TournamentFormat } from "../../lib/api";

type TournamentSelectorProps = {
  compact: boolean;
  tournaments: Tournament[];
  selectedTournamentId: number | null;
  loading: boolean;
  onSelectTournament: (tournamentId: number) => void;
  getFormatLabel: (format: TournamentFormat) => string;
};

export default function TournamentSelector({
  compact,
  tournaments,
  selectedTournamentId,
  loading,
  onSelectTournament,
  getFormatLabel,
}: TournamentSelectorProps) {
  return (
    <div className={compact ? "bf-panel bf-panel-compact" : "bf-panel"}>
      <div className="bf-panel-header">
        <div>
          <p className="bf-eyebrow">Torneos</p>
          <h2>{compact ? "Selector" : "Seleccionar torneo"}</h2>
        </div>
        <span className="bf-badge">{tournaments.length}</span>
      </div>

      {loading ? <p className="bf-empty">Cargando torneos...</p> : null}
      {!loading && tournaments.length === 0 ? (
        <p className="bf-empty">Todavia no hay torneos creados.</p>
      ) : null}

      {!loading && tournaments.length > 0 ? (
        compact ? (
          <label className="bf-field-compact">
            Torneo activo
            <select
              value={selectedTournamentId ?? ""}
              onChange={(event) => onSelectTournament(Number(event.target.value))}
            >
              {tournaments.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>
                  {tournament.name} Â· {getFormatLabel(tournament.format)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="bf-list">
            {tournaments.map((tournament) => (
              <button
                key={tournament.id}
                type="button"
                className={`bf-card ${selectedTournamentId === tournament.id ? "is-active" : ""}`}
                onClick={() => onSelectTournament(tournament.id)}
              >
                <strong>{tournament.name}</strong>
                <span>{tournament.game}</span>
                <small>{getFormatLabel(tournament.format)}</small>
                <small>{tournament.status}</small>
              </button>
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}
