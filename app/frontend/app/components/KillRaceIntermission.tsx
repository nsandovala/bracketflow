"use client";

import type {
  KillRaceIntermissionMap,
  KillRaceIntermissionViewModel,
} from "../../lib/killRaceIntermission.mjs";
import BackgroundParticles from "./BackgroundParticles";

type Props = {
  viewModel: KillRaceIntermissionViewModel;
  connected: boolean;
  transparent: boolean;
};

function formatAverage(value: number | null) {
  if (value === null) return null;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function MapResult({
  map,
  leftTeamName,
  rightTeamName,
}: {
  map: KillRaceIntermissionMap;
  leftTeamName: string;
  rightTeamName: string;
}) {
  return (
    <section
      className={`kr-intermission-card kr-intermission-map is-${map.status}`}
      aria-label={map.label}
    >
      <header className="kr-intermission-card-head">
        <span>{map.label}</span>
        <strong>PARTIDA {map.mapNumber}</strong>
      </header>
      <div className="kr-intermission-map-score">
        <div className={map.winnerSide === "left" ? "is-winner" : ""}>
          <span>{leftTeamName}</span>
          <strong>{map.killsLeft}</strong>
        </div>
        <i>—</i>
        <div className={map.winnerSide === "right" ? "is-winner" : ""}>
          <strong>{map.killsRight}</strong>
          <span>{rightTeamName}</span>
        </div>
      </div>
      {(map.leftPlayers.length > 0 || map.rightPlayers.length > 0) && (
        <div className="kr-intermission-map-players">
          <div>
            {map.leftPlayers.map((player) => (
              <p key={`${player.playerId}:${player.nickname}`}>
                <span>{player.nickname}</span>
                <b>{player.kills} K</b>
              </p>
            ))}
          </div>
          <div>
            {map.rightPlayers.map((player) => (
              <p key={`${player.playerId}:${player.nickname}`}>
                <b>{player.kills} K</b>
                <span>{player.nickname}</span>
              </p>
            ))}
          </div>
        </div>
      )}
      <footer>
        {map.status === "provisional" ? "PROVISIONAL" : map.winnerName ?? "Resultado confirmado"}
      </footer>
    </section>
  );
}

function IntermissionFrame({
  children,
  transparent,
  connected,
}: {
  children: React.ReactNode;
  transparent: boolean;
  connected: boolean;
}) {
  return (
    <main
      className={`bf-stream-page kr-intermission-page${transparent ? " is-transparent bf-stream-transparent" : ""}${
        connected ? " is-connected" : " is-disconnected"
      }`}
    >
      {!transparent && <BackgroundParticles variant="graphite" />}
      <div className="kr-intermission-atmosphere" aria-hidden="true" />
      {children}
    </main>
  );
}

export function KillRaceIntermissionUnavailable({
  transparent,
  connected,
}: Pick<Props, "transparent" | "connected">) {
  return (
    <IntermissionFrame transparent={transparent} connected={connected}>
      <section className="kr-intermission-shell is-unavailable">
        <header className="kr-intermission-header">
          <span className="kr-intermission-brand">BRACKETFLOW · ARENA DIGITAL</span>
          <span>FORMATO INCOMPATIBLE</span>
        </header>
        <div className="kr-intermission-empty">
          <span>ESCENA ENTRE PARTIDAS</span>
          <h1>INTERMISSION NO DISPONIBLE PARA ESTE FORMATO</h1>
          <p>Intermission disponible actualmente para Kill Race</p>
        </div>
        <footer className="kr-intermission-footer">
          <span className="kr-intermission-signal" />
          <p>Bracketflow Arena</p>
        </footer>
      </section>
    </IntermissionFrame>
  );
}

export default function KillRaceIntermission({
  viewModel,
  connected,
  transparent,
}: Props) {
  const mapResult = viewModel.currentProvisional ?? viewModel.lastConfirmedMap;
  const hasSecondary = Boolean(mapResult || viewModel.featureLabel);
  const average = formatAverage(viewModel.featuredPlayer?.averageKills ?? null);
  const stateKicker =
    viewModel.heroVariant === "empty"
      ? viewModel.tournamentName ?? "ARENA EN ESPERA"
      : viewModel.detailMessage;

  return (
    <IntermissionFrame transparent={transparent} connected={connected}>
      <section
        className={`kr-intermission-shell is-${viewModel.state.toLowerCase()} is-hero-${viewModel.heroVariant}`}
        key={viewModel.visualKey}
        aria-label="Kill Race intermission"
      >
        <header className="kr-intermission-header">
          <span className="kr-intermission-brand">BRACKETFLOW · ARENA DIGITAL</span>
          {viewModel.tournamentName && (
            <span className="kr-intermission-tournament">{viewModel.tournamentName}</span>
          )}
          <span>{viewModel.headerMeta}</span>
        </header>

        <div className="kr-intermission-main">
          <div className="kr-intermission-state">
            <span>{stateKicker}</span>
            <h1>{viewModel.title}</h1>
          </div>

          {viewModel.heroVariant === "empty" && (
            <div className="kr-intermission-empty">
              <p>{viewModel.message}</p>
              {viewModel.detailMessage && <small>{viewModel.detailMessage}</small>}
            </div>
          )}

          {viewModel.heroVariant === "matchup" && viewModel.leftTeam && viewModel.rightTeam && (
            <div className="kr-intermission-matchup">
              <h2>{viewModel.leftTeam.name}</h2>
              <div className="kr-intermission-series-score" aria-label="Marcador de serie">
                <strong>{viewModel.seriesScore.left}</strong>
                <i>—</i>
                <strong>{viewModel.seriesScore.right}</strong>
              </div>
              <h2>{viewModel.rightTeam.name}</h2>
            </div>
          )}

          {viewModel.heroVariant === "champion" && viewModel.champion && (
            <div className="kr-intermission-champion">
              <span>{viewModel.winnerAnnouncement}</span>
              <h2>{viewModel.champion.name}</h2>
              {viewModel.seriesScore.left !== null && viewModel.seriesScore.right !== null && (
                <p>
                  SERIE FINAL · <strong>{viewModel.seriesScore.left}</strong>
                  <i>—</i>
                  <strong>{viewModel.seriesScore.right}</strong>
                </p>
              )}
            </div>
          )}

          {viewModel.winnerAnnouncement && viewModel.heroVariant === "matchup" && (
            <p className="kr-intermission-winner">{viewModel.winnerAnnouncement}</p>
          )}

          {hasSecondary && (
            <div className="kr-intermission-secondary">
              {mapResult && (
                <MapResult
                  map={mapResult}
                  leftTeamName={viewModel.leftTeam?.name ?? "Equipo izquierdo"}
                  rightTeamName={viewModel.rightTeam?.name ?? "Equipo derecho"}
                />
              )}
              {viewModel.featureLabel && (
                <section className="kr-intermission-card kr-intermission-featured">
                  <header className="kr-intermission-card-head">
                    <span>{viewModel.featureLabel}</span>
                    <strong>{viewModel.featuredPlayer?.teamName ?? "DATOS OFICIALES"}</strong>
                  </header>
                  {viewModel.featuredPlayer ? (
                    <div className="kr-intermission-player">
                      <div>
                        <span>{viewModel.featuredPlayer.teamName}</span>
                        <h3>{viewModel.featuredPlayer.nickname}</h3>
                      </div>
                      <strong>{viewModel.featuredPlayer.confirmedKills}<small>K</small></strong>
                      <p className="kr-intermission-player-meta">
                        <span>
                          {viewModel.featuredPlayer.isMvp
                            ? `${viewModel.featuredPlayer.confirmedMaps} mapas con estadísticas`
                            : "Último mapa confirmado"}
                        </span>
                        {viewModel.featuredIsTied && (
                          <span className="kr-intermission-player-tie">EMPATADO EN BAJAS</span>
                        )}
                        {average !== null && <span>Promedio oficial {average}</span>}
                      </p>
                    </div>
                  ) : (
                    <p className="kr-intermission-featured-empty">
                      {viewModel.featuredEmptyMessage}
                    </p>
                  )}
                </section>
              )}
            </div>
          )}
        </div>

        <footer className="kr-intermission-footer">
          <span className="kr-intermission-signal" />
          <p>{viewModel.message}</p>
          <span>{connected ? "SISTEMA LISTO" : "RECONECTANDO"}</span>
        </footer>
      </section>
    </IntermissionFrame>
  );
}
