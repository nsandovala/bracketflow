type ScoreRowProps = {
  rank?: number;
  title: string;
  subtitle?: string;
  metrics: string[];
};

export default function ScoreRow({ rank, title, subtitle, metrics }: ScoreRowProps) {
  return (
    <div className="bf-score-row">
      <div className="bf-score-copy">
        {rank ? <span className="bf-score-rank">#{rank}</span> : null}
        <div>
          <strong>{title}</strong>
          {subtitle ? <span>{subtitle}</span> : null}
        </div>
      </div>
      <div className="bf-score-metrics">
        {metrics.map((metric) => (
          <span key={metric} className="bf-metric">
            {metric}
          </span>
        ))}
      </div>
    </div>
  );
}
