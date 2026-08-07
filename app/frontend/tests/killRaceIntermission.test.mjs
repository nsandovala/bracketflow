import assert from "node:assert/strict";
import test from "node:test";

import { buildKillRaceCasterState } from "../lib/killRaceCasterState.mjs";
import { buildKillRaceIntermission } from "../lib/killRaceIntermission.mjs";
import { resolveStreamSurface } from "../lib/streamRouting.mjs";
import {
  getFollowOperatorOverlayUrl,
  resolveBroadcastContext,
} from "../lib/broadcastChannel.mjs";

const tournament = (id = 10, status = "running") => ({
  id,
  name: `Arena ${id}`,
  status,
  bracket_status: status === "completed" ? "completed" : "running",
  config: {},
});

const teams = [
  { id: 1, name: "Aegis", tournament_id: 10, members: [] },
  { id: 2, name: "Vanguard", tournament_id: 10, members: [] },
];

const rosterTeams = [
  {
    ...teams[0],
    members: [
      { player_id: 13, player: { id: 13, nickname: "Manteca" } },
      { player_id: 11, player: { id: 11, nickname: "Nova" } },
    ],
  },
  {
    ...teams[1],
    members: [
      { player_id: 12, player: { id: 12, nickname: "Rook" } },
      { player_id: 14, player: { id: 14, nickname: "Iris" } },
    ],
  },
];

const player = (id, name, side, kills) => ({
  player_id: id,
  player_name: name,
  side,
  kills,
});

const map = ({
  id = 100,
  number = 1,
  status = "confirmed",
  killsA = 12,
  killsB = 9,
  winnerId = 1,
  stats = [],
} = {}) => ({
  id,
  match_id: 90,
  map_number: number,
  result_status: status,
  kills_a: killsA,
  kills_b: killsB,
  map_winner_id: winnerId,
  player_stats: stats,
});

const match = ({
  id = 90,
  tournamentId = 10,
  status = "ready",
  winnerId = null,
  maps = [],
  scoreA = 0,
  scoreB = 0,
  nextMatchId = 99,
} = {}) => ({
  id,
  tournament_id: tournamentId,
  round: 1,
  status,
  team_a_id: 1,
  team_b_id: 2,
  winner_id: winnerId,
  best_of: 3,
  next_match_id: nextMatchId,
  next_slot: "a",
  maps,
  maps_won_a: scoreA,
  maps_won_b: scoreB,
});

function view({
  activeTournament = tournament(),
  broadcastMatch = match(),
  allMatches,
  allTeams = teams,
  channel = null,
  casterState,
} = {}) {
  const matches = allMatches ?? (broadcastMatch ? [broadcastMatch] : []);
  const state =
    casterState === undefined
      ? buildKillRaceCasterState({
          matches,
          teams: allTeams,
          broadcastMatchId: broadcastMatch?.id ?? null,
        })
      : casterState;
  return buildKillRaceIntermission({
    tournament: activeTournament,
    selectedEngine: { scoringProfile: "kill_race" },
    broadcastChannel: channel,
    broadcastMatch,
    teams: allTeams,
    matches,
    killRaceCasterState: state,
  });
}

test("channel without tournament produces NO_TOURNAMENT and clears stale data", () => {
  const result = view({
    activeTournament: null,
    broadcastMatch: null,
    channel: { activeTournamentId: null, broadcastMatchId: null },
  });
  assert.equal(result.state, "NO_TOURNAMENT");
  assert.equal(result.leftTeam, null);
  assert.equal(result.champion, null);
});

test("tournament without a valid broadcast match produces NO_MATCH", () => {
  const result = view({ broadcastMatch: null });
  assert.equal(result.state, "NO_MATCH");
  assert.equal(result.tournamentName, "Arena 10");
  assert.equal(result.matchId, null);
});

test("match without provisional or confirmed maps produces UPCOMING", () => {
  const result = view();
  assert.equal(result.state, "UPCOMING");
  assert.deepEqual(result.seriesScore, { left: 0, right: 0 });
  assert.equal(result.mapNumber, 1);
});

test("confirmed map in an open series produces BETWEEN_MAPS", () => {
  const result = view({
    broadcastMatch: match({ maps: [map()], scoreA: 1 }),
  });
  assert.equal(result.state, "BETWEEN_MAPS");
  assert.equal(result.nextMapNumber, 2);
});

test("current provisional map produces PROVISIONAL_REVIEW", () => {
  const result = view({
    broadcastMatch: match({ maps: [map({ status: "provisional" })] }),
  });
  assert.equal(result.state, "PROVISIONAL_REVIEW");
  assert.equal(result.currentProvisional.mapNumber, 1);
});

