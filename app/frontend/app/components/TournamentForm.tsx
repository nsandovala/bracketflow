import { FormEventHandler } from "react";

import { TournamentFormat } from "../../lib/api";

type TournamentFormProps = {
  compact: boolean;
  submitting: boolean;
  name: string;
  game: string;
  format: TournamentFormat;
  formatOptions: Array<{ value: TournamentFormat; label: string }>;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onNameChange: (value: string) => void;
  onGameChange: (value: string) => void;
  onFormatChange: (format: TournamentFormat) => void;
};

export default function TournamentForm({
  compact,
  submitting,
  name,
  game,
  format,
  formatOptions,
  onSubmit,
  onNameChange,
  onGameChange,
  onFormatChange,
}: TournamentFormProps) {
  const form = (
    <form className={`bf-form ${compact ? "bf-form-compact" : ""}`} onSubmit={onSubmit}>
      <label>
        Nombre
        <input
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="Torneo Warzone"
          required
        />
      </label>
      <label>
        Juego
        <input
          value={game}
          onChange={(event) => onGameChange(event.target.value)}
          placeholder="Warzone"
          required
        />
      </label>
      <label>
        Formato
        <select
          value={format}
          onChange={(event) => onFormatChange(event.target.value as TournamentFormat)}
        >
          {formatOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={submitting}>
        {submitting ? "Guardando..." : "Crear torneo"}
      </button>
    </form>
  );

  if (!compact) {
    return (
      <div className="bf-panel">
        <div className="bf-panel-header">
          <div>
            <p className="bf-eyebrow">Crear</p>
            <h2>Nuevo torneo</h2>
          </div>
        </div>
        {form}
      </div>
    );
  }

  return (
    <details className="bf-panel bf-panel-compact">
      <summary className="bf-details-summary">
        <div>
          <p className="bf-eyebrow">Secundario</p>
          <h2>Nuevo torneo</h2>
        </div>
        <span className="bf-pill">Abrir</span>
      </summary>
      {form}
    </details>
  );
}
