import assert from "node:assert/strict";
import test from "node:test";

import {
  KILL_RACE_STANDINGS_TABS,
  buildKillRaceStandings,
  createKillRaceStandingsUiState,
  normalizeStandingsPollMs,
  reconcileKillRaceStandingsUiState,
  reconcileStandingsSelection,
  resolveStandingsSurface,
  runSequentialPollCycle,
  toggleStandingsSelection,
} from "../lib/killRaceStandings.mjs";

const tournament = (id = 10, status = "running") => ({
  id,
  name: `Arena ${id}`,
  status,
  bracket_status: status === "completed" ? "completed" : "running",
});

const engine = {
  engineKey: "kill_race_bracket",
  scoringProfile: "kill_race",
  tournamentStructure: "single_elim",
};

const teams = [
  { id: 1, name: "Aegis", members: [{ player_id: 11, player: { id: 11, nickname: "Nova" } }] },
  { id: 2, name: "Blaze", members: [{ player_id: 12, player: { id: 12, nickname: "Rook" } }] },
  { id: 3, name: "Cipher", members: [{ player_id: 13, player: { id: 13, nickname: "Iris" } }] },
  { id: 4, name: "Drake", members: [{ player_id: 14, player: { id: 14, nickname: "Mako" } }] },
];

const stat = (playerId, playerName, side, kills) => ({
  player_id: playerId,
  player_name: playerName,
  side,
  kills,
});

const map = ({
  id = 1001,
  matchId = 101,
  number = 1,
  status = "confirmed",
  killsA = 12,
  killsB = 8,
  winnerId = 1,
  stats = [],
} = {}) => ({
  id,
  match_id: matchId,
  map_number: number,
  result_status: status,
  kills_a: killsA,
  kills_b: killsB,
  map_winner_id: winnerId,
  player_stats: stats,
});

const match = ({
  id = 101,
  round = 1,
  status = "ready",
  teamA = 1,
  teamB = 2,
  winnerId = null,
  scoreA = 0,
  scoreB = 0,
  maps = [],
  nextMatchId = 201,
} = {}) => ({
  id,
  round,
  status,
  team_a_id: teamA,
  team_b_id: teamB,
  winner_id: winnerId,
  best_of: 3,
  next_match_id: nextMatchId,
  next_slot: "a",
  tournament_id: 10,
  maps,
  maps_won_a: scoreA,
  maps_won_b: scoreB,
});

function view({ activeTournament = tournament(), allTeams = teams, matches = [], broadcastMatchId = null } = {}) {
  return buildKillRaceStandings({
    tournament: activeTournament,
    engine,
    teams: allTeams,
    matches,
    broadcastMatchId,
  });
}

function completedBracket() {
  return [
    match({ id: 101, status: "completed", winnerId: 1, scoreA: 2, maps: [map()] }),
    match({
      id: 102,
      status: "completed",
      teamA: 3,
      teamB: 4,
      winnerId: 3,
      scoreA: 2,
      maps: [map({ id: 1002, matchId: 102, winnerId: 3 })],
    }),
    match({
      id: 201,
      round: 2,
      status: "completed",
      teamA: 1,
      teamB: 3,
      winnerId: 1,
      scoreA: 2,
      scoreB: 1,
      nextMatchId: null,
      maps: [map({ id: 2001, matchId: 201, killsA: 14, killsB: 10 })],
    }),
  ];
}

test("only confirmed maps contribute team kills", () => {
  const result = view({
    matches: [
      match({
        maps: [map(), map({ id: 1002, number: 2, status: "provisional", killsA: 99 })],
      }),
    ],
  });
  assert.equal(result.teamRanking.find((team) => team.teamId === 1).confirmedKills, 12);
});

test("provisional maps do not modify team ranking", () => {
  const confirmed = view({ matches: [match({ maps: [map()] })] });
  const provisional = view({
    matches: [match({ maps: [map(), map({ id: 1002, number: 2, status: "provisional", killsB: 200 })] })],
  });
  assert.deepEqual(
    provisional.teamRanking.map((team) => [team.teamId, team.confirmedKills]),
    confirmed.teamRanking.map((team) => [team.teamId, team.confirmedKills])
  );
});

