"use client";

import { MatchPointStatus } from "../../lib/tournamentStatus";

type Props = {
  status: MatchPointStatus;
  tournamentName: string | null;
  transparent: boolean;
  connected: boolean;
};

const REASON_LABELS: Record<string, string> = {
  incomplete_match: "Falta cerrar la partida en curso",
  tie: "Empate en la cima — falta desempate",
  pending_sync: "A la espera de confirmación oficial",
};

// Alerta standalone de match point. Nunca inventa estado: si no hay match
// point real, en modo transparente no pinta nada (OBS-safe) y en modo
// normal muestra solo un chip de debug.
export default function StreamOverlayMatchPoint({
  status,
  tournamentName,
  transparent,
  connected,
}: Props) {
  if (status.state === "idle") {
    if (transparent) {
      return null;
    }
    return <div className="bf-ov-empty-chip">Sin match point</div>;
  }

  const isChampion = status.state === "champion";
  const kicker = isChampion ? "Campeón por Match Point" : "Match Point alcanzado";
  const teamLabel = isChampion ? status.championLabel : status.leaderName;
  const detail = isChampion
    ? `Objetivo ${status.threshold} pts asegurado`
    : REASON_LABELS[status.reason] ?? "Condición pendiente de resolver";
  const scoreline = isChampion
    ? null
    : `${status.leaderPoints.toFixed(1)} pts · objetivo ${status.threshold}`;

  return (
    <div className={`bf-ov-mp${isChampion ? " is-champion" : ""}`}>
      <div className="bf-ov-mp-head">
        <span
          className="bf-ov-mp-dot"
          style={connected ? undefined : { opacity: 0.4 }}
        />
        <span className="bf-ov-mp-kicker">{kicker}</span>
      </div>
      <div className="bf-ov-mp-team">{teamLabel}</div>
      <div className="bf-ov-mp-detail">
        {scoreline && <span className="bf-ov-mp-score">{scoreline}</span>}
        <span className="bf-ov-mp-reason">{detail}</span>
      </div>
      <div className="bf-ov-mp-footer">
        <span>BracketFlow</span>
        <span>{tournamentName ?? "World Series"}</span>
      </div>
    </div>
  );
}
