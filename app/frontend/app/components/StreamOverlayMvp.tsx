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
  const label = isPlayerMvp ? "MVP actual" : "Team MVP";
  const name = isPlayerMvp ? mvp.playerName : mvp.teamName;
  const subline = isPlayerMvp
    ? mvp.teamName
    : "MVP pendiente: faltan player stats";

  return (
    <div className="bf-ov-mvp">
      <div className="bf-ov-mvp-badge">{getInitials(name)}</div>
      <div className="bf-ov-mvp-body">
        <div className="bf-ov-mvp-kicker">
          <span
            className="bf-ov-mvp-dot"
            style={connected ? undefined : { opacity: 0.4 }}
          />
          {label}
        </div>
        <div className="bf-ov-mvp-name">{name}</div>
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
