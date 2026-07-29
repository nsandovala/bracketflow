import assert from "node:assert/strict";
import test from "node:test";

import {
  calculatePlayerTotal,
  getKillRaceBroadcastStatus,
  killRaceVisualKey,
  selectKillRaceScorebugMatch,
} from "../lib/killRaceBroadcast.mjs";
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
  maps: status ? [{ map_number: 1, result_status: status, kills_a: killsA, kills_b: 9 }] : [],
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
