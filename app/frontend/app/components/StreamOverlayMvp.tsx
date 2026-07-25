"use client";

import { TeamResultDetail } from "../../lib/api";
import { getMvpState } from "../../lib/mvp";
import { StreamStanding } from "../lib/useStreamLeaderboard";

type Props = {
  results: TeamResultDetail[];
  standings: StreamStanding[];
  tournamentName: string | null;
  connected: boolean;
};

// Limite de nombres visibles en el overlay MVP EMPATADO. Mas alla mostramos "+N".
const MAX_TIED_NAMES = 3;

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export default function StreamOverlayMvp({
  results,
  standings,
  tournamentName,
  connected,
}: Props) {
  const mvp = getMvpState(results, standings);

  if (mvp.kind === "pending") {
    return <div className="bf-ov-empty-chip">MVP pendiente: faltan player stats</div>;
  }

  const isPlayerMvp = mvp.kind === "player";
  const isTiedMvp = isPlayerMvp && mvp.tiedWith.length > 0;
  const label = isTiedMvp ? "MVP EMPATADO" : isPlayerMvp ? "MVP actual" : "Team MVP";
  const name = isPlayerMvp ? mvp.playerName : mvp.teamName;
  const subline = isPlayerMvp
    ? mvp.teamName
    : "MVP pendiente: faltan player stats";

  const tiedNames = isTiedMvp
    ? [mvp.playerName, ...mvp.tiedWith.map((entry) => entry.playerName)]
    : [];
  const visibleTiedNames = tiedNames.slice(0, MAX_TIED_NAMES);
  const hiddenTied = tiedNames.length - visibleTiedNames.length;

  return (
    <div className={`bf-ov-mvp${isTiedMvp ? " is-tied" : ""}`}>
      <div className="bf-ov-mvp-badge">{isTiedMvp ? "T" : getInitials(name)}</div>
      <div className="bf-ov-mvp-body">
        <div className="bf-ov-mvp-kicker">
          <span
            className="bf-ov-mvp-dot"
            style={connected ? undefined : { opacity: 0.4 }}
          />
          {label}
        </div>
        {isTiedMvp ? (
          <div className="bf-ov-mvp-tied-list">
            {visibleTiedNames.map((tiedName) => (
              <span key={tiedName} className="bf-ov-mvp-tied-name">
                {tiedName}
              </span>
            ))}
            {hiddenTied > 0 ? (
              <span className="bf-ov-mvp-tied-more">+{hiddenTied}</span>
            ) : null}
          </div>
        ) : (
          <div className="bf-ov-mvp-name">{name}</div>
        )}
        <div className="bf-ov-mvp-team">{subline}</div>
        <div className="bf-ov-mvp-stats">
          {isPlayerMvp ? (
            <>
              <span className="bf-ov-mvp-stat">
                <strong>{mvp.kills}</strong> kills
              </span>
              <span className="bf-ov-mvp-stat">
                <strong>{mvp.matches}</strong> partidas
              </span>
            </>
          ) : (
            <>
              <span className="bf-ov-mvp-stat">
                <strong>{mvp.kills}</strong> kills
              </span>
              <span className="bf-ov-mvp-stat">
                <strong>{mvp.totalPoints.toFixed(1)}</strong> pts
              </span>
            </>
          )}
        </div>
      </div>
      <div className="bf-ov-mvp-brand">{tournamentName ?? "BracketFlow"}</div>
    </div>
  );
}