test("provisional data never modifies the confirmed series score", () => {
  const result = view({
    broadcastMatch: match({
      scoreA: 1,
      scoreB: 0,
      maps: [
        map({ id: 101, number: 1 }),
        map({ id: 102, number: 2, status: "provisional", killsA: 99, killsB: 1 }),
      ],
    }),
  });
  assert.deepEqual(result.seriesScore, { left: 1, right: 0 });
});

test("completed broadcast match produces SERIES_COMPLETE", () => {
  const result = view({
    broadcastMatch: match({
      status: "completed",
      winnerId: 1,
      scoreA: 2,
      scoreB: 0,
      maps: [map()],
    }),
  });
  assert.equal(result.state, "SERIES_COMPLETE");
  assert.equal(result.seriesWinner.name, "Aegis");
});

test("completed tournament with a real champion produces TOURNAMENT_COMPLETE", () => {
  const final = match({
    status: "completed",
    winnerId: 1,
    scoreA: 2,
    scoreB: 1,
    nextMatchId: null,
    maps: [map()],
  });
  const result = view({
    activeTournament: tournament(10, "completed"),
    broadcastMatch: final,
    allMatches: [final],
  });
  assert.equal(result.state, "TOURNAMENT_COMPLETE");
  assert.equal(result.champion.name, "Aegis");
});

test("latest confirmed map is selected deterministically by map number", () => {
  const result = view({
    broadcastMatch: match({
      scoreA: 1,
      scoreB: 1,
      maps: [map({ id: 103, number: 3 }), map({ id: 101, number: 1 }), map({ id: 102, number: 2 })],
    }),
  });
  assert.equal(result.lastConfirmedMap.mapNumber, 3);
});

test("provisional map does not replace the latest confirmed map", () => {
  const result = view({
    broadcastMatch: match({
      scoreA: 1,
      maps: [map({ id: 101, number: 1 }), map({ id: 102, number: 2, status: "provisional" })],
    }),
  });
  assert.equal(result.currentProvisional.mapNumber, 2);
  assert.equal(result.lastConfirmedMap.mapNumber, 1);
});

test("featured player uses confirmed analytics and ignores provisional stats", () => {
  const broadcast = match({
    scoreA: 1,
    maps: [
      map({
        id: 101,
        number: 1,
        stats: [player(11, "Nova", "left", 8), player(12, "Rook", "right", 5)],
      }),
    ],
  });
  const unrelatedProvisional = match({
    id: 91,
    maps: [
      {
        ...map({
          id: 102,
          number: 1,
          status: "provisional",
          stats: [player(12, "Rook", "right", 99)],
        }),
        match_id: 91,
      },
    ],
  });
  const result = view({
    broadcastMatch: broadcast,
    allMatches: [broadcast, unrelatedProvisional],
  });
  assert.equal(result.featuredPlayer.nickname, "Nova");
  assert.equal(result.featuredPlayer.confirmedKills, 8);
});

test("a single last-map leader produces one match featured player", () => {
  const result = view({
    broadcastMatch: match({
      scoreA: 1,
      maps: [
        map({
          stats: [player(11, "Nova", "left", 8), player(12, "Rook", "right", 5)],
        }),
      ],
    }),
  });
  assert.equal(result.featuredPlayer.nickname, "Nova");
  assert.equal(result.featuredPlayer.confirmedKills, 8);
  assert.equal(result.featuredIsTied, false);
  assert.deepEqual(result.featuredTiedPlayers.map((entry) => entry.playerId), [11]);
});

test("global tournament ranking cannot contaminate the broadcast-match feature", () => {
  const broadcast = match({
    scoreA: 1,
    maps: [map({ stats: [player(11, "Nova", "left", 8)] })],
  });
  const unrelated = match({
    id: 91,
    scoreB: 1,
    maps: [
      {
        ...map({ id: 201, stats: [player(14, "Iris", "right", 99)] }),
        match_id: 91,
      },
    ],
  });
  const result = view({ broadcastMatch: broadcast, allMatches: [broadcast, unrelated] });
  assert.equal(result.featuredPlayer.nickname, "Nova");
  assert.deepEqual(result.featuredTiedPlayers.map((entry) => entry.playerId), [11]);
});

