import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  calculatePlayerTotal,
  calculatePlayerTotalOrNull,
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
  resolveBracketPresentation,
  resolveStreamSurface,
} from "../lib/streamRouting.mjs";
import {
  clearStreamSnapshot,
  getFollowOperatorOverlayUrl,
  getOperatorTransmissionState,
  getTournamentOverlayUrl,
  hasResolvedMatch,
  reduceStreamFetchFailure,
  resolveBroadcastContext,
} from "../lib/broadcastChannel.mjs";
import {
  buildKillRaceBracketBroadcast,
  getKillRaceBracketLayout,
} from "../lib/killRaceBracketBroadcast.mjs";
import { createTournamentSwitchState } from "../lib/worldSeriesPracticeState.mjs";

const match = (id, status, killsA = 0) => ({
  id,
  winner_id: null,
  team_a_id: 1,
  team_b_id: 2,
  status: "ready",
  maps: status ? [{ map_number: 1, result_status: status, kills_a: killsA, kills_b: 9 }] : [],
});

test("tournament switch clears every tournament-derived array before refresh resolves", async () => {
  const previous = {
    selectedTournamentId: 10,
    selectedTournament: { id: 10 },
    teams: [{ id: 1 }],
    matches: [{ id: 2 }],
    leaderboard: [{ team_id: 1 }],
    tournamentResults: [{ id: 3 }],
    players: [{ id: 4 }],
  };
  let visible = previous;
  let resolveRefresh;
  const refresh = new Promise((resolve) => {
    resolveRefresh = resolve;
  }).then((next) => {
    visible = next;
  });

  visible = createTournamentSwitchState(20);

  assert.equal(visible.selectedTournamentId, 20);
  assert.equal(visible.selectedTournament, null);
  assert.equal(visible.loading, true);
  for (const key of ["teams", "matches", "leaderboard", "tournamentResults", "players"]) {
    assert.deepEqual(visible[key], []);
  }
  resolveRefresh({ selectedTournamentId: 20, teams: [{ id: 20 }] });
  await refresh;
  assert.deepEqual(visible.teams, [{ id: 20 }]);
});

test("Operator invalidates an old tournament request before applying the synchronous reset", () => {
  const source = readFileSync(
    new URL("../app/lib/useWorldSeriesPractice.ts", import.meta.url),
    "utf8"
  );
  const selection = source.slice(
    source.indexOf("function selectTournament"),
    source.indexOf("function updateResultDraft")
  );

  assert.ok(selection.indexOf("refreshRequestRef.current += 1") >= 0);
  assert.ok(
    selection.indexOf("refreshRequestRef.current += 1") <
      selection.indexOf("setSelectedTournamentId")
  );
  for (const setter of [
    "setSelectedTournament",
    "setTeams",
    "setMatches",
    "setLeaderboard",
    "setTournamentResults",
    "setPlayers",
  ]) {
    assert.match(selection, new RegExp(`${setter}\\(reset\\.`));
  }
});

test("explicit scorebug match has priority over operator broadcast match", () => {
  assert.equal(resolveKillRaceScorebugMatch([match(1, null), match(2, null)], 2, 1).id, 2);
});

test("explicit match has priority over channel routing", () => {
  assert.deepEqual(resolveBroadcastContext({
    explicitTournamentId: 23,
    explicitMatchId: 97,
    channel: { activeTournamentId: 99, broadcastMatchId: 100 },
  }), { tournamentId: 23, matchId: 97, source: "explicit" });
});

test("stable channel follows tournament and broadcast match switches without fallback", () => {
  const first = resolveBroadcastContext({ explicitTournamentId: null, explicitMatchId: null, channel: { activeTournamentId: 23, broadcastMatchId: 97 } });
  const switched = resolveBroadcastContext({ explicitTournamentId: null, explicitMatchId: null, channel: { activeTournamentId: 24, broadcastMatchId: 101 } });
  const explicit = resolveBroadcastContext({ explicitTournamentId: 23, explicitMatchId: null, channel: { activeTournamentId: 24, broadcastMatchId: null } });
  assert.deepEqual(first, { tournamentId: 23, matchId: 97, source: "channel" });
  assert.deepEqual(switched, { tournamentId: 24, matchId: 101, source: "channel" });
  assert.deepEqual(explicit, { tournamentId: 23, matchId: null, source: "explicit" });
});

