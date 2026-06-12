type StatusBadgeProps = {
  label: string;
  tone?: "neutral" | "success" | "pending" | "live";
};

export default function StatusBadge({
  label,
  tone = "neutral",
}: StatusBadgeProps) {
  return <span className={`bf-status-badge is-${tone}`}>{label}</span>;
}
