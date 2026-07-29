import assert from "node:assert/strict";
import test from "node:test";

import {
  calculatePlayerTotal,
  getKillRaceBroadcastStatus,
  killRaceVisualKey,
  selectKillRaceScorebugMatch,
  resolveKillRaceScorebugMatch,
} from "../lib/killRaceBroadcast.mjs";
import { buildKillRaceCasterState } from "../lib/killRaceCasterState.mjs";
import {
  clearKillRaceDraft,
  getManualKillsFromMap,
} from "../lib/killRaceDraftState.mjs";
import {
  buildManualKillRacePreview,
  getProjectedSeriesScore,
} from "../lib/killRaceIntake.mjs";
import {
  getActiveBracketSeedCount,
  getBracketFitScale,
  isBracketMatchSelectable,
} from "../lib/bracketInteraction.mjs";
import {
  getCompatibleOverlayLayouts,
  resolveStreamSurface,
} from "../lib/streamRouting.mjs";

const match = (id, status, killsA = 0) => ({
  id,
  winner_id: null,
  team_a_id: 1,
  team_b_id: 2,
  status: "ready",
  maps: status ? [{ map_number: 1, result_status: status, kills_a: killsA, kills_b: 9 }] : [],
});

test("explicit scorebug match has priority over operator broadcast match", () => {
  assert.equal(resolveKillRaceScorebugMatch([match(1, null), match(2, null)], 2, 1).id, 2);
});

test("invalid explicit match returns an honest empty state", () => {
  assert.equal(resolveKillRaceScorebugMatch([match(1, null)], 999, 1), null);
});

test("follow operator exclusively uses broadcastMatchId", () => {
  assert.equal(resolveKillRaceScorebugMatch([match(1, null), match(2, "provisional")], null, 1).id, 1);
  assert.equal(resolveKillRaceScorebugMatch([match(1, null), match(2, "provisional")], null, null), null);
});

test("caster analytics use confirmed maps only, deduplicate maps and preserve MVP ties", () => {
  const confirmed = {
    ...match(7, "confirmed"),
    maps: [{
      id: 77, map_number: 1, result_status: "confirmed", kills_a: 14, kills_b: 0,
      player_stats: [
        { player_id: 1, player_name: "Vito", side: "left", kills: 7 },
        { player_id: 2, player_name: "Jasfa", side: "left", kills: 7 },
      ],
    }],
  };
  const provisional = {
    ...match(8, "provisional"),
    maps: [{
      id: 88, map_number: 1, result_status: "provisional",
      player_stats: [{ player_id: 3, player_name: "Xavi", side: "right", kills: 99 }],
    }],
  };
  const state = buildKillRaceCasterState({
    matches: [confirmed, { ...confirmed }, provisional],
    teams: [],
    broadcastMatchId: 8,
  });
  assert.equal(state.confirmedMapCount, 1);
  assert.equal(state.teamTotals.find((team) => team.teamId === 1).kills, 14);
  assert.deepEqual(state.mvp.map((player) => player.playerName), ["Jasfa", "Vito"]);
  assert.equal(state.broadcastMatch.id, 8);
});

test("team totals survive confirmed maps without individual stats", () => {
  const state = buildKillRaceCasterState({
    matches: [{
      ...match(9, "confirmed"),
      maps: [{ id: 90, result_status: "confirmed", kills_a: 12, kills_b: 9, player_stats: [] }],
    }],
    teams: [{ id: 1, name: "Left" }, { id: 2, name: "Right" }],
  });
  assert.deepEqual(state.teamTotals.map((team) => team.kills), [12, 9]);
  assert.deepEqual(state.mvp, []);
});

test("provisional maps do not change official caster analytics", () => {
  const state = buildKillRaceCasterState({
    matches: [{
      ...match(9, "provisional"),
      maps: [{
        id: 91, result_status: "provisional", kills_a: 99, kills_b: 88,
        player_stats: [{ player_id: 1, player_name: "Vito", side: "left", kills: 99 }],
      }],
    }],
  });
  assert.equal(state.confirmedMapCount, 0);
  assert.deepEqual(state.teamTotals, []);
  assert.deepEqual(state.mvp, []);
});