test("team average divides confirmed kills by confirmed maps", () => {
  const result = view({
    matches: [match({ maps: [map(), map({ id: 1002, number: 2, killsA: 8 })] })],
  });
  const aegis = result.teamRanking.find((team) => team.teamId === 1);
  assert.equal(aegis.confirmedKills, 20);
  assert.equal(aegis.confirmedMaps, 2);
  assert.equal(aegis.averageKills, 10);
});

test("team ranking orders by kills, maps, then team name", () => {
  const result = view({
    matches: [
      match({ maps: [map({ killsA: 10, killsB: 10, winnerId: 1 })] }),
      match({
        id: 102,
        teamA: 3,
        teamB: 4,
        maps: [
          map({ id: 1002, matchId: 102, killsA: 10, killsB: 4, winnerId: 3 }),
          map({ id: 1003, matchId: 102, number: 2, killsA: 0, killsB: 3, winnerId: 4 }),
        ],
      }),
    ],
  });
  assert.deepEqual(result.teamRanking.slice(0, 3).map((team) => team.teamName), ["Cipher", "Aegis", "Blaze"]);
});

test("gapToLeader is a negative kill delta", () => {
  const result = view({ matches: [match({ maps: [map({ killsA: 12, killsB: 8 })] })] });
  assert.equal(result.teamRanking.find((team) => team.teamId === 2).gapToLeader, -4);
});

test("performance leader does not receive a negative gap", () => {
  const result = view({ matches: [match({ maps: [map()] })] });
  assert.equal(result.teamRanking[0].gapToLeader, null);
});

test("series W-L derives exclusively from winner_id", () => {
  const result = view({ matches: completedBracket() });
  const aegis = result.teamRanking.find((team) => team.teamId === 1);
  const cipher = result.teamRanking.find((team) => team.teamId === 3);
  assert.deepEqual([aegis.seriesWins, aegis.seriesLosses], [2, 0]);
  assert.deepEqual([cipher.seriesWins, cipher.seriesLosses], [1, 1]);
});

test("map W-L derives only from confirmed map_winner_id", () => {
  const result = view({
    matches: [
      match({
        maps: [
          map(),
          map({ id: 1002, number: 2, winnerId: 2 }),
          map({ id: 1003, number: 3, status: "provisional", winnerId: 1 }),
        ],
      }),
    ],
  });
  const aegis = result.teamRanking.find((team) => team.teamId === 1);
  assert.deepEqual([aegis.mapsWon, aegis.mapsLost], [1, 1]);
});

test("champion comes from the real final match winner", () => {
  const result = view({ matches: completedBracket() });
  assert.deepEqual(result.summary.champion, { teamId: 1, teamName: "Aegis" });
});

test("completed final identifies the runner-up", () => {
  const result = view({ matches: completedBracket() });
  assert.equal(result.teamRanking.find((team) => team.teamId === 3).competitiveState, "SUBCAMPEÓN");
});

test("completed semifinal identifies an eliminated semifinalist", () => {
  const result = view({ matches: completedBracket() });
  assert.equal(
    result.teamRanking.find((team) => team.teamId === 2).competitiveState,
    "ELIMINADO EN SEMIFINAL"
  );
});

test("qualified team without an opponent waits for its rival", () => {
  const result = view({
    matches: [
      match({ status: "completed", winnerId: 1, scoreA: 2 }),
      match({ id: 102, teamA: 3, teamB: 4 }),
      match({ id: 201, round: 2, teamA: 1, teamB: null, nextMatchId: null, status: "waiting_opponent" }),
    ],
  });
  assert.equal(result.teamRanking.find((team) => team.teamId === 1).competitiveState, "ESPERANDO RIVAL");
});

