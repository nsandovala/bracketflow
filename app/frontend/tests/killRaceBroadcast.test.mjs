import assert from "node:assert/strict";
import test from "node:test";

import {
  calculatePlayerTotal,
  getKillRaceBroadcastStatus,
  killRaceVisualKey,
  selectKillRaceScorebugMatch,
} from "../lib/killRaceBroadcast.mjs";

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
