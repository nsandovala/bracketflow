"use client";

import { useEffect } from "react";

import BackgroundParticles from "./BackgroundParticles";
import BracketStreamView from "./BracketStreamView";
import StreamOverlayLowerThird from "./StreamOverlayLowerThird";
import StreamOverlaySidebar from "./StreamOverlaySidebar";
import StreamStandingsBoard from "./StreamStandingsBoard";
import { useStreamLeaderboard } from "../lib/useStreamLeaderboard";
import { resolveTournamentEngine } from "../../lib/tournamentModel";
import { getMatchPointStatus, getMatchPointStatusMessage } from "../../lib/tournamentStatus";

type WorldSeriesStreamViewProps = {
  tournamentId: number | null;
  obs: boolean;
  transparent: boolean;
  brand: string | null;
  layout: "full" | "sidebar" | "lower";
};

export default function WorldSeriesStreamView({
  tournamentId,
  obs,
  transparent,
  brand,
  layout,
}: WorldSeriesStreamViewProps) {
  const { tournament, teams, matches, standings, afterGameNumber, connected } =
    useStreamLeaderboard(tournamentId);
  const engine = tournament ? resolveTournamentEngine(tournament) : null;
  const isBracket =
    engine?.scoringProfile === "kill_race" ||
    engine?.tournamentStructure === "single_elim" ||
    engine?.tournamentStructure === "double_elim";
  const matchPointStatus =
    tournament && engine && !isBracket
      ? getMatchPointStatus({
          tournament,
          threshold: engine.matchPointThreshold,
          standings,
          teams,
          matches,
        })
      : { state: "idle" as const };
  const matchPointMessage = isBracket ? null : getMatchPointStatusMessage(matchPointStatus);
  const streamStatusLine =
    matchPointStatus.state === "champion"
      ? `Campeon por Match Point: ${matchPointStatus.championLabel}`
      : matchPointMessage ?? tournament?.game ?? "World Series";

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

  if (isBracket) {
    return (
      <BracketStreamView
        tournament={tournament}
        engine={engine}
        teams={teams}
        matches={matches}
        connected={connected}
        obs={obs || layout === "sidebar" || layout === "lower"}
        transparent={transparent}
        brand={brand}
      />
    );
  }

  // Overlay modes (sidebar / lower) render a fixed transparent canvas with just the overlay chip.
  if (layout === "sidebar" || layout === "lower") {
    const pageClassName = [
      "bf-stream-page",
      "bf-stream-overlay-mode",
      transparent ? "bf-stream-transparent" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <main className={pageClassName}>
        {layout === "sidebar" && (
          <div className="bf-ov-sidebar-anchor">
            <StreamOverlaySidebar
              standings={standings}
              tournamentName={tournament?.name ?? null}
              tournamentGame={streamStatusLine}
              afterGameNumber={afterGameNumber}
              connected={connected}
              brand={brand}
            />
          </div>
        )}
        {layout === "lower" && (
          <div className="bf-ov-lower-anchor">
            <StreamOverlayLowerThird
              standings={standings}
              tournamentGame={streamStatusLine}
              afterGameNumber={afterGameNumber}
              connected={connected}
              brand={brand}
            />
          </div>
        )}
      </main>
    );
  }

  // Default: full standings table (existing behavior, untouched).
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
              <p className="bf-stream-game">{streamStatusLine}</p>
            </div>
          </div>

          <div className="bf-stream-status">
            <div className="bf-stream-badge">
              <span>Tras Partida</span>
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