test("channel exposes honest empty tournament and match states", () => {
  assert.deepEqual(resolveBroadcastContext({ explicitTournamentId: null, explicitMatchId: null, channel: { activeTournamentId: null, broadcastMatchId: null } }), { tournamentId: null, matchId: null, source: "channel" });
  assert.deepEqual(resolveBroadcastContext({ explicitTournamentId: null, explicitMatchId: null, channel: { activeTournamentId: 23, broadcastMatchId: null } }), { tournamentId: 23, matchId: null, source: "channel" });
});

test("operator warns when selected match differs from on-air match", () => {
  assert.equal(getOperatorTransmissionState(98, { broadcastMatchId: 97 }).hasMismatch, true);
  assert.equal(getOperatorTransmissionState(97, { broadcastMatchId: 97 }).isOnAir, true);
  assert.equal(getOperatorTransmissionState(97, { broadcastMatchId: null }).hasBroadcast, false);
});

test("caster follow-operator URLs use channel main without tournamentId", () => {
  const url = getFollowOperatorOverlayUrl("http://localhost:3000", "scorebug");
  assert.match(url, /channel=main/);
  assert.doesNotMatch(url, /tournamentId/);
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

test("visual key changes with match state and official series score", () => {
  const ready = { ...match(1, null), status: "ready", maps_won_a: 0, maps_won_b: 0 };
  const live = { ...ready, status: "in_progress" };
  const scored = { ...live, maps_won_a: 1 };
  assert.notEqual(killRaceVisualKey(10, ready), killRaceVisualKey(10, live));
  assert.notEqual(killRaceVisualKey(10, live), killRaceVisualKey(10, scored));
});

test("match switch and tournament switch change the visual identity", () => {
  assert.notEqual(killRaceVisualKey(10, match(1, "live")), killRaceVisualKey(10, match(2, "live")));
  assert.notEqual(killRaceVisualKey(10, match(1, "live")), killRaceVisualKey(11, match(1, "live")));
});

test("scorebug statuses render LIVE, PROVISIONAL and FINAL", () => {
  assert.equal(getKillRaceBroadcastStatus("live"), "LIVE");
  assert.equal(getKillRaceBroadcastStatus("in_progress"), "LIVE");
  assert.equal(getKillRaceBroadcastStatus("provisional"), "PROVISIONAL");
  assert.equal(getKillRaceBroadcastStatus("confirmed"), "FINAL");
  assert.equal(getKillRaceBroadcastStatus("pending"), "POR COMENZAR");
  assert.equal(getKillRaceBroadcastStatus("unknown"), "POR COMENZAR");
  assert.equal(getKillRaceBroadcastStatus("live", false), "RECONECTANDO");
});

test("missing player stats never invent individual kills", () => {
  assert.equal(calculatePlayerTotalOrNull([]), null);
  assert.equal(calculatePlayerTotalOrNull([{ kills: 0 }, { kills: 0 }]), 0);
});

test("P6 Caster exposes five stable LIVE, preview and fixed URL contracts", () => {
  const layouts = ["scorebug", "intermission", "bracket", "mvp", "champion"];
  const live = layouts.map((layout) => getFollowOperatorOverlayUrl(
    "http://localhost:3000",
    layout,
    "main",
    layout !== "intermission"
  ));
  assert.deepEqual(live, [
    "http://localhost:3000/stream?channel=main&layout=scorebug&obs=1&bg=transparent",
    "http://localhost:3000/stream?channel=main&layout=intermission&obs=1",
    "http://localhost:3000/stream?channel=main&layout=bracket&obs=1&bg=transparent",
    "http://localhost:3000/stream?channel=main&layout=mvp&obs=1&bg=transparent",
    "http://localhost:3000/stream?channel=main&layout=champion&obs=1&bg=transparent",
  ]);
  for (const layout of layouts) {
    const preview = getTournamentOverlayUrl("http://localhost:3000", 24, layout);
    assert.match(preview, /tournamentId=24/);
    assert.doesNotMatch(preview, /channel=/);
  }
  const fixed = getTournamentOverlayUrl("http://localhost:3000", 24, "scorebug", 101);
  assert.match(fixed, /tournamentId=24/);
  assert.match(fixed, /matchId=101/);
  assert.doesNotMatch(fixed, /channel=/);
});

test("P6 Caster groups all five Kill Race layouts and scorebug CSS has one base", () => {
  const casterSource = readFileSync(new URL("../app/components/CasterHub.tsx", import.meta.url), "utf8");
  const scorebugSource = readFileSync(new URL("../app/components/KillRaceScorebug.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.equal((casterSource.match(/\{KILL_RACE_OVERLAYS\.map\(\(overlay\) =>/g) ?? []).length, 2);
  assert.match(casterSource, /CANAL MAIN · EN VIVO/);
  assert.match(casterSource, /PREVIEW · TORNEO SELECCIONADO/);
  assert.equal((css.match(/^\.kr-scorebug \{/gm) ?? []).length, 1);
  assert.match(css, /\.kr-scorebug-player-list span \{[^}]*text-overflow: ellipsis/);
  assert.match(scorebugSource, /\.slice\(0, 2\)/);
  assert.doesNotMatch(scorebugSource, /ELIMINACIONES/i);
});

test("P6 visual close: Caster launchers use a compact responsive grid without changing URLs", () => {
  const casterSource = readFileSync(new URL("../app/components/CasterHub.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.equal((casterSource.match(/className="bf-caster-overlay-source-grid"/g) ?? []).length, 2);
  assert.equal((casterSource.match(/overlay\.layout === "champion" \? " is-champion-source"/g) ?? []).length, 2);
  assert.match(css, /\.bf-caster-overlay-source-grid \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/s);
  assert.match(css, /\.is-champion-source \{[^}]*grid-column: 1 \/ -1/s);
  assert.match(css, /@container \(max-width: 680px\)[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /\.bf-caster-overlays \.bf-caster-overlay code \{[^}]*max-width: 100%/s);
  assert.match(css, /\.bf-caster-overlay code \{[^}]*text-overflow: ellipsis[^}]*white-space: nowrap/s);
  assert.match(css, /\.bf-caster-overlay-source-grid \.bf-caster-overlay \{[^}]*min-width: 0[^}]*height: 100%/s);
  assert.match(css, /\.bf-caster-overlays \.bf-caster-overlay-actions \{[^}]*align-self: end[^}]*margin-top: auto/s);
});

const staleStreamSnapshot = {
  tournament: { id: 23, name: "Torneo eliminado" },
  matchCompletionPolicy: { state: "active" },
  teams: [{ id: 1, name: "Stale team" }],
  matches: [match(97, "provisional", 12)],
  standings: [{ team_id: 1, kills: 12 }],
  results: [{ id: 1, kills: 12 }],
  afterGameNumber: 1,
  connected: true,
  hasLoadedOnce: true,
  channel: { activeTournamentId: 23, broadcastMatchId: 97 },
  resolvedMatchId: 97,
  emptyReason: null,
};

test("404 clears the stale stream snapshot and exposes an invalid reference", () => {
  const next = reduceStreamFetchFailure(staleStreamSnapshot, { status: 404 });
  assert.equal(next.tournament, null);
  assert.deepEqual(next.teams, []);
  assert.deepEqual(next.matches, []);
  assert.deepEqual(next.results, []);
  assert.equal(next.emptyReason, "TORNEO NO DISPONIBLE");
  assert.equal(next.connected, true);
});

test("transient failure preserves the last snapshot and marks reconnecting", () => {
  const next = reduceStreamFetchFailure(staleStreamSnapshot, new TypeError("Failed to fetch"));
  assert.equal(next.tournament, staleStreamSnapshot.tournament);
  assert.equal(next.matches, staleStreamSnapshot.matches);
  assert.equal(next.connected, false);
  assert.equal(next.emptyReason, null);

  const empty = reduceStreamFetchFailure(
    clearStreamSnapshot(staleStreamSnapshot, { emptyReason: "SIN SERIE AL AIRE" }),
    new TypeError("Failed to fetch")
  );
  assert.equal(empty.emptyReason, "RECONECTANDO");
});

test("an explicit tournament never consumes the main channel match", () => {
  assert.deepEqual(resolveBroadcastContext({
    explicitTournamentId: 23,
    explicitMatchId: null,
    channel: { activeTournamentId: 24, broadcastMatchId: 101 },
  }), { tournamentId: 23, matchId: null, source: "explicit" });
});

test("a match outside the resolved tournament is rejected without fallback", () => {
  assert.equal(hasResolvedMatch([match(1, null)], 99), false);
  assert.equal(resolveKillRaceScorebugMatch([match(1, null)], 99, 1), null);
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
  assert.deepEqual(getCompatibleOverlayLayouts({ isKillRace: true, supportsMatchPoint: false }), ["scorebug", "intermission", "bracket", "mvp", "champion"]);
  assert.deepEqual(getCompatibleOverlayLayouts({ isKillRace: false, supportsMatchPoint: true }),
    ["sidebar", "lower-third", "matchpoint", "mvp", "leaderboard"]);
  assert.deepEqual(getCompatibleOverlayLayouts({ isKillRace: false, supportsMatchPoint: false }),
    ["sidebar", "lower-third", "mvp", "leaderboard"]);
});

const bracketTeam = (id) => ({
  id,
  name: `Team ${id}`,
  tournament_id: 91,
  source: "manual",
  members: [{ id, team_id: id, player_id: id, player: { id, nickname: `Player ${id}` } }],
});

function bracketMatch(id, round, teamAId, teamBId, nextMatchId = null, nextSlot = null) {
  return {
    id,
    round,
    status: teamAId && teamBId ? "ready" : "waiting_opponent",
    team_a_id: teamAId,
    team_b_id: teamBId,
    winner_id: null,
    best_of: 3,
    next_match_id: nextMatchId,
    next_slot: nextSlot,
    tournament_id: 91,
    maps: [],
    maps_won_a: 0,
    maps_won_b: 0,
  };
}

function sourceRoundsFor(matches, teams) {
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const totalRounds = Math.max(...matches.map((entry) => entry.round));
  const titleFor = (round) => round === totalRounds ? "Final" : round === totalRounds - 1 ? "Semifinal" : "Cuartos";
  return Array.from({ length: totalRounds }, (_, index) => {
    const round = index + 1;
    return {
      title: titleFor(round),
      seeds: matches.filter((entry) => entry.round === round).map((entry) => {
        const makeTeam = (teamId, side) => {
          const team = teamsById.get(teamId);
          if (team) {
            return {
              id: String(team.id), name: team.name, roster: team.members[0].player.nickname,
              score: side === "a" ? entry.maps_won_a : entry.maps_won_b,
              stateLabel: entry.winner_id === team.id ? "Ganador" : entry.winner_id ? "Eliminado" : "Listo",
              isBye: false, isEmpty: false, isFuture: false,
              isWinner: entry.winner_id === team.id,
              isLoser: entry.winner_id !== null && entry.winner_id !== team.id,
            };
          }
          const feeder = matches.find((candidate) => candidate.next_match_id === entry.id && candidate.next_slot === side);
          const isBye = entry.round === 1 && Boolean(side === "a" ? entry.team_b_id : entry.team_a_id);
          return {
            id: `${isBye ? "bye" : "future"}-${entry.id}-${side}`,
            name: isBye ? "Pasa directo" : "Esperando ganador",
            roster: isBye ? "Libre por seed" : feeder ? `Ganador M${feeder.id}` : "Pendiente",
            score: null, stateLabel: isBye ? "No jugable" : "Pendiente",
            isBye, isEmpty: !isBye && !feeder, isFuture: Boolean(feeder),
            isWinner: false, isLoser: false,
          };
        };
        return {
          id: entry.id,
          matchId: entry.id,
          matchLabel: `Match ${entry.id}`,
          bestOf: entry.best_of,
          status: entry.status,
          statusLabel: "Pendiente",
          statusTone: "ready",
          teams: [makeTeam(entry.team_a_id, "a"), makeTeam(entry.team_b_id, "b")],
        };
      }),
    };
  });
}

function bracketFixture(teamCount) {
  const teams = Array.from({ length: teamCount }, (_, index) => bracketTeam(index + 1));
  const matches = teamCount === 12
    ? [
        bracketMatch(1, 1, 1, 12, 7, "a"),
        bracketMatch(2, 1, 2, 11, 7, "b"),
        bracketMatch(3, 1, 3, 10, 8, "a"),
        bracketMatch(4, 1, 4, 9, 8, "b"),
        bracketMatch(5, 1, 5, 8, 9, "a"),
        bracketMatch(6, 1, 6, 7, 9, "b"),
        bracketMatch(7, 2, null, null, 10, "a"),
        bracketMatch(8, 2, null, null, 10, "b"),
        bracketMatch(9, 2, null, null, 11, "a"),
        bracketMatch(10, 3, null, null, 11, "b"),
        bracketMatch(11, 4, null, null),
      ]
    : teamCount <= 4
    ? [
        bracketMatch(1, 1, 1, 4, 3, "a"),
        bracketMatch(2, 1, 2, 3, 3, "b"),
        bracketMatch(3, 2, null, null),
      ]
    : [
        bracketMatch(1, 1, 1, 8 <= teamCount ? 8 : null, 5, "a"),
        bracketMatch(2, 1, 4, 5, 5, "b"),
        bracketMatch(3, 1, 2, 7 <= teamCount ? 7 : null, 6, "a"),
        bracketMatch(4, 1, 3, 6, 6, "b"),
        bracketMatch(5, 2, null, null, 7, "a"),
        bracketMatch(6, 2, null, null, 7, "b"),
        bracketMatch(7, 3, null, null),
      ];
  const tournament = { id: 91, name: `${teamCount} Teams Cup`, status: "active" };
  return { tournament, teams, matches, sourceRounds: sourceRoundsFor(matches, teams) };
}

function buildBracketModel(teamCount, overrides = {}) {
  return buildKillRaceBracketBroadcast({ ...bracketFixture(teamCount), ...overrides });
}

test("P4: 4 teams produce rounds 2/1", () => {
  assert.deepEqual(buildBracketModel(4).rounds.map((round) => round.seeds.length), [2, 1]);
});

test("P4: 6 teams preserve the 4/2/1 structure and BYEs", () => {
  const model = buildBracketModel(6);
  assert.deepEqual(model.rounds.map((round) => round.seeds.length), [4, 2, 1]);
  assert.equal(model.rounds[0].seeds.filter((series) => series.isBye).length, 2);
});

test("P4: 8 teams produce rounds 4/2/1", () => {
  assert.deepEqual(buildBracketModel(8).rounds.map((round) => round.seeds.length), [4, 2, 1]);
});

test("P6 visual close: 12 teams preserve the real 6/3/1/1 data contract", () => {
  const fixture = bracketFixture(12);
  const model = buildKillRaceBracketBroadcast(fixture);
  const clone = buildKillRaceBracketBroadcast(structuredClone(fixture));

  assert.deepEqual(model.rounds.map((round) => round.seeds.length), [6, 3, 1, 1]);
  assert.equal(model.totalSeries, 11);
  assert.equal(model.rounds[0].seeds[0].leftTeam.name, "Team 1");
  assert.equal(model.rounds[0].seeds[0].rightTeam.name, "Team 12");
  assert.equal(clone.visualKey, model.visualKey);
  assert.deepEqual(clone.rounds, model.rounds);
});

test("P4: broadcastMatchId marks exactly one series", () => {
  const model = buildBracketModel(8, { broadcastMatchId: 2 });
  assert.equal(model.rounds.flatMap((round) => round.seeds).filter((series) => series.isBroadcast).length, 1);
  assert.equal(model.broadcastMatchId, 2);
});

test("P4: a non-broadcast in-progress match stays live without becoming on-air", () => {
  const fixture = bracketFixture(8);
  fixture.matches[0].status = "in_progress";
  fixture.sourceRounds = sourceRoundsFor(fixture.matches, fixture.teams);
  const model = buildKillRaceBracketBroadcast({ ...fixture, broadcastMatchId: 2 });
  const live = model.rounds.flatMap((round) => round.seeds).find((series) => series.matchId === 1);
  assert.equal(live.isLive, true);
  assert.equal(live.isBroadcast, false);
  assert.equal(live.statusLabel, "EN JUEGO");
});

test("P4: the broadcast match can be ready, live or completed", () => {
  for (const status of ["ready", "in_progress", "completed"]) {
    const fixture = bracketFixture(4);
    fixture.matches[0].status = status;
    if (status === "completed") fixture.matches[0].winner_id = 1;
    fixture.sourceRounds = sourceRoundsFor(fixture.matches, fixture.teams);
    const model = buildKillRaceBracketBroadcast({ ...fixture, broadcastMatchId: 1 });
    const selected = model.rounds[0].seeds[0];
    assert.equal(selected.isBroadcast, true);
    assert.equal(selected.statusLabel, "EN TRANSMISIÓN");
  }
});

test("P4: an invalid broadcast id never selects a fallback", () => {
  const model = buildBracketModel(8, { broadcastMatchId: 999 });
  assert.equal(model.broadcastMatchId, null);
  assert.equal(model.broadcastSeries, null);
  assert.equal(model.rounds.flatMap((round) => round.seeds).some((series) => series.isBroadcast), false);
});

test("P4: provisional data neither advances a team nor declares a winner", () => {
  const fixture = bracketFixture(4);
  fixture.matches[0].status = "in_progress";
  fixture.matches[0].maps = [{ id: 1, map_number: 1, result_status: "provisional", kills_a: 99, kills_b: 1, map_winner_id: 1, player_stats: [] }];
  fixture.sourceRounds = sourceRoundsFor(fixture.matches, fixture.teams);
  const model = buildKillRaceBracketBroadcast(fixture);
  assert.equal(model.rounds[0].seeds[0].winnerId, null);
  assert.equal(model.rounds[1].seeds[0].leftTeam.isFuture, true);
  assert.equal(model.champion, null);
});

test("P4: completed series uses winner_id", () => {
  const fixture = bracketFixture(4);
  Object.assign(fixture.matches[0], { status: "completed", winner_id: 4, maps_won_a: 0, maps_won_b: 2 });
  fixture.sourceRounds = sourceRoundsFor(fixture.matches, fixture.teams);
  const series = buildKillRaceBracketBroadcast(fixture).rounds[0].seeds[0];
  assert.equal(series.winnerId, 4);
  assert.equal(series.rightTeam.isWinner, true);
  assert.equal(series.mapsWonB, 2);
});

test("P4: a completed final resolves the champion", () => {
  const fixture = bracketFixture(4);
  Object.assign(fixture.matches[2], { status: "completed", team_a_id: 1, team_b_id: 2, winner_id: 1, maps_won_a: 2, maps_won_b: 1 });
  fixture.sourceRounds = sourceRoundsFor(fixture.matches, fixture.teams);
  assert.deepEqual(buildKillRaceBracketBroadcast(fixture).champion, { teamId: 1, name: "Team 1", score: "2–1", matchId: 3 });
});

test("P4: an incomplete tournament never declares a champion", () => {
  assert.equal(buildBracketModel(4).champion, null);
});

test("P4: BYEs do not count as played series", () => {
  const model = buildBracketModel(6);
  assert.equal(model.totalSeries, 5);
  assert.equal(model.completedSeries, 0);
});

test("P4: four-team scale is larger than eight-team scale", () => {
  const four = getKillRaceBracketLayout({ roundCount: 2, maxMatchesInRound: 2, viewportWidth: 1920, viewportHeight: 1080 });
  const eight = getKillRaceBracketLayout({ roundCount: 3, maxMatchesInRound: 4, viewportWidth: 1920, viewportHeight: 1080 });
  assert.ok(four.scale > eight.scale);
});

test("P4: adaptive scale never drops below its readable minimum", () => {
  const layout = getKillRaceBracketLayout({ roundCount: 5, maxMatchesInRound: 16, viewportWidth: 640, viewportHeight: 480 });
  assert.equal(layout.scale, layout.minimumScale);
  assert.equal(layout.minimumScale, 0.72);
});

test("P4: 4, 6 and 8 teams do not request overflow at broadcast viewports", () => {
  for (const viewport of [[1920, 1080], [1366, 768]]) {
    const four = getKillRaceBracketLayout({ roundCount: 2, maxMatchesInRound: 2, viewportWidth: viewport[0], viewportHeight: viewport[1] });
    const six = getKillRaceBracketLayout({ roundCount: 3, maxMatchesInRound: 4, viewportWidth: viewport[0], viewportHeight: viewport[1] });
    const eight = getKillRaceBracketLayout({ roundCount: 3, maxMatchesInRound: 4, viewportWidth: viewport[0], viewportHeight: viewport[1] });
    assert.equal(four.requestsOverflow || six.requestsOverflow || eight.requestsOverflow, false);
  }
});

test("P6 visual close: dense height includes real cards and a perceptible minimum gap", () => {
  const layout = getKillRaceBracketLayout({
    roundCount: 4,
    maxMatchesInRound: 6,
    viewportWidth: 1366,
    viewportHeight: 768,
  });

  assert.equal(layout.density, "fallback");
  assert.ok(layout.matchGap >= 10);
  assert.equal(
    layout.requiredHeight,
    6 * layout.matchHeight + 5 * layout.matchGap + 76
  );
  assert.ok(layout.scale >= layout.minimumScale);
});

test("P6 visual close: 12-team bracket fits both OBS validation viewports", () => {
  for (const [viewportWidth, viewportHeight] of [[1920, 1080], [1366, 768]]) {
    const layout = getKillRaceBracketLayout({
      roundCount: 4,
      maxMatchesInRound: 6,
      viewportWidth,
      viewportHeight,
    });
    assert.equal(layout.requestsOverflow, false);
    assert.ok(layout.scaledWidth <= layout.availableWidth + 1);
    assert.ok(layout.scaledHeight <= layout.availableHeight + 1);
    assert.ok(layout.scale >= layout.minimumScale);
  }
});

test("P6 visual close: 4, 6 and 8-team density metrics remain unchanged", () => {
  const showcase1080 = getKillRaceBracketLayout({ roundCount: 2, maxMatchesInRound: 2, viewportWidth: 1920, viewportHeight: 1080 });
  const showcase768 = getKillRaceBracketLayout({ roundCount: 2, maxMatchesInRound: 2, viewportWidth: 1366, viewportHeight: 768 });
  const standard1080 = getKillRaceBracketLayout({ roundCount: 3, maxMatchesInRound: 4, viewportWidth: 1920, viewportHeight: 1080 });
  const standard768 = getKillRaceBracketLayout({ roundCount: 3, maxMatchesInRound: 4, viewportWidth: 1366, viewportHeight: 768 });

  assert.deepEqual(
    [showcase1080.baseHeight, showcase1080.scale, showcase768.baseHeight, showcase768.scale],
    [536, 1.2, 536, 1.108]
  );
  assert.deepEqual(
    [standard1080.baseHeight, standard1080.scale, standard768.baseHeight, standard768.scale],
    [632, 1, 632, 0.9]
  );
  assert.deepEqual(buildBracketModel(4).rounds.map((round) => round.seeds.length), [2, 1]);
  assert.deepEqual(buildBracketModel(6).rounds.map((round) => round.seeds.length), [4, 2, 1]);
  assert.deepEqual(buildBracketModel(8).rounds.map((round) => round.seeds.length), [4, 2, 1]);
});

test("P4: visualKey reacts to winner, score and broadcastMatchId", () => {
  const fixture = bracketFixture(4);
  const initial = buildKillRaceBracketBroadcast(fixture).visualKey;
  fixture.matches[0].winner_id = 1;
  fixture.sourceRounds = sourceRoundsFor(fixture.matches, fixture.teams);
  const winner = buildKillRaceBracketBroadcast(fixture).visualKey;
  fixture.matches[0].maps_won_a = 1;
  fixture.sourceRounds = sourceRoundsFor(fixture.matches, fixture.teams);
  const score = buildKillRaceBracketBroadcast(fixture).visualKey;
  const broadcast = buildKillRaceBracketBroadcast({ ...fixture, broadcastMatchId: 1 }).visualKey;
  assert.notEqual(initial, winner);
  assert.notEqual(winner, score);
  assert.notEqual(score, broadcast);
});

test("P4: visualKey is stable for an equivalent cloned payload", () => {
  const fixture = bracketFixture(8);
  const first = buildKillRaceBracketBroadcast(fixture).visualKey;
  const clone = structuredClone(fixture);
  assert.equal(buildKillRaceBracketBroadcast(clone).visualKey, first);
});

test("P4: explicit URL context retains priority and bracket routing stays stable", () => {
  assert.deepEqual(resolveBroadcastContext({
    explicitTournamentId: 91,
    explicitMatchId: 7,
    channel: { activeTournamentId: 92, broadcastMatchId: 8 },
  }), { tournamentId: 91, matchId: 7, source: "explicit" });
  assert.equal(resolveStreamSurface("bracket", { isKillRace: true, isBracket: true }), "bracket");
  assert.equal(resolveStreamSurface("bracket", { isKillRace: null, isBracket: false }), "bracket");
  assert.equal(resolveStreamSurface("bracket", { isKillRace: false, isBracket: false }), "standings");
  assert.equal(resolveBracketPresentation("kill_race"), "kill-race-broadcast");
  assert.equal(resolveBracketPresentation("custom"), "bracket-view");
});
