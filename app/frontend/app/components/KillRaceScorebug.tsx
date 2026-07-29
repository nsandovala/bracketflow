"use client";

import { Match, Team } from "../../lib/api";
import {
  calculatePlayerTotal,
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
        <div className="kr-scorebug is-empty">Esperando una serie jugable</div>
      </main>
    );
  }
  const current =
    match.maps.find((item) => item.result_status !== "confirmed") ??
    match.maps.slice().sort((a, b) => b.map_number - a.map_number)[0] ??
    null;
  const leftTeam = teams.find((team) => team.id === match.team_a_id);
  const rightTeam = teams.find((team) => team.id === match.team_b_id);
  const leftStats = current?.player_stats.filter((player) => player.side === "left") ?? [];
  const rightStats = current?.player_stats.filter((player) => player.side === "right") ?? [];
  const leftTotal = current ? calculatePlayerTotal(leftStats) : null;
  const rightTotal = current ? calculatePlayerTotal(rightStats) : null;
  const leader =
    leftTotal === null || rightTotal === null || leftTotal === rightTotal
      ? null
      : leftTotal > rightTotal ? "left" : "right";
  const status = getKillRaceBroadcastStatus(
    current?.result_status ?? (match.status === "in_progress" ? "live" : "pending"),
    connected
  );
  const visualKey = killRaceVisualKey(tournamentId, match);

  return (
    <main className="kr-scorebug-stage" aria-label="Kill Race scorebug">
      <section className="kr-scorebug" key={visualKey}>
        <header className="kr-scorebug-head">
          <span>PARTIDA {current?.map_number ?? match.maps.length + 1} · BO{match.best_of}</span>
          <strong className={`is-${status.toLowerCase()}`}>{status}</strong>
        </header>
        <div className={`kr-scorebug-team is-left${leader === "left" ? " is-leading" : ""}`}>
          <h2>{leftTeam?.name ?? "Por definir"}</h2>
          <div className="kr-scorebug-player-list">
            {(current ? leftStats : leftTeam?.members ?? []).map((entry) => {
              const isStat = "player_name" in entry;
              return <p key={isStat ? entry.player_id : entry.player.id}>
                <span>{isStat ? entry.player_name : entry.player.nickname}</span>
                <b>{isStat ? `${entry.kills} K` : "—"}</b>
              </p>;
            })}
          </div>
          <footer><span>TOTAL</span><b>{leftTotal === null ? "—" : `${leftTotal} K`}</b></footer>
        </div>
        <div className="kr-scorebug-series">
          <span>SERIE</span>
          <strong>{match.maps_won_a}<i>—</i>{match.maps_won_b}</strong>
        </div>
        <div className={`kr-scorebug-team is-right${leader === "right" ? " is-leading" : ""}`}>
          <h2>{rightTeam?.name ?? "Por definir"}</h2>
          <div className="kr-scorebug-player-list">
            {(current ? rightStats : rightTeam?.members ?? []).map((entry) => {
              const isStat = "player_name" in entry;
              return <p key={isStat ? entry.player_id : entry.player.id}>
                <span>{isStat ? entry.player_name : entry.player.nickname}</span>
                <b>{isStat ? `${entry.kills} K` : "—"}</b>
              </p>;
            })}
          </div>
          <footer><span>TOTAL</span><b>{rightTotal === null ? "—" : `${rightTotal} K`}</b></footer>
        </div>
      </section>
    </main>
  );
}
