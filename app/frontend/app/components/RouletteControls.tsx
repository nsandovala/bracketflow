type RouletteControlsProps = {
  rouletteSeed: string;
  submitting: boolean;
  disabled: boolean;
  playersBelowMinimum: boolean;
  playersRemaining: number;
  buttonLabel: string;
  onRouletteSeedChange: (value: string) => void;
  onGenerateRoulette: () => void;
};

export default function RouletteControls({
  rouletteSeed,
  submitting,
  disabled,
  playersBelowMinimum,
  playersRemaining,
  buttonLabel,
  onRouletteSeedChange,
  onGenerateRoulette,
}: RouletteControlsProps) {
  return (
    <div className="bf-form">
      <label>
        Seed opcional
        <input
          value={rouletteSeed}
          onChange={(event) => onRouletteSeedChange(event.target.value)}
          placeholder="wsow-seed-01"
        />
      </label>
      <div className="bf-button-row">
        <button
          type="button"
          className="bf-button bf-button-primary bf-cta-primary"
          onClick={onGenerateRoulette}
          disabled={submitting || disabled}
        >
          {buttonLabel}
        </button>
      </div>
      {playersBelowMinimum ? (
        <p className="bf-muted-copy">Faltan {playersRemaining} jugadores para sortear.</p>
      ) : null}
    </div>
  );
}
