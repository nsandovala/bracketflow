"use client";

import { useEffect } from "react";

import BackgroundParticles from "./BackgroundParticles";
import BracketStreamView from "./BracketStreamView";
import StreamOverlayLeaderboard from "./StreamOverlayLeaderboard";
import StreamOverlayLowerThird from "./StreamOverlayLowerThird";
import StreamOverlayMatchPoint from "./StreamOverlayMatchPoint";
import StreamOverlayMvp from "./StreamOverlayMvp";
import StreamOverlaySidebar from "./StreamOverlaySidebar";
import StreamStandingsBoard from "./StreamStandingsBoard";
import { useStreamLeaderboard } from "../lib/useStreamLeaderboard";
import { resolveTournamentEngine } from "../../lib/tournamentModel";
import { getMatchPointStatus, getMatchPointStatusMessage } from "../../lib/tournamentStatus";

export type StreamLayout =
  | "full"
  | "sidebar"
  | "lower"
  | "lower-third"
  | "matchpoint"
  | "mvp"
  | "leaderboard";

// Layouts que se anclan como overlay fijo transparente (browser source OBS).
const ANCHORED_LAYOUTS: StreamLayout[] = ["sidebar", "lower", "lower-third", "matchpoint", "mvp"];

type WorldSeriesStreamViewProps = {
  tournamentId: number | null;
  obs: boolean;
  transparent: boolean;
  brand: string | null;
  layout: StreamLayout;
};

export default function WorldSeriesStreamView({
  tournamentId,
  obs,
  transparent,
  brand,
  layout,
}: WorldSeriesStreamViewProps) {
  const { tournament, teams, matches, standings, results, afterGameNumber, connected } =
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
        obs={obs || layout !== "full"}
        transparent={transparent}
        brand={brand}
      />
    );
  }

  // Equipo con match point activo (líder sobre el umbral o campeón ya decidido).
  const matchPointTeamId =
    matchPointStatus.state === "champion"
      ? matchPointStatus.champion.id
      : matchPointStatus.state === "threshold_reached"
        ? (standings[0]?.team_id ?? null)
        : null;

  // Overlay modes: fixed transparent canvas with just the overlay anchored.
  if (ANCHORED_LAYOUTS.includes(layout)) {
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
              matchPointTeamId={matchPointTeamId}
            />
          </div>
        )}
        {(layout === "lower" || layout === "lower-third") && (
          <div className="bf-ov-lower-anchor">
            <StreamOverlayLowerThird
              standings={standings}
              tournamentGame={streamStatusLine}
              afterGameNumber={afterGameNumber}
              connected={connected}
              brand={brand}
              tournamentName={tournament?.name ?? null}
              topOnly={layout === "lower-third"}
            />
          </div>
        )}
        {layout === "matchpoint" && (
          <div className="bf-ov-mp-anchor">
            <StreamOverlayMatchPoint
              status={matchPointStatus}
              tournamentName={tournament?.name ?? null}
              transparent={transparent}
              connected={connected}
            />
          </div>
        )}
        {layout === "mvp" && (
          <div className="bf-ov-mvp-anchor">
            <StreamOverlayMvp
              results={results}
              standings={standings}
              tournamentName={tournament?.name ?? null}
              connected={connected}
            />
          </div>
        )}
      </main>
    );
  }

  // Broadcast leaderboard: full-page premium table (dark unless transparent).
  if (layout === "leaderboard") {
    const pageClassName = [
      "bf-stream-page",
      "bf-ov-board-page",
      transparent ? "bf-stream-transparent" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <main className={pageClassName}>
        {!transparent && <BackgroundParticles variant="graphite" />}
        <StreamOverlayLeaderboard
          standings={standings}
          tournamentName={tournament?.name ?? null}
          statusLine={streamStatusLine}
          afterGameNumber={afterGameNumber}
          connected={connected}
          brand={brand}
        />
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