test("teams assigned to an open final are EN FINAL", () => {
  const result = view({
    matches: [
      match({ status: "completed", winnerId: 1 }),
      match({ id: 102, teamA: 3, teamB: 4, status: "completed", winnerId: 3 }),
      match({ id: 201, round: 2, teamA: 1, teamB: 3, nextMatchId: null }),
    ],
  });
  assert.equal(result.teamRanking.find((team) => team.teamId === 1).competitiveState, "EN FINAL");
  assert.equal(result.teamRanking.find((team) => team.teamId === 3).competitiveState, "EN FINAL");
});

test("player ranking uses only confirmed player_stats", () => {
  const result = view({
    matches: [match({ maps: [map({ stats: [stat(11, "Nova", "left", 9)] })] })],
  });
  assert.equal(result.playerRanking[0].confirmedKills, 9);
});

test("provisional player_stats do not change player ranking", () => {
  const result = view({
    matches: [
      match({
        maps: [
          map({ stats: [stat(11, "Nova", "left", 9)] }),
          map({ id: 1002, number: 2, status: "provisional", stats: [stat(12, "Rook", "right", 99)] }),
        ],
      }),
    ],
  });
  assert.deepEqual(result.playerRanking.map((player) => player.nickname), ["Nova"]);
});

test("maps without player_stats never invent players", () => {
  assert.deepEqual(view({ matches: [match({ maps: [map()] })] }).playerRanking, []);
});

test("MVP ties preserve the same ranking and flags", () => {
  const result = view({
    matches: [
      match({ maps: [map({ stats: [stat(11, "Nova", "left", 9), stat(12, "Rook", "right", 9)] })] }),
    ],
  });
  assert.deepEqual(result.playerRanking.map((player) => player.rank), [1, 1]);
  assert.ok(result.playerRanking.every((player) => player.isMvp && player.isTiedMvp));
  assert.equal(result.summary.topPlayers.length, 2);
});

test("same player id on different teams cannot collide", () => {
  const result = view({
    matches: [
      match({ maps: [map({ stats: [stat(7, "Echo", "left", 8), stat(7, "Echo", "right", 7)] })] }),
    ],
  });
  assert.deepEqual(result.playerRanking.map((player) => player.playerKey).sort(), ["1:7", "2:7"]);
});

test("match history sorts phases and maps deterministically", () => {
  const result = view({
    matches: [
      match({ id: 201, round: 2, teamA: 1, teamB: 3, nextMatchId: null }),
      match({ maps: [map({ id: 1002, number: 2 }), map({ id: 1001, number: 1 })] }),
    ],
  });
  assert.deepEqual(result.matchHistory.map((entry) => entry.phaseLabel), ["Semifinal", "Final"]);
  assert.deepEqual(result.matchHistory[0].maps.map((entry) => entry.mapNumber), [1, 2]);
});

test("provisional map appears in history as review-only data", () => {
  const result = view({
    matches: [match({ maps: [map({ status: "provisional", killsA: 20, killsB: 19 })] })],
  });
  assert.equal(result.matchHistory[0].maps[0].resultStatus, "provisional");
  assert.equal(result.matchHistory[0].maps[0].winnerTeamId, null);
});

test("provisional does not alter official series score", () => {
  const result = view({
    matches: [match({ scoreA: 1, maps: [map(), map({ id: 1002, number: 2, status: "provisional" })] })],
  });
  assert.deepEqual(result.matchHistory[0].seriesScore, { left: 1, right: 0 });
});

test("visualKey changes when a map changes", () => {
  const first = view({ matches: [match({ maps: [map()] })] });
  const second = view({ matches: [match({ maps: [map({ killsA: 13 })] })] });
  assert.notEqual(first.visualKey, second.visualKey);
});

test("visualKey changes when winner_id changes", () => {
  assert.notEqual(
    view({ matches: [match()] }).visualKey,
    view({ matches: [match({ winnerId: 1 })] }).visualKey
  );
});

test("visualKey changes when player_stats change", () => {
  const first = view({ matches: [match({ maps: [map({ stats: [stat(11, "Nova", "left", 8)] })] })] });
  const second = view({ matches: [match({ maps: [map({ stats: [stat(11, "Nova", "left", 9)] })] })] });
  assert.notEqual(first.visualKey, second.visualKey);
});

