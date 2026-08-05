"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Bracket, Seed, SeedItem, type IRenderSeedProps } from "react-brackets";

import type { Match, Team, Tournament } from "../../lib/api";
import type { ResolvedTournamentEngine } from "../../lib/tournamentModel";
import { toBracketRounds } from "../../lib/toBracketRounds";
import {
  buildKillRaceBracketBroadcast,
  getKillRaceBracketLayout,
  type KillRaceBroadcastSeries,
  type KillRaceBroadcastTeam,
} from "../../lib/killRaceBracketBroadcast.mjs";
import BackgroundParticles from "./BackgroundParticles";

type KillRaceBracketBroadcastProps = {
  tournament: Tournament | null;
  engine: ResolvedTournamentEngine | null;
  teams: Team[];
  matches: Match[];
  broadcastMatchId: number | null;
  connected: boolean;
  transparent: boolean;
};

const DEFAULT_VIEWPORT = { width: 1920, height: 1080 };

function useViewport() {
  const [viewport, setViewport] = useState(DEFAULT_VIEWPORT);

  useEffect(() => {
    function update() {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return viewport;
}

function BroadcastTeam({ team }: { team: KillRaceBroadcastTeam | null }) {
  if (!team) return null;
  return (
    <div
      className={[
        "kr-broadcast-team",
        team.isWinner ? "is-winner" : "",
        team.isLoser ? "is-loser" : "",
        team.isFuture || team.isEmpty || team.isBye ? "is-placeholder" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="kr-broadcast-team-copy">
        <strong>{team.name}</strong>
        <span>{team.isBye ? "LIBRE POR SEED" : team.roster}</span>
      </div>
      <div className="kr-broadcast-team-result">
        {team.score !== null ? <b>{team.score}</b> : null}
        <small>{team.stateLabel}</small>
      </div>
    </div>
  );
}

function BroadcastSeed({ series }: { series: KillRaceBroadcastSeries }) {
  return (
    <article
      className={`kr-broadcast-seed is-${series.statusTone}`}
      aria-label={`${series.matchLabel}: ${series.statusLabel}`}
    >
      <header className="kr-broadcast-seed-head">
        <div>
          <span>{series.matchLabel}</span>
          <b>BO{series.bestOf}</b>
        </div>
        <strong>{series.statusLabel}</strong>
      </header>

      <div className="kr-broadcast-team-list">
        <BroadcastTeam team={series.leftTeam} />
        <BroadcastTeam team={series.rightTeam} />
      </div>

      {series.visibleMap && !series.isBye ? (
        <footer className={`kr-broadcast-map is-${series.visibleMap.status}`}>
          <span>PARTIDA {series.visibleMap.mapNumber}</span>
          <b>{series.visibleMap.statusLabel}</b>
          <strong>{series.visibleMap.killsA}–{series.visibleMap.killsB} KILLS</strong>
        </footer>
      ) : null}
    </article>
  );
}

function renderSeed(props: IRenderSeedProps) {
  const series = props.seed as KillRaceBroadcastSeries;
  const seedCount = props.rounds?.[props.roundIndex]?.seeds.length ?? 1;
  return (
    <Seed
      className="kr-broadcast-seed-shell"
      mobileBreakpoint={props.breakpoint}
      style={{ height: `${100 / Math.max(1, seedCount)}%` }}
    >
      <SeedItem style={{ background: "transparent", boxShadow: "none" }}>
        <BroadcastSeed series={series} />
      </SeedItem>
    </Seed>
  );
}

function renderRoundTitle(title: ReactNode) {
  return <div className="kr-broadcast-round-title">{title}</div>;
}

function EmptyScene({
  state,
  tournamentName,
}: {
  state: "no-tournament" | "tournament-prepared";
  tournamentName: string | null;
}) {
  const noTournament = state === "no-tournament";
  return (
    <div className="kr-bracket-broadcast-empty">
      <span>BRACKETFLOW · ARENA DIGITAL</span>
      <h1>{noTournament ? "SIN TORNEO EN TRANSMISIÓN" : "TORNEO PREPARADO"}</h1>
      <p>
        {noTournament
          ? "La arena está lista."
          : "La llave todavía no ha sido generada."}
      </p>
      {!noTournament && tournamentName ? <small>{tournamentName}</small> : null}
    </div>
  );
}

export default function KillRaceBracketBroadcast({
  tournament,
  engine,
  teams,
  matches,
  broadcastMatchId,
  connected,
  transparent,
}: KillRaceBracketBroadcastProps) {
  const viewport = useViewport();
  const sourceRounds = useMemo(
    () => toBracketRounds(matches, teams, engine?.teamSize ?? 2),
    [matches, teams, engine?.teamSize]
  );
  const viewModel = useMemo(
    () =>
      buildKillRaceBracketBroadcast({
        tournament,
        matches,
        teams,
        broadcastMatchId,
        sourceRounds,
      }),
    [tournament, matches, teams, broadcastMatchId, sourceRounds]
  );
  const layout = getKillRaceBracketLayout({
    roundCount: viewModel.rounds.length,
    maxMatchesInRound: viewModel.maxMatchesInRound,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
  });
  const pageClassName = [
    "bf-stream-page",
    "kr-bracket-broadcast-page",
    transparent ? "is-transparent bf-stream-transparent" : "",
    connected ? "" : "is-disconnected",
  ]
    .filter(Boolean)
    .join(" ");
  const layoutStyle = {
    "--kr-bracket-scale": layout.scale,
    "--kr-bracket-card-width": `${layout.cardWidth}px`,
    "--kr-bracket-round-gap": `${layout.roundGap}px`,
    "--kr-bracket-base-width": `${layout.baseWidth}px`,
    "--kr-bracket-base-height": `${layout.baseHeight}px`,
    "--kr-bracket-scaled-width": `${layout.scaledWidth}px`,
    "--kr-bracket-scaled-height": `${layout.scaledHeight}px`,
  } as CSSProperties;

  return (
    <main
      className={pageClassName}
      data-state={viewModel.state}
      data-visual-key={viewModel.visualKey}
      style={layoutStyle}
    >
      {!transparent ? <BackgroundParticles variant="graphite" /> : null}
      <div className={`kr-bracket-broadcast-shell is-${viewModel.layoutDensity}`}>
        <header className="kr-bracket-broadcast-header">
          <div className="kr-bracket-broadcast-brand">
            <span>BRACKETFLOW · ARENA DIGITAL</span>
            <h1>{viewModel.tournamentName ?? "KILL RACE"}</h1>
          </div>
          <div className="kr-bracket-broadcast-progress">
            <span>{viewModel.phaseLabel}</span>
            <strong>{viewModel.completedSeries}/{viewModel.totalSeries}</strong>
            <i className={connected ? "" : "is-off"} aria-label={connected ? "Conectado" : "Reconectando"} />
          </div>
        </header>

        {viewModel.state === "no-tournament" || viewModel.state === "tournament-prepared" ? (
          <EmptyScene state={viewModel.state} tournamentName={viewModel.tournamentName} />
        ) : (
          <section className="kr-bracket-broadcast-board" aria-label="Llave Kill Race">
            {viewModel.state === "bracket-prepared" ? (
              <div className="kr-bracket-broadcast-ready">
                <span>BRACKET PREPARADO</span>
                <p>Las series están listas para comenzar.</p>
              </div>
            ) : null}
            <div
              className="kr-bracket-broadcast-frame"
              style={{ width: layout.scaledWidth, height: layout.scaledHeight }}
            >
              <div className="kr-bracket-broadcast-canvas">
                <Bracket
                  rounds={viewModel.rounds}
                  mobileBreakpoint={0}
                  bracketClassName="kr-bracket-broadcast-root"
                  roundClassName="kr-broadcast-round"
                  roundTitleComponent={renderRoundTitle}
                  renderSeedComponent={renderSeed}
                />
              </div>
            </div>
          </section>
        )}

        {viewModel.champion ? (
          <footer className="kr-bracket-broadcast-footer is-champion">
            <span>CAMPEÓN</span>
            <strong>{viewModel.champion.name}</strong>
            <i>·</i>
            <b>SERIE FINAL {viewModel.champion.score}</b>
          </footer>
        ) : viewModel.broadcastSeries ? (
          <footer className="kr-bracket-broadcast-footer is-on-air">
            <span>SERIE AL AIRE</span>
            <strong>
              {viewModel.broadcastSeries.leftTeam?.name ?? "POR DEFINIR"} VS {viewModel.broadcastSeries.rightTeam?.name ?? "POR DEFINIR"}
            </strong>
            <i>·</i>
            <b>
              {viewModel.broadcastSeries.visibleMap
                ? `PARTIDA ${viewModel.broadcastSeries.visibleMap.mapNumber}`
                : "SERIE LISTA"} · BO{viewModel.broadcastSeries.bestOf}
            </b>
          </footer>
        ) : (
          <footer className="kr-bracket-broadcast-footer is-off-air">
            <span>SIN SERIE AL AIRE</span>
            <strong>La llave permanece actualizada</strong>
          </footer>
        )}
      </div>
    </main>
  );
}
