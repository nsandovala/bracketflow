"use client";

import type { KillRaceMvpOverlayViewModel } from "../../lib/killRaceAwards.mjs";

type Props = {
  viewModel: KillRaceMvpOverlayViewModel;
  connected: boolean;
  transparent: boolean;
};

function formatAverage(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export default function KillRaceMvpOverlay({
  viewModel,
  connected,
  transparent,
}: Props) {
  const isEmpty = viewModel.state !== "ready";
  if (transparent && isEmpty) {
    return (
      <main
        className="kr-mvp-overlay-page is-transparent is-signal-safe-empty"
        data-state={viewModel.state}
        data-visual-key={viewModel.visualKey}
        aria-hidden="true"
      />
    );
  }

  if (isEmpty) {
    return (
      <main
        className="kr-mvp-overlay-page is-debug"
        data-state={viewModel.state}
        data-visual-key={viewModel.visualKey}
      >
        <section className="kr-mvp-overlay-empty" role="status">
          <span>BRACKETFLOW · ARENA DIGITAL</span>
          <h1>{viewModel.message}</h1>
          <p>
            {viewModel.state === "no-player-stats"
              ? "Existen resultados de equipo confirmados, pero no estadísticas individuales."
              : viewModel.state === "no-match"
                ? "Operator todavía no ha enviado una serie a transmisión."
                : "El premio aparecerá cuando existan bajas individuales confirmadas."}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main
      className={`kr-mvp-overlay-page${transparent ? " is-transparent" : " is-debug"}${
        connected ? " is-connected" : " is-disconnected"
      }`}
      data-state={viewModel.state}
      data-scope={viewModel.scope}
      data-visual-key={viewModel.visualKey}
    >
      <section className={`kr-mvp-overlay-card${viewModel.isTied ? " is-tied" : ""}`}>
        <header className="kr-mvp-overlay-head">
          <div>
            <span className="kr-award-kicker">{viewModel.title}</span>
            <strong>{viewModel.message}</strong>
          </div>
          <i aria-label={connected ? "Datos conectados" : "Reconectando"} />
        </header>

        <div className="kr-mvp-overlay-leaders">
          {viewModel.leaders.map((player) => (
            <article className="kr-mvp-overlay-player" key={player.key}>
              <div className="kr-mvp-overlay-monogram" aria-hidden="true">
                {player.nickname.slice(0, 2).toLocaleUpperCase("es")}
              </div>
              <div className="kr-mvp-overlay-identity">
                <h2>{player.nickname}</h2>
                <p>{player.teamName}</p>
              </div>
              <div className="kr-mvp-overlay-kills">
                <strong>{player.confirmedKills}</strong>
                <span>K CONFIRMADAS</span>
              </div>
              {viewModel.scope !== "map" ? (
                <div className="kr-mvp-overlay-average">
                  <span>{player.confirmedMaps} MAPAS</span>
                  <strong>{formatAverage(player.averageKills)} PROM.</strong>
                </div>
              ) : null}
            </article>
          ))}
        </div>

        <footer className="kr-mvp-overlay-foot">
          <span>{viewModel.contextLabel}</span>
          {viewModel.seriesScore ? (
            <strong>
              SERIE FINAL {viewModel.seriesScore.left}–{viewModel.seriesScore.right}
            </strong>
          ) : viewModel.scope === "tournament" ? (
            <strong>RANKING MVP · #{viewModel.leaders[0]?.rank ?? 1}</strong>
          ) : null}
        </footer>
      </section>
    </main>
  );
}