test("final tournament retains confirmed team and MVP analytics", () => {
  const state = buildKillRaceCasterState({
    matches: [{
      ...match(10, "confirmed"), next_match_id: null, winner_id: 1, status: "completed",
      maps: [{
        id: 100, result_status: "confirmed", kills_a: 8, kills_b: 6,
        player_stats: [{ player_id: 1, player_name: "Vito", side: "left", kills: 8 }],
      }],
    }],
    teams: [{ id: 1, name: "Champions" }, { id: 2, name: "Runners-up" }],
  });
  assert.equal(state.champion.name, "Champions");
  assert.equal(state.teamTotals[0].kills, 8);
  assert.equal(state.mvp[0].playerName, "Vito");
});

test("player view model exposes stable identity, confirmed breakdown, average and MVP tie", () => {
  const state = buildKillRaceCasterState({
    matches: [{
      ...match(12, "confirmed"),
      maps: [
        {
          id: 120, map_number: 1, result_status: "confirmed", kills_a: 5, kills_b: 5,
          player_stats: [
            { player_id: 7, player_name: "EndGameX", side: "left", kills: 5 },
            { player_id: 7, player_name: "EndGameX", side: "right", kills: 5 },
          ],
        },
        {
          id: 121, map_number: 2, result_status: "provisional", kills_a: 99, kills_b: 99,
          player_stats: [{ player_id: 7, player_name: "EndGameX", side: "left", kills: 99 }],
        },
      ],
    }],
    teams: [{ id: 1, name: "Left" }, { id: 2, name: "Right" }],
  });
  assert.equal(state.playerRanking.length, 2);
  assert.notEqual(state.playerRanking[0].playerKey, state.playerRanking[1].playerKey);
  for (const player of state.playerRanking) {
    assert.equal(player.confirmedKills, 5);
    assert.equal(player.confirmedMapCount, 1);
    assert.equal(player.averageKills, 5);
    assert.equal(player.rank, 1);
    assert.equal(player.isMvp, true);
    assert.equal(player.isTiedMvp, true);
    assert.deepEqual(player.mapBreakdown, [{ matchId: 12, mapNumber: 1, kills: 5 }]);
  }
});

test("provisional draft reloads, confirmed draft clears and matches do not inherit values", () => {
  const provisional = {
    result_status: "provisional",
    player_stats: [{ player_id: 7, kills: 5 }, { player_id: 8, kills: 4 }],
  };
  assert.deepEqual(getManualKillsFromMap(provisional), { 7: "5", 8: "4" });
  assert.deepEqual(getManualKillsFromMap({ ...provisional, result_status: "confirmed" }), {});
  assert.deepEqual(getManualKillsFromMap(undefined), {});
  assert.deepEqual(clearKillRaceDraft(), { manualKills: {}, content: "", preview: null });
});

test("preview calculates player total and exposes provisional state", () => {
  assert.equal(calculatePlayerTotal([{ kills: 7 }, { kills: 5 }]), 12);
  assert.equal(getKillRaceBroadcastStatus("provisional"), "PROVISIONAL");
});

test("scorebug chooses the match with a live/provisional game", () => {
  assert.equal(selectKillRaceScorebugMatch([match(1, "confirmed"), match(2, "provisional")]).id, 2);
});

test("visual key changes when kills change", () => {
  assert.notEqual(killRaceVisualKey(10, match(1, "provisional", 12)), killRaceVisualKey(10, match(1, "provisional", 13)));
  const first = match(1, "provisional", 12);
  const second = match(1, "provisional", 12);
  first.maps[0].player_stats = [{ player_id: 1, kills: 7 }, { player_id: 2, kills: 5 }];
  second.maps[0].player_stats = [{ player_id: 1, kills: 8 }, { player_id: 2, kills: 4 }];
  assert.notEqual(killRaceVisualKey(10, first), killRaceVisualKey(10, second));
});

test("match switch and tournament switch change the visual identity", () => {
  assert.notEqual(killRaceVisualKey(10, match(1, "live")), killRaceVisualKey(10, match(2, "live")));
  assert.notEqual(killRaceVisualKey(10, match(1, "live")), killRaceVisualKey(11, match(1, "live")));
});

test("scorebug statuses render LIVE, PROVISIONAL and FINAL", () => {
  assert.equal(getKillRaceBroadcastStatus("live"), "LIVE");
  assert.equal(getKillRaceBroadcastStatus("provisional"), "PROVISIONAL");
  assert.equal(getKillRaceBroadcastStatus("confirmed"), "FINAL");
});

