"use client";

import { useEffect, useRef, useState } from "react";

import { StreamStanding } from "../lib/useStreamLeaderboard";

type Props = {
  standings: StreamStanding[];
  tournamentName: string | null;
  tournamentGame: string | null;
  afterGameNumber: number;
  connected: boolean;
  brand: string | null;
};

type DeltaInfo = { dir: "up" | "down"; magnitude: number };

export default function StreamOverlaySidebar({
  standings,
  tournamentName,
  tournamentGame,
  afterGameNumber,
  connected,
  brand,
}: Props) {
  const prevRanks = useRef<Map<number, number>>(new Map());
  const [deltas, setDeltas] = useState<Map<number, DeltaInfo>>(new Map());
  const deltaTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const orderKey = standings.map((s) => s.team_id).join(",");

  useEffect(() => {
    const prev = prevRanks.current;
    const nextRanks = new Map<number, number>();
    const changed: Array<[number, DeltaInfo]> = [];

    standings.forEach((entry, i) => {
      const rank = i + 1;
      nextRanks.set(entry.team_id, rank);
      const old = prev.get(entry.team_id);
      if (old !== undefined && old !== rank) {
        changed.push([entry.team_id, { dir: rank < old ? "up" : "down", magnitude: Math.abs(old - rank) }]);
      }
    });
    prevRanks.current = nextRanks;

    if (changed.length === 0) return;

    setDeltas((cur) => {
      const next = new Map(cur);
      for (const [id, info] of changed) {
        next.set(id, info);
        const existing = deltaTimers.current.get(id);
        if (existing) clearTimeout(existing);
        const t = setTimeout(() => {
          setDeltas((m) => {
            const u = new Map(m);
            u.delete(id);
            return u;
          });
          deltaTimers.current.delete(id);
        }, 10000);
        deltaTimers.current.set(id, t);
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderKey]);

  useEffect(() => {
    const timers = deltaTimers.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  if (afterGameNumber === 0 || standings.length === 0) {
    return (
      <div className="bf-ov-empty-chip">
        {afterGameNumber === 0 ? "Esperando Game 1" : "Sin datos"}
      </div>
    );
  }

  const gameLine = `${tournamentGame ?? "Warzone"} · After Game ${afterGameNumber}`;
  const brandLine = brand ?? "Gedeon Esport";

  return (
    <div className="bf-ov-sidebar">
      <div className="bf-ov-sidebar-header">
        <div className="bf-ov-sidebar-mark">BF</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="bf-ov-sidebar-title">{tournamentName ?? "BracketFlow"}</div>
          <div className="bf-ov-sidebar-subtitle">{gameLine}</div>
        </div>
        <div className="bf-ov-sidebar-live">
          <span className="bf-ov-sidebar-live-dot" style={connected ? undefined : { opacity: 0.4 }} />
          <span className="bf-ov-sidebar-live-label">LIVE</span>
        </div>
      </div>

      <div className="bf-ov-sidebar-col-hint">
        <span style={{ width: 150 }}>Equipo</span>
        <span style={{ width: 30, textAlign: "right" }}>K</span>
        <span style={{ width: 52, textAlign: "right" }}>Pts</span>
      </div>

      {standings.map((entry, i) => {
        const rank = i + 1;
        const top3 = rank <= 3;
        const delta = deltas.get(entry.team_id);
        const deltaClass = delta ? ` is-${delta.dir}` : "";
        const roster =
          entry.players.length > 0 ? entry.players.join(" · ") : "Roster pendiente";

        let deltaLabel: string;
        if (delta?.dir === "up") {
          deltaLabel = `▲${delta.magnitude}`;
        } else if (delta?.dir === "down") {
          deltaLabel = `▼${delta.magnitude}`;
        } else {
          deltaLabel = "—";
        }

        return (
          <div key={entry.team_id} className={`bf-ov-sidebar-row${top3 ? " is-top3" : ""}`}>
            <div className="bf-ov-sidebar-rank">{String(rank).padStart(2, "0")}</div>
            <div className="bf-ov-sidebar-team">
              <div className="bf-ov-sidebar-team-name">{entry.team_name}</div>
              <div className="bf-ov-sidebar-roster">{roster}</div>
            </div>
            <div className={`bf-ov-sidebar-delta${deltaClass}`}>{deltaLabel}</div>
            <div className="bf-ov-sidebar-kills">{entry.kills}</div>
            <div className="bf-ov-sidebar-pts">{entry.total_points.toFixed(1)}</div>
          </div>
        );
      })}

      <div className="bf-ov-sidebar-footer">
        <span>BracketFlow</span>
        <span>{brandLine}</span>
      </div>
    </div>
  );
}