test("visualKey remains stable for identical cloned data", () => {
  const matches = [match({ maps: [map({ stats: [stat(11, "Nova", "left", 8)] })] })];
  assert.equal(view({ matches }).visualKey, view({ matches: structuredClone(matches) }).visualKey);
});

test("tournament switch changes visualKey", () => {
  assert.notEqual(view().visualKey, view({ activeTournament: tournament(11) }).visualKey);
});

test("completed series total uses official winners", () => {
  assert.equal(view({ matches: completedBracket() }).summary.completedSeriesCount, 3);
});

test("bracket without confirmed maps exposes an honest empty performance state", () => {
  const result = view({ matches: [match()] });
  assert.equal(result.summary.confirmedMapCount, 0);
  assert.equal(result.summary.leader, null);
  assert.ok(result.teamRanking.every((team) => team.averageKills === null));
});

test("semifinal losers never receive an invented third-place field", () => {
  const eliminated = view({ matches: completedBracket() }).teamRanking.find((team) => team.teamId === 2);
  assert.equal(eliminated.competitiveState, "ELIMINADO EN SEMIFINAL");
  assert.equal("officialPlacement" in eliminated, false);
});

test("bracket summary identifies final and champion", () => {
  const result = view({ matches: completedBracket() });
  assert.deepEqual(result.bracketSummary, {
    totalMatches: 3,
    completedMatches: 3,
    openMatches: 0,
    finalMatchId: 201,
    championTeamId: 1,
  });
});

test("team selection opens, closes, and replaces", () => {
  let selected = toggleStandingsSelection(null, 1);
  assert.equal(selected, 1);
  selected = toggleStandingsSelection(selected, 2);
  assert.equal(selected, 2);
  selected = toggleStandingsSelection(selected, 2);
  assert.equal(selected, null);
});

test("stale team selection is cleared", () => {
  assert.equal(reconcileStandingsSelection(4, [1, 2, 3]), null);
});

test("player selection opens, closes, and replaces", () => {
  let selected = toggleStandingsSelection(null, "1:11");
  selected = toggleStandingsSelection(selected, "2:12");
  assert.equal(selected, "2:12");
  assert.equal(toggleStandingsSelection(selected, "2:12"), null);
});

test("tournament switch resets tab and expanded selections", () => {
  const current = {
    tournamentId: 10,
    activeTab: "players",
    expandedTeamId: 1,
    expandedPlayerKey: "1:11",
  };
  assert.deepEqual(reconcileKillRaceStandingsUiState(current, 11, [1], ["1:11"]), createKillRaceStandingsUiState(11));
});

test("tabs expose the four accessible states required by the UI", () => {
  assert.deepEqual(KILL_RACE_STANDINGS_TABS.map((tab) => tab.key), ["performance", "players", "matches", "bracket"]);
});

test("Kill Race resolves to the detailed standings surface", () => {
  assert.equal(resolveStandingsSurface(engine), "kill-race-detailed");
});

test("another bracket engine preserves BracketView routing", () => {
  assert.equal(resolveStandingsSurface({ scoringProfile: "custom", tournamentStructure: "single_elim" }), "bracket");
});

test("cumulative engines preserve StandingsTable routing", () => {
  assert.equal(resolveStandingsSurface({ scoringProfile: "wsow_like", tournamentStructure: "cumulative" }), "standings");
});

test("polling remains opt-in so Operator defaults to no data poll", () => {
  assert.equal(normalizeStandingsPollMs(undefined), null);
  assert.equal(normalizeStandingsPollMs({ pollMs: 1800 }), 1800);
});

test("sequential polling schedules the next request only after the previous resolves", async () => {
  let resolveFetch;
  let scheduledDelay = null;
  const fetchOnce = () => new Promise((resolve) => { resolveFetch = resolve; });
  const cycle = runSequentialPollCycle({
    fetchOnce,
    isActive: () => true,
    schedule: (delay) => { scheduledDelay = delay; },
    delayMs: 1800,
  });
  await Promise.resolve();
  assert.equal(scheduledDelay, null);
  resolveFetch();
  await cycle;
  assert.equal(scheduledDelay, 1800);
});