const member = (id, nickname) => ({ id, team_id: 1, player_id: id, player: { id, nickname } });
const leftTeam = { id: 1, name: "Vito / Jasfa", members: [member(1, "Vito"), member(2, "Jasfa")] };
const rightTeam = { id: 2, name: "Barbas / Xavi", members: [member(3, "Barbas"), member(4, "Xavi")] };
const manualMatch = { ...match(10, null), maps_won_a: 0, maps_won_b: 0 };

test("manual 2v2 valid input calculates both totals", () => {
  const preview = buildManualKillRacePreview({
    match: manualMatch, leftTeam, rightTeam, mapNumber: 1,
    values: { 1: "12", 2: "8", 3: "10", 4: "7" },
  });
  assert.equal(preview.valid, true);
  assert.equal(preview.left.total_kills, 20);
  assert.equal(preview.right.total_kills, 17);
});

test("manual blocks empty, negative and non-2v2 rosters", () => {
  const empty = buildManualKillRacePreview({
    match: manualMatch, leftTeam, rightTeam, mapNumber: 1,
    values: { 1: "", 2: "8", 3: "10", 4: "7" },
  });
  const negative = buildManualKillRacePreview({
    match: manualMatch, leftTeam, rightTeam, mapNumber: 1,
    values: { 1: "-1", 2: "8", 3: "10", 4: "7" },
  });
  const invalidRoster = buildManualKillRacePreview({
    match: manualMatch, leftTeam: { ...leftTeam, members: leftTeam.members.slice(0, 1) },
    rightTeam, mapNumber: 1, values: { 1: "1", 3: "2", 4: "3" },
  });
  assert.equal(empty.valid, false);
  assert.equal(negative.valid, false);
  assert.equal(invalidRoster.valid, false);
});

test("tie declares no leader and does not project a series winner", () => {
  const preview = buildManualKillRacePreview({
    match: manualMatch, leftTeam, rightTeam, mapNumber: 1,
    values: { 1: "5", 2: "5", 3: "6", 4: "4" },
  });
  assert.deepEqual(getProjectedSeriesScore(manualMatch, preview), { left: 0, right: 0, leader: null });
});

test("bracket operator selects only playable matches", () => {
  const playable = { ...manualMatch, status: "ready", team_a_id: 1, team_b_id: 2, winner_id: null };
  assert.equal(isBracketMatchSelectable(playable, "operator", true), true);
  assert.equal(isBracketMatchSelectable({ ...playable, team_b_id: null }, "operator", true), false);
  assert.equal(isBracketMatchSelectable({ ...playable, status: "completed" }, "operator", true), false);
  assert.equal(isBracketMatchSelectable({ ...playable, status: "waiting_opponent" }, "operator", true), false);
  assert.equal(isBracketMatchSelectable(playable, "stream", true), false);
});

test("active match marks exactly one seed and Fit preserves readable scale", () => {
  const rounds = [
    { title: "Cuartos", seeds: [{ matchId: 1 }, { matchId: 2 }, { matchId: 3 }, { matchId: 4 }] },
    { title: "Semifinal", seeds: [{ matchId: 5 }, { matchId: 6 }] },
    { title: "Final", seeds: [{ matchId: 7 }] },
  ];
  assert.equal(getActiveBracketSeedCount(rounds, 5), 1);
  assert.equal(getBracketFitScale(1400, 1000), 0.72);
  assert.equal(rounds.length, 3);
  assert.deepEqual(rounds.map((round) => round.seeds.length), [4, 2, 1]);
});

test("scorebug routing never falls through to bracket and bracket remains explicit", () => {
  assert.equal(resolveStreamSurface("scorebug", { isKillRace: true, isBracket: true }), "scorebug");
  assert.equal(resolveStreamSurface("scorebug", { isKillRace: false, isBracket: false }), "unsupported-scorebug");
  assert.equal(resolveStreamSurface("bracket", { isKillRace: true, isBracket: true }), "bracket");
  assert.equal(resolveStreamSurface("full", { isKillRace: true, isBracket: true }), "bracket");
});

test("Kill Race and standings engines expose only compatible overlays", () => {
  assert.deepEqual(getCompatibleOverlayLayouts({ isKillRace: true, supportsMatchPoint: false }), ["scorebug", "bracket"]);
  assert.deepEqual(getCompatibleOverlayLayouts({ isKillRace: false, supportsMatchPoint: true }),
    ["sidebar", "lower-third", "matchpoint", "mvp", "leaderboard"]);
  assert.deepEqual(getCompatibleOverlayLayouts({ isKillRace: false, supportsMatchPoint: false }),
    ["sidebar", "lower-third", "mvp", "leaderboard"]);
});