test("the latest confirmed map owns the feature instead of series totals", () => {
  const result = view({
    broadcastMatch: match({
      scoreA: 1,
      scoreB: 1,
      maps: [
        map({ id: 101, number: 1, stats: [player(11, "Nova", "left", 30)] }),
        map({
          id: 102,
          number: 2,
          winnerId: 2,
          stats: [player(11, "Nova", "left", 5), player(12, "Rook", "right", 9)],
        }),
      ],
    }),
  });
  assert.equal(result.lastConfirmedMap.mapNumber, 2);
  assert.equal(result.featuredPlayer.nickname, "Rook");
  assert.equal(result.featuredPlayer.confirmedKills, 9);
});

test("a provisional map neither creates nor breaks the official last-map tie", () => {
  const result = view({
    broadcastMatch: match({
      scoreA: 1,
      maps: [
        map({
          id: 101,
          number: 1,
          stats: [player(11, "Nova", "left", 12), player(12, "Rook", "right", 12)],
        }),
        map({
          id: 102,
          number: 2,
          status: "provisional",
          stats: [player(14, "Iris", "right", 80)],
        }),
      ],
    }),
  });
  assert.equal(result.state, "PROVISIONAL_REVIEW");
  assert.equal(result.featuredIsTied, true);
  assert.deepEqual(result.featuredTiedPlayers.map((entry) => entry.playerId), [11, 12]);
  assert.equal(result.featuredPlayer.nickname, "Nova");
  assert.deepEqual(result.seriesScore, { left: 1, right: 0 });
});

test("a max-kill tie prioritizes the confirmed map winner", () => {
  const result = view({
    allTeams: rosterTeams,
    broadcastMatch: match({
      scoreB: 1,
      maps: [
        map({
          winnerId: 2,
          stats: [player(11, "Nova", "left", 12), player(12, "Rook", "right", 12)],
        }),
      ],
    }),
  });
  assert.equal(result.featuredPlayer.nickname, "Rook");
  assert.equal(result.featuredIsTied, true);
  assert.deepEqual(result.featuredTiedPlayers.map((entry) => entry.playerId), [12, 11]);
});

test("a tie inside the winner uses roster order and ignores player_stats order", () => {
  const first = view({
    allTeams: rosterTeams,
    broadcastMatch: match({
      scoreA: 1,
      maps: [
        map({
          stats: [player(11, "Nova", "left", 12), player(13, "Manteca", "left", 12)],
        }),
      ],
    }),
  });
  const reordered = view({
    allTeams: rosterTeams,
    broadcastMatch: match({
      scoreA: 1,
      maps: [
        map({
          stats: [player(13, "Manteca", "left", 12), player(11, "Nova", "left", 12)],
        }),
      ],
    }),
  });
  assert.equal(first.featuredPlayer.nickname, "Manteca");
  assert.equal(reordered.featuredPlayer.nickname, "Manteca");
  assert.deepEqual(first.featuredTiedPlayers, reordered.featuredTiedPlayers);
  assert.equal(first.visualKey, reordered.visualKey);
});

test("identical polling preserves the same feature and visualKey", () => {
  const payload = match({
    scoreA: 1,
    maps: [
      map({ stats: [player(11, "Nova", "left", 12), player(12, "Rook", "right", 10)] }),
    ],
  });
  const first = view({ broadcastMatch: payload });
  const second = view({ broadcastMatch: structuredClone(payload) });
  assert.deepEqual(first.featuredPlayer, second.featuredPlayer);
  assert.equal(first.visualKey, second.visualKey);
});

test("changing the latest confirmed map updates the feature and visualKey", () => {
  const first = view({
    broadcastMatch: match({
      scoreA: 1,
      maps: [map({ stats: [player(11, "Nova", "left", 12)] })],
    }),
  });
  const second = view({
    broadcastMatch: match({
      scoreA: 1,
      scoreB: 1,
      maps: [
        map({ id: 101, number: 1, stats: [player(11, "Nova", "left", 12)] }),
        map({
          id: 102,
          number: 2,
          winnerId: 2,
          stats: [player(12, "Rook", "right", 13)],
        }),
      ],
    }),
  });
  assert.equal(first.featuredPlayer.nickname, "Nova");
  assert.equal(second.featuredPlayer.nickname, "Rook");
  assert.notEqual(first.visualKey, second.visualKey);
});

