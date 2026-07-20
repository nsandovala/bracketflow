"use client";

import { TeamResultDetail } from "../../lib/api";
import { StreamStanding } from "../lib/useStreamLeaderboard";

type Props = {
  results: TeamResultDetail[];
  standings: StreamStanding[];
  tournamentName: string | null;
  connected: boolean;
};

type PlayerMvp = {
  playerName: string;
  teamName: string;
  kills: number;
  matches: number;
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

// MVP real desde player_stats reportadas. Suma kills por jugador a lo largo
// de todos los resultados disponibles. No inventa datos.
function buildPlayerMvp(results: TeamResultDetail[]): PlayerMvp | null {
  const byPlayer = new Map<string, PlayerMvp>();

  for (const result of results) {
    for (const stat of result.player_stats ?? []) {
      const name = stat.player_name.trim();
      if (!name) continue;
      const key = `${result.team_id}::${name.toLowerCase()}`;
      const current = byPlayer.get(key);
      if (current) {
        current.kills += stat.kills;
        current.matches += 1;
      } else {
        byPlayer.set(key, {
          playerName: name,
          teamName: result.team_name,
          kills: stat.kills,
          matches: 1,
        });
      }
    }
  }

  let best: PlayerMvp | null = null;
  for (const candidate of byPlayer.values()) {
    if (
      !best ||
      candidate.kills > best.kills ||
      (candidate.kills === best.kills &&
        candidate.playerName.localeCompare(best.playerName) < 0)
    ) {
      best = candidate;
    }
  }
  return best;
}

// Fallback sin player_stats: mejor equipo por kills (desempate por puntos).
function buildTeamMvp(standings: StreamStanding[]): StreamStanding | null {
  let best: StreamStanding | null = null;
  for (const entry of standings) {
    if (
      !best ||
      entry.kills > best.kills ||
      (entry.kills === best.kills && entry.total_points > best.total_points)
    ) {
      best = entry;
    }
  }
  return best;
}

export default function StreamOverlayMvp({
  results,
  standings,
  tournamentName,
  connected,
}: Props) {
  const playerMvp = buildPlayerMvp(results);
  const teamMvp = playerMvp ? null : buildTeamMvp(standings);

  if (!playerMvp && !teamMvp) {
    return <div className="bf-ov-empty-chip">Esperando stats</div>;
  }

  const label = playerMvp ? "MVP" : "Team MVP";
  const name = playerMvp ? playerMvp.playerName : teamMvp!.team_name;
  const subline = playerMvp
    ? playerMvp.teamName
    : teamMvp!.players.length > 0
      ? teamMvp!.players.join(" · ")
      : "Roster pendiente";

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
          {playerMvp ? (
            <>
              <span className="bf-ov-mvp-stat">
                <strong>{playerMvp.kills}</strong> kills
              </span>
              <span className="bf-ov-mvp-stat">
                <strong>{playerMvp.matches}</strong> partidas
              </span>
            </>
          ) : (
            <>
              <span className="bf-ov-mvp-stat">
                <strong>{teamMvp!.kills}</strong> kills
              </span>
              <span className="bf-ov-mvp-stat">
                <strong>{teamMvp!.total_points.toFixed(1)}</strong> pts
              </span>
            </>
          )}
        </div>
      </div>
      <div className="bf-ov-mvp-brand">{tournamentName ?? "BracketFlow"}</div>
    </div>
  );
}
