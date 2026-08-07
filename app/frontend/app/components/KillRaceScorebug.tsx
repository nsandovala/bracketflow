"use client";

import { Match, Team } from "../../lib/api";
import {
  calculatePlayerTotalOrNull,
  getKillRaceBroadcastStatus,
  killRaceVisualKey,
} from "../../lib/killRaceBroadcast.mjs";

type Props = {
  tournamentId: number | null;
  match: Match | null;
  teams: Team[];
  connected: boolean;
};

export default function KillRaceScorebug({ tournamentId, match, teams, connected }: Props) {
  if (!match) {
    return (
      <main className="kr-scorebug-stage">
        <section className="kr-scorebug is-empty" role="status">
          <strong>SIN SERIE AL AIRE</strong>
          <span>Operator todavía no ha enviado una serie a transmisión.</span>
        </section>
      </main>
    );
  }
  const current =
    match.maps.find((item) => item.result_status !== "confirmed") ??
    match.maps.slice().sort((a, b) => b.map_number - a.map_number)[0] ??
    null;
  const leftTeam = teams.find((team) => team.id === match.team_a_id);
  const rightTeam = teams.find((team) => team.id === match.team_b_id);
  const leftStats = current?.player_stats.filter((player) => player.side === "left").slice(0, 2) ?? [];
  const rightStats = current?.player_stats.filter((player) => player.side === "right").slice(0, 2) ?? [];
  const leftTotal = calculatePlayerTotalOrNull(leftStats);
  const rightTotal = calculatePlayerTotalOrNull(rightStats);
  const leftRows = leftStats.length > 0 ? leftStats : (leftTeam?.members ?? []).slice(0, 2);
  const rightRows = rightStats.length > 0 ? rightStats : (rightTeam?.members ?? []).slice(0, 2);
  const leader =
    leftTotal === null || rightTotal === null || leftTotal === rightTotal
      ? null
      : leftTotal > rightTotal ? "left" : "right";
  const status = getKillRaceBroadcastStatus(
    current?.result_status ?? (match.status === "in_progress" ? "live" : "pending"),
    connected
  );
  const visualKey = killRaceVisualKey(tournamentId, match);
  const statusTone = status.toLowerCase().replaceAll(" ", "-");

  return (
    <main className="kr-scorebug-stage" aria-label="Kill Race scorebug">
      <section className="kr-scorebug" data-state={statusTone} data-visual-key={visualKey}>
        <header className="kr-scorebug-head">
          <span>PARTIDA {current?.map_number ?? match.maps.length + 1} · BO{match.best_of}</span>
          <strong className={`is-${statusTone}`}>{status}</strong>
        </header>
        <div className={`kr-scorebug-team is-left${leader === "left" ? " is-leading" : ""}`}>
          <h2>{leftTeam?.name ?? "Por definir"}</h2>
          <div className="kr-scorebug-player-list">
            {leftRows.map((entry) => {
              const isStat = "player_name" in entry;
              return <p key={isStat ? entry.player_id : entry.player.id}>
                <span>{isStat ? entry.player_name : entry.player.nickname}</span>
                <b>{isStat ? `${entry.kills} K` : "—"}</b>
              </p>;
            })}
          </div>
          <footer><span>BAJAS</span><b>{leftTotal === null ? "—" : `${leftTotal} K`}</b></footer>
        </div>
        <div className="kr-scorebug-series">
          <span>SERIE</span>
          <strong>{match.maps_won_a}<i>—</i>{match.maps_won_b}</strong>
        </div>
        <div className={`kr-scorebug-team is-right${leader === "right" ? " is-leading" : ""}`}>
          <h2>{rightTeam?.name ?? "Por definir"}</h2>
          <div className="kr-scorebug-player-list">
            {rightRows.map((entry) => {
              const isStat = "player_name" in entry;
              return <p key={isStat ? entry.player_id : entry.player.id}>
                <span>{isStat ? entry.player_name : entry.player.nickname}</span>
                <b>{isStat ? `${entry.kills} K` : "—"}</b>
              </p>;
            })}
          </div>
          <footer><span>BAJAS</span><b>{rightTotal === null ? "—" : `${rightTotal} K`}</b></footer>
        </div>
      </section>
    </main>
  );
}
