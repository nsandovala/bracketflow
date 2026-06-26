"use client";

import { CSSProperties, useEffect, useLayoutEffect, useRef, useState } from "react";

import { StreamStanding } from "../lib/useStreamLeaderboard";

type StreamStandingsBoardProps = {
  entries: StreamStanding[];
  tournamentName: string | null;
  afterGameNumber: number;
  obs: boolean;
};

// Cuantas filas se muestran en OBS (las que entran en el safe-area de 1080p).
const OBS_MAX_ROWS = 14;
// A partir de aqui (fuera de OBS) el board habilita scroll interno sin scrollbar.
const SCROLL_THRESHOLD = 16;
// Cuanto persiste el indicador ▲▼ antes del fade.
const MOVE_TTL_MS = 10000;
// Duracion de la transicion FLIP de reordenamiento.
const FLIP_MS = 600;

type MoveDir = "up" | "down";

function formatPoints(value: number) {
  return value.toFixed(1);
}

export default function StreamStandingsBoard({
  entries,
  tournamentName,
  afterGameNumber,
  obs,
}: StreamStandingsBoardProps) {
  const visible = obs ? entries.slice(0, OBS_MAX_ROWS) : entries;

  // --- Indicadores de movimiento ▲▼ (rank previo vs actual) ---
  const prevRanks = useRef<Map<number, number>>(new Map());
  const moveTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const [moves, setMoves] = useState<Map<number, MoveDir>>(new Map());

  const orderSignature = visible.map((entry) => entry.team_id).join(",");

  useEffect(() => {
    const prev = prevRanks.current;
    const nextRanks = new Map<number, number>();
    const changed: Array<[number, MoveDir]> = [];

    visible.forEach((entry, index) => {
      const rank = index + 1;
      nextRanks.set(entry.team_id, rank);
      const old = prev.get(entry.team_id);
      if (old !== undefined && old !== rank) {
        changed.push([entry.team_id, rank < old ? "up" : "down"]);
      }
    });
    prevRanks.current = nextRanks;

    if (changed.length === 0) {
      return;
    }

    setMoves((current) => {
      const next = new Map(current);
      for (const [teamId, dir] of changed) {
        next.set(teamId, dir);
        const existing = moveTimers.current.get(teamId);
        if (existing) clearTimeout(existing);
        const timer = setTimeout(() => {
          setMoves((map) => {
            const updated = new Map(map);
            updated.delete(teamId);
            return updated;
          });
          moveTimers.current.delete(teamId);
        }, MOVE_TTL_MS);
        moveTimers.current.set(teamId, timer);
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderSignature]);

  useEffect(() => {
    const timers = moveTimers.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  // --- FLIP: animar el reordenamiento de filas con transform ---
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const prevRects = useRef<Map<number, DOMRect>>(new Map());

  const flipSignature = visible
    .map((entry) => `${entry.team_id}:${entry.total_points}`)
    .join("|");

  useLayoutEffect(() => {
    const prev = prevRects.current;
    const next = new Map<number, DOMRect>();

    rowRefs.current.forEach((element, teamId) => {
      const rect = element.getBoundingClientRect();
      next.set(teamId, rect);
      const old = prev.get(teamId);
      if (!old) {
        return;
      }
      const deltaY = old.top - rect.top;
      if (deltaY === 0) {
        return;
      }
      // First/Last/Invert/Play: invertimos al instante y soltamos a 0 con transicion.
      element.style.transition = "none";
      element.style.transform = `translateY(${deltaY}px)`;
      requestAnimationFrame(() => {
        element.style.transition = `transform ${FLIP_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
        element.style.transform = "";
      });
    });

    prevRects.current = next;
  }, [flipSignature]);

  const setRowRef = (teamId: number) => (element: HTMLDivElement | null) => {
    if (element) {
      rowRefs.current.set(teamId, element);
    } else {
      rowRefs.current.delete(teamId);
    }
  };

  // --- Estado vacio / pre-show: sin partidas reportadas todavia ---
  if (afterGameNumber === 0 || visible.length === 0) {
    return (
      <div className="bf-stream-board is-empty">
        <div className="bf-stream-empty">
          <span className="bf-stream-empty-kicker">{tournamentName ?? "BracketFlow"}</span>
          <h2 className="bf-stream-empty-title">Esperando Partida 1</h2>
          <span className="bf-stream-empty-sub">El leaderboard aparecera al cargar el primer reporte.</span>
        </div>
      </div>
    );
  }

  const density = visible.length > 10 ? "dense" : "comfortable";
  const isScroll = !obs && entries.length > SCROLL_THRESHOLD;
  const boardClassName = ["bf-stream-board", isScroll ? "is-scroll" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={boardClassName} data-density={density}>
      <div className="bf-stream-head">
        <span>#</span>
        <span>Equipo</span>
        <span className="bf-stream-num">Pts</span>
        <span className="bf-stream-num">Kills</span>
        <span className="bf-stream-num">Best</span>
        <span className="bf-stream-num">Partidas</span>
      </div>

      <div className="bf-stream-rows">
        {visible.map((entry, index) => {
          const rank = index + 1;
          const move = moves.get(entry.team_id);
          return (
            <div
              key={entry.team_id}
              ref={setRowRef(entry.team_id)}
              className="bf-stream-row"
              data-rank={rank <= 3 ? rank : undefined}
            >
              <div className="bf-stream-row-inner" style={{ "--row-index": index } as CSSProperties}>
                <div className="bf-stream-rk">
                  <span className="bf-stream-rk-num">{rank}</span>
                  <span
                    className={`bf-stream-move${move ? ` is-${move}` : ""}`}
                    aria-hidden="true"
                  >
                    {move === "up" ? "▲" : move === "down" ? "▼" : ""}
                  </span>
                </div>

                <div className="bf-stream-team">
                  <span className="bf-stream-team-name">{entry.team_name}</span>
                  <span className="bf-stream-roster">
                    {entry.players.length > 0 ? entry.players.join(" · ") : "Roster pendiente"}
                  </span>
                </div>

                <span className="bf-stream-pts">{formatPoints(entry.total_points)}</span>
                <span className="bf-stream-stat">{entry.kills}</span>
                <span className="bf-stream-stat">{entry.best_placement ?? "—"}</span>
                <span className="bf-stream-stat">{entry.matches_played}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
