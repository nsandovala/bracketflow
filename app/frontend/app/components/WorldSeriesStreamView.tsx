"use client";

import { useEffect } from "react";

import BackgroundParticles from "./BackgroundParticles";
import BracketStreamView from "./BracketStreamView";
import KillRaceIntermission, {
  KillRaceIntermissionUnavailable,
} from "./KillRaceIntermission";
import KillRaceMvpOverlay from "./KillRaceMvpOverlay";
import KillRaceChampionOverlay from "./KillRaceChampionOverlay";
import KillRaceScorebug from "./KillRaceScorebug";
import StreamOverlayLeaderboard from "./StreamOverlayLeaderboard";
import StreamOverlayLowerThird from "./StreamOverlayLowerThird";
import StreamOverlayMatchPoint from "./StreamOverlayMatchPoint";
import StreamOverlayMvp from "./StreamOverlayMvp";
import StreamOverlaySidebar from "./StreamOverlaySidebar";
import StreamStandingsBoard from "./StreamStandingsBoard";
import { useStreamLeaderboard } from "../lib/useStreamLeaderboard";
import { resolveTournamentEngine } from "../../lib/tournamentModel";
import {
  getMatchPointStatusFromPolicy,
  getMatchPointStatusMessage,
} from "../../lib/tournamentStatus";
import { resolveKillRaceScorebugMatch } from "../../lib/killRaceBroadcast.mjs";
import { buildKillRaceCasterState } from "../../lib/killRaceCasterState.mjs";
import { buildKillRaceIntermission } from "../../lib/killRaceIntermission.mjs";
import {
  buildKillRaceChampionOverlay,
  buildKillRaceMvpOverlay,
} from "../../lib/killRaceAwards.mjs";
import { resolveStreamSurface } from "../../lib/streamRouting.mjs";

export type StreamLayout =
  | "full"
  | "sidebar"
  | "lower"
  | "lower-third"
  | "matchpoint"
  | "mvp"
  | "leaderboard"
  | "bracket"
  | "scorebug"
  | "intermission"
  | "champion";

// Layouts que se anclan como overlay fijo transparente (browser source OBS).
const ANCHORED_LAYOUTS: StreamLayout[] = ["sidebar", "lower", "lower-third", "matchpoint", "mvp"];

type WorldSeriesStreamViewProps = {
  tournamentId: number | null;
  matchId: number | null;
  channel: string | null;
  obs: boolean;
  transparent: boolean;
  brand: string | null;
  layout: StreamLayout;
};

function StreamReferenceEmpty({ reason }: { reason: string }) {
  const message = reason === "TORNEO NO DISPONIBLE"
    ? "El canal ya no tiene un torneo válido asignado."
    : reason === "NO HAY MATCH AL AIRE"
      ? "Operator todavía no ha enviado una serie a transmisión."
      : reason === "RECONECTANDO"
        ? "Conservando la última referencia mientras vuelve el backend."
        : "Asigna un torneo y una serie desde Operator.";
  return (
    <main className="kr-scorebug-stage">
      <section className="kr-scorebug is-empty" role="status">
        <strong>{reason}</strong>
        <span>{message}</span>
      </section>
    </main>
  );
}

export default function WorldSeriesStreamView({
  tournamentId,
  matchId,
  channel,
  obs,
  transparent,
  brand,
  layout,
}: WorldSeriesStreamViewProps) {
  const {
    tournament,
    matchCompletionPolicy,
    teams,
    matches,
    standings,
    results,
    afterGameNumber,
    connected,
    channel: broadcastChannel,
    resolvedMatchId,
    emptyReason,
  } = useStreamLeaderboard(tournamentId, channel, matchId);
  const engine = tournament ? resolveTournamentEngine(tournament) : null;
  const isBracket =
    engine?.scoringProfile === "kill_race" ||
    engine?.tournamentStructure === "single_elim" ||
    engine?.tournamentStructure === "double_elim";
  const matchPointStatus =
    tournament && engine && !isBracket
      ? getMatchPointStatusFromPolicy({
          policy: matchCompletionPolicy,
          teams,
        })
      : { state: "idle" as const };
  const matchPointMessage = isBracket ? null : getMatchPointStatusMessage(matchPointStatus);
  const streamStatusLine =
    matchPointStatus.state === "champion"
      ? `Campeon por Match Point: ${matchPointStatus.championLabel}`
      : matchPointMessage ?? tournament?.game ?? "World Series";
  const isKillRace = engine?.scoringProfile === "kill_race";
  const streamSurface = resolveStreamSurface(layout, {
    isKillRace: engine ? isKillRace : null,
    isBracket,
  });

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

  if (emptyReason && streamSurface !== "bracket") {
    return <StreamReferenceEmpty reason={emptyReason} />;
  }

  if (streamSurface === "kill-race-mvp") {
    const viewModel = buildKillRaceMvpOverlay({
      tournament,
      teams,
      matches,
      broadcastMatchId: resolvedMatchId,
    });
    return (
      <KillRaceMvpOverlay
        viewModel={viewModel}
        connected={connected}
        transparent={transparent}
      />
    );
  }

  if (streamSurface === "kill-race-champion") {
    const viewModel = buildKillRaceChampionOverlay({ tournament, teams, matches });
    return (
      <KillRaceChampionOverlay
        viewModel={viewModel}
        connected={connected}
        transparent={transparent}
      />
    );
  }

  if (streamSurface === "unsupported-champion") {
    const viewModel = buildKillRaceChampionOverlay({ tournament, teams, matches });
    return (
      <KillRaceChampionOverlay
        viewModel={viewModel}
        connected={connected}
        transparent={transparent}
        unsupported
      />
    );
  }

  if (streamSurface === "intermission") {
    const broadcastMatch =
      resolvedMatchId === null
        ? null
        : matches.find((match) => match.id === resolvedMatchId) ?? null;
    const killRaceCasterState = buildKillRaceCasterState({
      matches,
      teams,
      broadcastMatchId: resolvedMatchId,
    });
    const viewModel = buildKillRaceIntermission({
      tournament,
      selectedEngine: engine,
      broadcastChannel,
      broadcastMatch,
      teams,
      matches,
      killRaceCasterState,
    });
    return (
      <KillRaceIntermission
        viewModel={viewModel}
        connected={connected}
        transparent={transparent}
      />
    );
  }

  if (streamSurface === "unsupported-intermission") {
    return (
      <KillRaceIntermissionUnavailable
        connected={connected}
        transparent={transparent}
      />
    );
  }

  if (streamSurface === "scorebug") {
    const scorebugMatch = resolveKillRaceScorebugMatch(
      matches,
      resolvedMatchId,
      tournament?.config?.broadcastMatchId ?? null
    );
    return <KillRaceScorebug tournamentId={tournament?.id ?? tournamentId} match={scorebugMatch} teams={teams} connected={connected} />;
  }

  if (streamSurface === "unsupported-scorebug") {
    return (
      <main className="kr-scorebug-stage">
        <div className="kr-scorebug is-empty">Scorebug disponible solo para Kill Race</div>
      </main>
    );
  }

  if (streamSurface === "bracket") {
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
        broadcastMatchId={resolvedMatchId}
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
