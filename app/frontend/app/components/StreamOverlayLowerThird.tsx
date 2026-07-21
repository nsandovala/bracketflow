"use client";

import { useEffect, useState } from "react";

import { StreamStanding } from "../lib/useStreamLeaderboard";

const WINDOW = 5;
const TOP_ONLY_WINDOW = 3;
const ROTATE_MS = 4200;

type Props = {
  standings: StreamStanding[];
  tournamentGame: string | null;
  afterGameNumber: number;
  connected: boolean;
  brand: string | null;
  tournamentName?: string | null;
  // layout=lower-third: top 3 fijo sin rotación. layout=lower conserva la rotación clásica.
  topOnly?: boolean;
};

export default function StreamOverlayLowerThird({
  standings,
  tournamentGame,
  afterGameNumber,
  connected,
  brand,
  tournamentName = null,
  topOnly = false,
}: Props) {
  const [startIdx, setStartIdx] = useState(0);

  useEffect(() => {
    if (topOnly || standings.length <= WINDOW) return;
    const id = setInterval(
      () => setStartIdx((s) => (s + WINDOW) % standings.length),
      ROTATE_MS
    );
    return () => clearInterval(id);
  }, [standings.length, topOnly]);

  if (afterGameNumber === 0 || standings.length === 0) {
    return (
      <div className="bf-ov-empty-chip">
        {afterGameNumber === 0 ? "Esperando Partida 1" : "Sin datos"}
      </div>
    );
  }

  const windowSize = topOnly ? TOP_ONLY_WINDOW : WINDOW;
  const count = Math.min(windowSize, standings.length);
  const visible: Array<{ entry: StreamStanding; rank: number }> = [];
  for (let i = 0; i < count; i++) {
    const idx = topOnly ? i : (startIdx + i) % standings.length;
    visible.push({ entry: standings[idx], rank: idx + 1 });
  }

  const gameLine = `Tras Partida ${afterGameNumber}`;
  const brandLine = brand ?? "Gedeon Esport";

  return (
    <div className={`bf-ov-lower${topOnly ? " is-top-only" : ""}`}>
      <div className="bf-ov-lower-card">
        <div className="bf-ov-lower-brand">
          <div className="bf-ov-lower-brand-live">
            <span
              className="bf-ov-lower-live-dot"
              style={connected ? undefined : { opacity: 0.4 }}
            />
            <span className="bf-ov-lower-live-label">LIVE</span>
          </div>
          <div className="bf-ov-lower-brand-title">
            {topOnly ? (tournamentName ?? "Standings") : "Standings"}
          </div>
          <div className="bf-ov-lower-brand-sub">
            {topOnly ? `Top 3 · ${gameLine}` : gameLine}
          </div>
        </div>

        <div className="bf-ov-lower-teams">
          {visible.map(({ entry, rank }, i) => {
            const top3 = rank <= 3;
            const isTop1 = rank === 1;
            return (
              <div
                key={`${entry.team_id}-${startIdx}-${i}`}
                className={`bf-ov-lower-team${top3 ? " is-top3" : ""}${isTop1 ? " is-top1" : ""}`}
              >
                <div className="bf-ov-lower-rank">{String(rank).padStart(2, "0")}</div>
                <div className="bf-ov-lower-team-body">
                  <div className="bf-ov-lower-team-name">{entry.team_name}</div>
                  <div className="bf-ov-lower-team-stats">
                    <span className="bf-ov-lower-pts">{entry.total_points.toFixed(1)}</span>
                    <span className="bf-ov-lower-kills">{entry.kills}K</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="bf-ov-lower-footer">
        <span className="bf-ov-lower-footer-mark">BF</span>
        BracketFlow · {tournamentGame ?? brandLine}
      </div>
    </div>
  );
}
