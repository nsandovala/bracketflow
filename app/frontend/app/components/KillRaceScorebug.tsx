"use client";

import { Match, Team } from "../../lib/api";
import { getKillRaceBroadcastStatus } from "../../lib/killRaceBroadcast.mjs";

type Props = { match: Match | null; teams: Team[]; connected: boolean };

function side(match: Match, teams: Team[], value: "left" | "right") {
  const teamId = value === "left" ? match.team_a_id : match.team_b_id;
  const current =
    match.maps.find((item) => item.result_status !== "confirmed") ??
    match.maps.slice().sort((a, b) => b.map_number - a.map_number)[0];
  return {
    name: teams.find((candidate) => candidate.id === teamId)?.name ?? "Por definir",
    kills: value === "left" ? current?.kills_a ?? 0 : current?.kills_b ?? 0,
    stats: current?.player_stats.filter((player) => player.side === value) ?? [],
    map: current?.map_number ?? match.maps.length + 1,
    status: current?.result_status ?? (match.status === "in_progress" ? "live" : "pending"),
  };
}

export default function KillRaceScorebug({ match, teams, connected }: Props) {
  if (!match) {
    return <main className="kr-scorebug-stage"><div className="kr-scorebug is-empty">Esperando serie</div></main>;
  }
  const left = side(match, teams, "left");
  const right = side(match, teams, "right");
  const status = getKillRaceBroadcastStatus(left.status, connected);
  return (
    <main className="kr-scorebug-stage" aria-label="Kill Race scorebug">
      <section className="kr-scorebug">
        <div className="kr-scorebug-side is-left">
          <strong>{left.name}</strong>
          <span>{left.stats.map((item) => `${item.player_name} ${item.kills}`).join(" · ") || "Sin desglose"}</span>
        </div>
        <b className="kr-scorebug-kills" key={`l-${left.kills}`}>{left.kills}<small>KILLS</small></b>
        <div className="kr-scorebug-center">
          <strong>{match.maps_won_a}–{match.maps_won_b}</strong>
          <span>PARTIDA {left.map} · {status}</span>
        </div>
        <b className="kr-scorebug-kills" key={`r-${right.kills}`}>{right.kills}<small>KILLS</small></b>
        <div className="kr-scorebug-side is-right">
          <strong>{right.name}</strong>
          <span>{right.stats.map((item) => `${item.player_name} ${item.kills}`).join(" · ") || "Sin desglose"}</span>
        </div>
      </section>
    </main>
  );
}
