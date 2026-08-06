"use client";

import type { KillRaceChampionOverlayViewModel } from "../../lib/killRaceAwards.mjs";
import BackgroundParticles from "./BackgroundParticles";

type Props = {
  viewModel: KillRaceChampionOverlayViewModel;
  connected: boolean;
  transparent: boolean;
  unsupported?: boolean;
};

function rosterLabel(roster: string[]) {
  return roster.length > 0 ? roster.join(" / ") : null;
}

export default function KillRaceChampionOverlay({
  viewModel,
  connected,
  transparent,
  unsupported = false,
}: Props) {
  const isReady = Boolean(
    !unsupported && viewModel.state === "ready" && viewModel.champion && viewModel.finalist
  );
  if (transparent && !isReady) {
    return (
      <main
        className="kr-champion-overlay-page is-transparent is-signal-safe-empty"
        data-state={unsupported ? "unsupported" : viewModel.state}
        data-visual-key={viewModel.visualKey}
        aria-hidden="true"
      />
    );
  }

  if (!isReady) {
    return (
      <main
        className="kr-champion-overlay-page is-debug"
        data-state={unsupported ? "unsupported" : viewModel.state}
        data-visual-key={viewModel.visualKey}
      >
        <BackgroundParticles variant="graphite" />
        <section className="kr-champion-overlay-pending" role="status">
          <span>BRACKETFLOW · ARENA DIGITAL</span>
          <h1>{unsupported ? "CHAMPION NO DISPONIBLE PARA ESTE FORMATO" : "CAMPEÓN AÚN NO DEFINIDO"}</h1>
          <p>
            {unsupported
              ? "La escena Champion v1 está disponible exclusivamente para Kill Race."
              : viewModel.message}
          </p>
        </section>
      </main>
    );
  }

  const champion = viewModel.champion!;
  const finalist = viewModel.finalist!;
  const championRoster = rosterLabel(champion.roster);
  const finalistRoster = rosterLabel(finalist.roster);
  return (
    <main
      className={`kr-champion-overlay-page${transparent ? " is-transparent" : " is-debug"}${
        connected ? " is-connected" : " is-disconnected"
      }`}
      data-state={viewModel.state}
      data-visual-key={viewModel.visualKey}
    >
      {!transparent ? <BackgroundParticles variant="graphite" /> : null}
      <div className="kr-champion-overlay-atmosphere" aria-hidden="true" />
      <section className="kr-champion-overlay-stage">
        <header>
          <span>BRACKETFLOW · ARENA DIGITAL</span>
          <strong>{viewModel.tournamentName}</strong>
          <i aria-label={connected ? "Datos conectados" : "Reconectando"} />
        </header>

        <div className="kr-champion-overlay-emblem" aria-hidden="true">
          <span className="kr-champion-overlay-laurel is-left" />
          <div className="kr-champion-overlay-trophy">
            <i className="kr-champion-overlay-cup" />
            <b>BF</b>
            <i className="kr-champion-overlay-stem" />
          </div>
          <span className="kr-champion-overlay-laurel is-right" />
        </div>

        <div className="kr-champion-overlay-hero">
          <span>CAMPEÓN CORONADO</span>
          <h1>{championRoster ?? champion.name}</h1>
          {championRoster ? <p>{champion.name}</p> : null}
        </div>

        <div className="kr-champion-overlay-final">
          <span>SERIE FINAL · BO{viewModel.bestOf}</span>
          <strong>
            {viewModel.finalScore?.champion}–{viewModel.finalScore?.finalist}
          </strong>
          <p>
            VS {finalistRoster ?? finalist.name}
            {finalistRoster ? <small>{finalist.name}</small> : null}
          </p>
        </div>

        <footer>
          <strong>{viewModel.confirmedKills} K CONFIRMADAS</strong>
          <i>·</i>
          <strong>{viewModel.seriesWins} SERIES GANADAS</strong>
          <span>LAS BAJAS SON CONTEXTO DE RENDIMIENTO</span>
        </footer>
      </section>
    </main>
  );
}