test("changing only the tie composition changes visualKey and preserves every tied player", () => {
  const solo = view({
    broadcastMatch: match({
      scoreA: 1,
      maps: [map({ stats: [player(11, "Nova", "left", 12)] })],
    }),
  });
  const tied = view({
    broadcastMatch: match({
      scoreA: 1,
      maps: [
        map({ stats: [player(11, "Nova", "left", 12), player(13, "Manteca", "left", 12)] }),
      ],
    }),
  });
  assert.equal(solo.featuredPlayer.nickname, tied.featuredPlayer.nickname);
  assert.equal(tied.featuredIsTied, true);
  assert.deepEqual(tied.featuredTiedPlayers.map((entry) => entry.playerId), [11, 13]);
  assert.notEqual(solo.visualKey, tied.visualKey);
});

test("missing player stats never invent an MVP", () => {
  const result = view({
    broadcastMatch: match({ maps: [map()], scoreA: 1 }),
  });
  assert.equal(result.featuredPlayer, null);
  assert.equal(result.featuredEmptyMessage, "Sin desglose individual");
});

test("tournament switch changes visualKey", () => {
  const first = view();
  const secondMatch = match({ tournamentId: 11 });
  const second = view({
    activeTournament: tournament(11),
    broadcastMatch: secondMatch,
    allTeams: teams.map((team) => ({ ...team, tournament_id: 11 })),
  });
  assert.notEqual(first.visualKey, second.visualKey);
});

test("state transition changes visualKey", () => {
  const upcoming = view();
  const review = view({
    broadcastMatch: match({ maps: [map({ status: "provisional" })] }),
  });
  assert.notEqual(upcoming.visualKey, review.visualKey);
});

test("unchanged polling payload preserves visualKey", () => {
  const payload = match({ maps: [map()], scoreA: 1 });
  const first = view({ broadcastMatch: payload });
  const second = view({ broadcastMatch: structuredClone(payload) });
  assert.equal(first.visualKey, second.visualKey);
});

test("intermission layout routes to the intermission surface", () => {
  assert.equal(
    resolveStreamSurface("intermission", { isKillRace: true, isBracket: true }),
    "intermission"
  );
});

test("intermission layout never falls through to scorebug", () => {
  assert.notEqual(
    resolveStreamSurface("intermission", { isKillRace: true, isBracket: true }),
    "scorebug"
  );
});

test("intermission layout never falls through to bracket", () => {
  assert.notEqual(
    resolveStreamSurface("intermission", { isKillRace: true, isBracket: true }),
    "bracket"
  );
});

test("explicit match id keeps priority for intermission context", () => {
  assert.deepEqual(
    resolveBroadcastContext({
      explicitTournamentId: 10,
      explicitMatchId: 91,
      channel: { activeTournamentId: 11, broadcastMatchId: 92 },
    }),
    { tournamentId: 10, matchId: 91, source: "explicit" }
  );
});

test("channel main continues resolving tournament and broadcast match", () => {
  assert.deepEqual(
    resolveBroadcastContext({
      explicitTournamentId: null,
      explicitMatchId: null,
      channel: { activeTournamentId: 10, broadcastMatchId: 90 },
    }),
    { tournamentId: 10, matchId: 90, source: "channel" }
  );
});

test("BR and Resurgence return an honest incompatible intermission surface", () => {
  assert.equal(
    resolveStreamSurface("intermission", { isKillRace: false, isBracket: false }),
    "unsupported-intermission"
  );
  assert.equal(
    resolveStreamSurface("intermission", { isKillRace: false, isBracket: true }),
    "unsupported-intermission"
  );
});

test("Caster Hub intermission launcher exposes the stable full-background URL", () => {
  assert.equal(
    getFollowOperatorOverlayUrl("http://localhost:3000", "intermission", "main", false),
    "http://localhost:3000/stream?channel=main&layout=intermission&obs=1"
  );
  assert.equal(
    getFollowOperatorOverlayUrl("http://localhost:3000", "intermission", "main", true),
    "http://localhost:3000/stream?channel=main&layout=intermission&obs=1&bg=transparent"
  );
});

test("transparent intermission keeps the same routing and stable data context", () => {
  const result = view({
    broadcastMatch: match({
      scoreA: 1,
      maps: [map({ stats: [player(11, "Nova", "left", 9)] })],
    }),
  });
  assert.equal(
    resolveStreamSurface("intermission", { isKillRace: true, isBracket: true }),
    "intermission"
  );
  assert.match(
    getFollowOperatorOverlayUrl("http://localhost:3000", "intermission", "main", true),
    /layout=intermission.*bg=transparent/
  );
  assert.equal(result.state, "BETWEEN_MAPS");
  assert.deepEqual(result.seriesScore, { left: 1, right: 0 });
  assert.equal(result.featuredPlayer.nickname, "Nova");
});
