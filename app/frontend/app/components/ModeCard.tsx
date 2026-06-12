type ModeCardProps = {
  index: number;
  label: string;
  description: string;
  selected: boolean;
  disabled?: boolean;
  badge?: string;
  onSelect: () => void;
};

export default function ModeCard({
  index,
  label,
  description,
  selected,
  disabled = false,
  badge,
  onSelect,
}: ModeCardProps) {
  return (
    <button
      type="button"
      className={`bf-mode-card ${selected ? "is-selected" : ""} ${disabled ? "is-disabled" : ""}`}
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
    >
      <span className="bf-mode-card-index">{index}</span>
      <div className="bf-mode-card-copy">
        <div className="bf-mode-card-head">
          <strong>{label}</strong>
          {badge ? <span className="bf-mode-card-badge">{badge}</span> : null}
        </div>
        <p>{description}</p>
      </div>
    </button>
  );
}
