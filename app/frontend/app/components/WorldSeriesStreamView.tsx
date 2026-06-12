"use client";

import { useEffect } from "react";

import BackgroundParticles from "./BackgroundParticles";
import StreamStandingsBoard from "./StreamStandingsBoard";
import { useStreamLeaderboard } from "../lib/useStreamLeaderboard";

type WorldSeriesStreamViewProps = {
  tournamentId: number | null;
  obs: boolean;
  transparent: boolean;
  brand: string | null;
};

export default function WorldSeriesStreamView({
  tournamentId,
  obs,
  transparent,
  brand,
}: WorldSeriesStreamViewProps) {
  const { tournament, standings, afterGameNumber, connected } =
    useStreamLeaderboard(tournamentId);

  // Marca <body> para apagar el campo de particulas verde global solo en /stream,
  // y (en bg=transparent) deja html/body sin fondo para que OBS componga el overlay.
  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    body.classList.add("bf-stream-active");

    if (!transparent) {
      return () => body.classList.remove("bf-stream-active");
    }

    const prevHtmlBg = html.style.background;
    const prevBodyBg = body.style.background;
    html.style.background = "transparent";
    body.style.background = "transparent";

    return () => {
      body.classList.remove("bf-stream-active");
      html.style.background = prevHtmlBg;
      body.style.background = prevBodyBg;
    };
  }, [transparent]);

  const pageClassName = [
    "bf-stream-page",
    obs ? "bf-stream-obs" : "",
    transparent ? "bf-stream-transparent" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main className={pageClassName}>
      {!transparent && <BackgroundParticles variant="graphite" />}

      <div className="bf-stream-stage">
        <header className="bf-stream-topbar">
          <div className="bf-stream-brand">
            <span className="bf-stream-mark">BF</span>
            <div className="bf-stream-brand-copy">
              <h1 className="bf-stream-title">{tournament?.name ?? "BracketFlow"}</h1>
              <p className="bf-stream-game">{tournament?.game ?? "World Series"}</p>
            </div>
          </div>

          <div className="bf-stream-status">
            <div className="bf-stream-badge">
              <span>After Game</span>
              <strong>{afterGameNumber}</strong>
            </div>
            <div className={`bf-stream-live${connected ? "" : " is-off"}`}>
              <span className="bf-stream-live-dot" />
              {connected ? "Live" : "Reconectando"}
            </div>
          </div>
        </header>

        <StreamStandingsBoard
          entries={standings}
          tournamentName={tournament?.name ?? null}
          afterGameNumber={afterGameNumber}
          obs={obs}
        />

        {!obs && (
          <footer className="bf-stream-strip">
            <span>
              powered by <strong>BracketFlow</strong>
            </span>
            <span className="bf-stream-brand-slot">{brand ?? "Gedeon Esport"}</span>
          </footer>
        )}
      </div>
    </main>
  );
}
