import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildKillRaceChampionOverlay,
  buildKillRaceMvpOverlay,
} from "../lib/killRaceAwards.mjs";
import { buildKillRaceCasterState } from "../lib/killRaceCasterState.mjs";
import {
  getFollowOperatorOverlayUrl,
  getTournamentOverlayUrl,
  resolveBroadcastContext,
} from "../lib/broadcastChannel.mjs";
import {
  getCompatibleOverlayLayouts,
  resolveStreamSurface,
} from "../lib/streamRouting.mjs";

const tournament = (overrides = {}) => ({
  id: 91,
  name: "Arena Test",
  status: "bracket_generated",
  bracket_status: "running",
  config: {},
  ...overrides,
});

const member = (teamId, playerId, nickname) => ({
  id: playerId,
  team_id: teamId,
  player_id: playerId,
  player: { id: playerId, nickname },
});

const team = (id, name = `Team ${id}`, nicknames = [`P${id}A`, `P${id}B`]) => ({
  id,
  name,
  tournament_id: 91,
  source: "manual",
  members: nicknames.map((nickname, index) => member(id, id * 10 + index, nickname)),
});

const teams = [team(1, "Team Alpha", ["Alpha", "Bravo"]), team(2, "Team Beta", ["Charlie", "Delta"]), team(3), team(4)];

const stat = (playerId, playerName, side, kills, extras = {}) => ({
  player_id: playerId,
  player_name: playerName,
  side,
  kills,
  ...extras,
});

const game = ({
  id = 100,
  number = 1,
  status = "confirmed",
  killsA = 10,
  killsB = 8,
  winnerId = 1,
  stats = [stat(10, "Alpha", "left", 6), stat(20, "Charlie", "right", 5)],
} = {}) => ({
  id,
  match_id: 10,
  map_number: number,
  kills_a: killsA,
  kills_b: killsB,
  map_winner_id: winnerId,
  result_status: status,
  player_stats: stats,
});

const series = ({
  id = 10,
  round = 1,
  status = "in_progress",
  teamA = 1,
  teamB = 2,
  winnerId = null,
  nextMatchId = 12,
  scoreA = 1,
  scoreB = 0,
  maps = [game()],
  tournamentId = 91,
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
  tournament_id: tournamentId,
  maps,
  maps_won_a: scoreA,
  maps_won_b: scoreB,
});

function completedBracket(overrides = {}) {
  const semifinalA = series({ id: 10, round: 1, status: "completed", winnerId: 1, nextMatchId: 12, scoreA: 2, maps: [game({ id: 101 })] });
  const semifinalB = series({ id: 11, round: 1, status: "completed", teamA: 3, teamB: 4, winnerId: 3, nextMatchId: 12, scoreA: 2, maps: [game({ id: 102, winnerId: 3, stats: [stat(30, "P3A", "left", 4), stat(40, "P4A", "right", 3)] })] });
  const final = series({ id: 12, round: 2, status: "completed", teamA: 1, teamB: 3, winnerId: 1, nextMatchId: null, scoreA: 2, scoreB: 0, maps: [game({ id: 103, stats: [stat(10, "Alpha", "left", 7), stat(30, "P3A", "right", 5)] })] });
  return { tournament: tournament({ status: "completed", bracket_status: "completed" }), teams, matches: [semifinalA, semifinalB, final], ...overrides };
}

test("1. solo mapas confirmed alimentan MVP", () => {
  const match = series({ maps: [game({ id: 1, stats: [stat(10, "Alpha", "left", 5)] }), game({ id: 2, number: 2, status: "live", stats: [stat(20, "Charlie", "right", 99)] })] });
  const model = buildKillRaceMvpOverlay({ tournament: tournament(), teams, matches: [match], broadcastMatchId: 10 });
  assert.equal(model.leaders[0].nickname, "Alpha");
});

test("2. provisional queda excluido", () => {
  const match = series({ maps: [game({ id: 1, stats: [stat(10, "Alpha", "left", 5)] }), game({ id: 2, number: 2, status: "provisional", stats: [stat(20, "Charlie", "right", 100)] })] });
  assert.equal(buildKillRaceMvpOverlay({ tournament: tournament(), teams, matches: [match], broadcastMatchId: 10 }).leaders[0].confirmedKills, 5);
});

test("3. serie activa usa el último mapa confirmado", () => {
  const match = series({ maps: [game({ id: 1, number: 1, stats: [stat(10, "Alpha", "left", 20)] }), game({ id: 2, number: 2, stats: [stat(20, "Charlie", "right", 8)] })] });
  const model = buildKillRaceMvpOverlay({ tournament: tournament(), teams, matches: [match], broadcastMatchId: 10 });
  assert.equal(model.scope, "map");
  assert.equal(model.mapNumber, 2);
  assert.equal(model.leaders[0].nickname, "Charlie");
});

test("4. serie completada usa acumulado de la serie", () => {
  const match = series({ status: "completed", winnerId: 1, maps: [game({ id: 1, stats: [stat(10, "Alpha", "left", 6)] }), game({ id: 2, number: 2, stats: [stat(10, "Alpha", "left", 7)] })] });
  const model = buildKillRaceMvpOverlay({ tournament: tournament(), teams, matches: [match, series({ id: 12, round: 2, teamA: null, teamB: null, maps: [] })], broadcastMatchId: 10 });
  assert.equal(model.scope, "series");
  assert.equal(model.leaders[0].confirmedKills, 13);
});

test("5. torneo completado usa acumulado del torneo", () => {
  const fixture = completedBracket();
  const model = buildKillRaceMvpOverlay(fixture);
  assert.equal(model.scope, "tournament");
  assert.equal(model.leaders[0].confirmedKills, 13);
});

test("6. MVP único se resuelve correctamente", () => {
  const model = buildKillRaceMvpOverlay({ tournament: tournament(), teams, matches: [series()], broadcastMatchId: 10 });
  assert.equal(model.leaders.length, 1);
  assert.equal(model.isTied, false);
});

test("7. empate de dos jugadores se conserva", () => {
  const match = series({ maps: [game({ stats: [stat(10, "Alpha", "left", 8), stat(20, "Charlie", "right", 8)] })] });
  const model = buildKillRaceMvpOverlay({ tournament: tournament(), teams, matches: [match], broadcastMatchId: 10 });
  assert.deepEqual(model.leaders.map((player) => player.nickname), ["Alpha", "Charlie"]);
});

test("8. empate de cuatro jugadores se conserva", () => {
  const match = series({ maps: [game({ stats: [stat(10, "Alpha", "left", 8), stat(11, "Bravo", "left", 8), stat(20, "Charlie", "right", 8), stat(21, "Delta", "right", 8)] })] });
  assert.equal(buildKillRaceMvpOverlay({ tournament: tournament(), teams, matches: [match], broadcastMatchId: 10 }).leaders.length, 4);
});

test("9. no existe desempate por daño", () => {
  const match = series({ maps: [game({ stats: [stat(10, "Alpha", "left", 8, { damage: 1 }), stat(20, "Charlie", "right", 8, { damage: 9999 })] })] });
  assert.equal(buildKillRaceMvpOverlay({ tournament: tournament(), teams, matches: [match], broadcastMatchId: 10 }).leaders.length, 2);
});

test("10. no existe desempate por declared_kd", () => {
  const match = series({ maps: [game({ stats: [stat(10, "Alpha", "left", 8, { declared_kd: 1 }), stat(20, "Charlie", "right", 8, { declared_kd: 9 })] })] });
  assert.equal(buildKillRaceMvpOverlay({ tournament: tournament(), teams, matches: [match], broadcastMatchId: 10 }).leaders.length, 2);
});

test("11. sin player stats produce estado honesto", () => {
  const match = series({ maps: [game({ stats: [] })] });
  assert.equal(buildKillRaceMvpOverlay({ tournament: tournament(), teams, matches: [match], broadcastMatchId: 10 }).state, "no-player-stats");
});

test("12. no existe fallback a Team MVP", () => {
  const match = series({ maps: [game({ killsA: 40, killsB: 3, stats: [] })] });
  const model = buildKillRaceMvpOverlay({ tournament: tournament(), teams, matches: [match], broadcastMatchId: 10 });
  assert.deepEqual(model.leaders, []);
  assert.equal(model.hasConfirmedTeamResults, true);
});

test("13. match explícito tiene prioridad", () => {
  assert.equal(resolveBroadcastContext({ explicitTournamentId: 91, explicitMatchId: 10, channel: { activeTournamentId: 92, broadcastMatchId: 11 } }).matchId, 10);
});

test("14. match inválido no elige otra serie", () => {
  const model = buildKillRaceMvpOverlay({ tournament: tournament(), teams, matches: [series()], broadcastMatchId: 999 });
  assert.equal(model.state, "no-match");
  assert.equal(model.matchId, null);
});

test("15. sin broadcastMatchId no elige primera serie", () => {
  assert.equal(buildKillRaceMvpOverlay({ tournament: tournament(), teams, matches: [series()] }).state, "no-match");
});

test("16. identidades iguales en equipos distintos no colisionan", () => {
  const match = series({ maps: [game({ stats: [stat(null, "Same", "left", 6), stat(null, "Same", "right", 5)] })] });
  const model = buildKillRaceMvpOverlay({ tournament: tournament(), teams, matches: [match], broadcastMatchId: 10 });
  assert.equal(model.ranking.length, 2);
  assert.notEqual(model.ranking[0].key, model.ranking[1].key);
});

test("17. promedio usa solo mapas donde existe stat del jugador", () => {
  const match = series({ status: "completed", winnerId: 1, maps: [game({ id: 1, stats: [stat(10, "Alpha", "left", 6)] }), game({ id: 2, number: 2, stats: [stat(20, "Charlie", "right", 4)] }), game({ id: 3, number: 3, stats: [stat(10, "Alpha", "left", 10)] })] });
  const model = buildKillRaceMvpOverlay({ tournament: tournament(), teams, matches: [match, series({ id: 12, round: 2, teamA: null, teamB: null, maps: [] })], broadcastMatchId: 10 });
  const alpha = model.ranking.find((player) => player.nickname === "Alpha");
  assert.equal(alpha.confirmedMaps, 2);
  assert.equal(alpha.averageKills, 8);
});

test("18. visualKey cambia al cambiar kills", () => {
  const left = buildKillRaceMvpOverlay({ tournament: tournament(), teams, matches: [series()], broadcastMatchId: 10 });
  const right = buildKillRaceMvpOverlay({ tournament: tournament(), teams, matches: [series({ maps: [game({ stats: [stat(10, "Alpha", "left", 7)] })] })], broadcastMatchId: 10 });
  assert.notEqual(left.visualKey, right.visualKey);
});

test("19. visualKey cambia al cambiar mapa o scope", () => {
  const active = buildKillRaceMvpOverlay({ tournament: tournament(), teams, matches: [series()], broadcastMatchId: 10 });
  const completed = buildKillRaceMvpOverlay({ tournament: tournament(), teams, matches: [series({ status: "completed", winnerId: 1 }), series({ id: 12, round: 2, teamA: null, teamB: null, maps: [] })], broadcastMatchId: 10 });
  assert.notEqual(active.visualKey, completed.visualKey);
});

test("20. payload equivalente conserva visualKey", () => {
  const input = { tournament: tournament(), teams, matches: [series()], broadcastMatchId: 10 };
  assert.equal(buildKillRaceMvpOverlay(input).visualKey, buildKillRaceMvpOverlay(structuredClone(input)).visualKey);
});

test("21. final completed con winner produce campeón", () => {
  assert.equal(buildKillRaceChampionOverlay(completedBracket()).champion.name, "Team Alpha");
});

test("22. winner sin completed no produce campeón", () => {
  const fixture = completedBracket();
  fixture.matches[2].status = "in_progress";
  assert.equal(buildKillRaceChampionOverlay(fixture).state, "pending");
  assert.equal(buildKillRaceCasterState({ matches: fixture.matches, teams }).champion, null);
});

test("23. tournament completed sin final válida no produce campeón", () => {
  const model = buildKillRaceChampionOverlay({ tournament: tournament({ status: "completed" }), teams, matches: [series()] });
  assert.equal(model.state, "pending");
});

test("24. championTeamId aislado no produce campeón", () => {
  const model = buildKillRaceChampionOverlay({ tournament: tournament({ status: "completed", config: { championTeamId: 1 } }), teams, matches: [series()] });
  assert.equal(model.champion, null);
});

test("25. finalista se resuelve correctamente", () => {
  assert.equal(buildKillRaceChampionOverlay(completedBracket()).finalist.name, "Team 3");
});

test("26. score final respeta orientación A/B", () => {
  const fixture = completedBracket();
  fixture.matches[2] = series({ id: 12, round: 2, status: "completed", teamA: 1, teamB: 3, winnerId: 3, nextMatchId: null, scoreA: 1, scoreB: 2 });
  assert.deepEqual(buildKillRaceChampionOverlay(fixture).finalScore, { left: 1, right: 2, champion: 2, finalist: 1 });
});

test("27. roster del campeón es correcto", () => {
  assert.deepEqual(buildKillRaceChampionOverlay(completedBracket()).champion.roster, ["Alpha", "Bravo"]);
});

test("28. kills del campeón usan solo mapas confirmed", () => {
  const fixture = completedBracket();
  fixture.matches[2].maps.push(game({ id: 104, number: 2, status: "provisional", killsA: 999, stats: [] }));
  assert.equal(buildKillRaceChampionOverlay(fixture).confirmedKills, 20);
});

test("29. series ganadas se calculan correctamente", () => {
  assert.equal(buildKillRaceChampionOverlay(completedBracket()).seriesWins, 2);
});

test("30. torneo incompleto produce pending", () => {
  assert.equal(buildKillRaceChampionOverlay({ tournament: tournament(), teams, matches: [series()] }).state, "pending");
});

test("31. BYE no cuenta como serie ganada jugada", () => {
  const fixture = completedBracket();
  fixture.matches.unshift(series({ id: 9, round: 0, status: "completed", teamA: 1, teamB: null, winnerId: 1, nextMatchId: 10, maps: [] }));
  assert.equal(buildKillRaceChampionOverlay(fixture).seriesWins, 2);
});

test("32. visualKey cambia con winner", () => {
  const first = buildKillRaceChampionOverlay(completedBracket());
  const fixture = completedBracket();
  fixture.matches[2] = series({ id: 12, round: 2, status: "completed", teamA: 1, teamB: 3, winnerId: 3, nextMatchId: null, scoreA: 0, scoreB: 2 });
  assert.notEqual(first.visualKey, buildKillRaceChampionOverlay(fixture).visualKey);
});

test("33. visualKey cambia con score final", () => {
  const first = buildKillRaceChampionOverlay(completedBracket());
  const fixture = completedBracket();
  fixture.matches[2].maps_won_a = 3;
  assert.notEqual(first.visualKey, buildKillRaceChampionOverlay(fixture).visualKey);
});

test("34. payload equivalente conserva visualKey", () => {
  const fixture = completedBracket();
  assert.equal(buildKillRaceChampionOverlay(fixture).visualKey, buildKillRaceChampionOverlay(structuredClone(fixture)).visualKey);
});

test("35. Kill Race layout=mvp usa overlay dedicado", () => {
  assert.equal(resolveStreamSurface("mvp", { isKillRace: true, isBracket: true }), "kill-race-mvp");
});

test("36. no Kill Race conserva MVP existente", () => {
  assert.equal(resolveStreamSurface("mvp", { isKillRace: false, isBracket: false }), "standings");
});

test("37. Kill Race layout=champion es compatible", () => {
  assert.equal(resolveStreamSurface("champion", { isKillRace: true, isBracket: true }), "kill-race-champion");
  assert.ok(getCompatibleOverlayLayouts({ isKillRace: true, supportsMatchPoint: false }).includes("champion"));
});

test("38. otros engines no reciben Champion Kill Race", () => {
  assert.equal(resolveStreamSurface("champion", { isKillRace: false, isBracket: false }), "unsupported-champion");
});

test("39. URL explícita conserva prioridad", () => {
  assert.deepEqual(resolveBroadcastContext({ explicitTournamentId: 91, explicitMatchId: 10, channel: { activeTournamentId: 92, broadcastMatchId: 11 } }), { tournamentId: 91, matchId: 10, source: "explicit" });
});

test("40. canal main cambia contexto sin cambiar URL", () => {
  const url = "/stream?channel=main&layout=mvp&obs=1&bg=transparent";
  const first = resolveBroadcastContext({ explicitTournamentId: null, explicitMatchId: null, channel: { activeTournamentId: 91, broadcastMatchId: 10 } });
  const second = resolveBroadcastContext({ explicitTournamentId: null, explicitMatchId: null, channel: { activeTournamentId: 92, broadcastMatchId: 20 } });
  assert.equal(url, "/stream?channel=main&layout=mvp&obs=1&bg=transparent");
  assert.notDeepEqual(first, second);
});

test("41. polling existente no se duplica", () => {
  const source = readFileSync(new URL("../app/lib/useStreamLeaderboard.ts", import.meta.url), "utf8");
  assert.equal((source.match(/setTimeout\(\(\) => void poll\(\), pollMs\)/g) ?? []).length, 1);
  assert.match(source, /STREAM_POLL_INTERVAL_MS = 1800/);
});

test("42. transparencia no renderiza errores dominantes", () => {
  const mvpSource = readFileSync(new URL("../app/components/KillRaceMvpOverlay.tsx", import.meta.url), "utf8");
  const championSource = readFileSync(new URL("../app/components/KillRaceChampionOverlay.tsx", import.meta.url), "utf8");
  assert.match(mvpSource, /transparent && isEmpty/);
  assert.match(championSource, /transparent && !isReady/);
  assert.match(mvpSource, /is-signal-safe-empty/);
  assert.match(championSource, /is-signal-safe-empty/);
});

test("43. launcher LIVE P5 utiliza channel=main", () => {
  assert.equal(
    getFollowOperatorOverlayUrl("http://localhost:3000", "mvp", "main", true),
    "http://localhost:3000/stream?channel=main&layout=mvp&obs=1&bg=transparent"
  );
  assert.equal(
    getFollowOperatorOverlayUrl("http://localhost:3000", "champion", "main", true),
    "http://localhost:3000/stream?channel=main&layout=champion&obs=1&bg=transparent"
  );
});

test("44. launcher histórico P5 utiliza tournamentId explícito sin canal", () => {
  assert.equal(
    getTournamentOverlayUrl("http://localhost:3000", 24, "mvp"),
    "http://localhost:3000/stream?tournamentId=24&layout=mvp&obs=1"
  );
  assert.equal(
    getTournamentOverlayUrl("http://localhost:3000", 24, "champion"),
    "http://localhost:3000/stream?tournamentId=24&layout=champion&obs=1"
  );
});

test("45. torneo cerrado seleccionado no reutiliza torneo ni match del canal main", () => {
  const context = resolveBroadcastContext({
    explicitTournamentId: 24,
    explicitMatchId: null,
    channel: { activeTournamentId: 25, broadcastMatchId: 103 },
  });
  assert.deepEqual(context, { tournamentId: 24, matchId: null, source: "explicit" });
});

test("46. Champion histórico usa exclusivamente la final del torneo seleccionado", () => {
  const selected = completedBracket();
  const foreignTeams = teams.map((entry) => ({
    ...structuredClone(entry),
    id: entry.id + 100,
    tournament_id: 92,
    name: entry.id === 1 ? "Team Alpha Prime" : entry.name,
  }));
  const foreignFinal = series({
    id: 99,
    round: 9,
    status: "completed",
    teamA: 101,
    teamB: 102,
    winnerId: 102,
    nextMatchId: null,
    tournamentId: 92,
  });
  const model = buildKillRaceChampionOverlay({
    ...selected,
    teams: [...selected.teams, ...foreignTeams],
    matches: [...selected.matches, foreignFinal],
  });
  assert.equal(model.finalMatchId, 12);
  assert.equal(model.champion.name, "Team Alpha");
});

test("47. MVP histórico completado agrega solo confirmed del torneo seleccionado", () => {
  const selected = completedBracket();
  const foreign = series({
    id: 99,
    round: 9,
    status: "completed",
    winnerId: 1,
    nextMatchId: null,
    tournamentId: 92,
    maps: [game({ id: 999, stats: [stat(10, "Alpha", "left", 999)] })],
  });
  selected.matches[0].maps.push(game({ id: 105, number: 2, status: "provisional", stats: [stat(10, "Alpha", "left", 500)] }));
  const model = buildKillRaceMvpOverlay({ ...selected, matches: [...selected.matches, foreign] });
  assert.equal(model.scope, "tournament");
  assert.equal(model.leaders[0].confirmedKills, 13);
});

test("48. IDs y nicknames similares no cruzan equipos entre torneos", () => {
  const selected = completedBracket();
  const foreignTeams = selected.teams.map((entry) => ({
    ...structuredClone(entry),
    tournament_id: 92,
    name: `${entry.name} Foreign`,
  }));
  const foreignMatch = series({
    id: 90,
    round: 1,
    status: "completed",
    winnerId: 1,
    nextMatchId: null,
    tournamentId: 92,
    maps: [game({ id: 990, stats: [stat(10, "Alpha", "left", 999)] })],
  });
  const model = buildKillRaceMvpOverlay({
    ...selected,
    teams: [...selected.teams, ...foreignTeams],
    matches: [...selected.matches, foreignMatch],
  });
  assert.equal(model.leaders[0].teamName, "Team Alpha");
  assert.equal(model.leaders[0].confirmedKills, 13);
});

test("49. cambiar selector cambia previews pero no URLs LIVE", () => {
  const preview24 = getTournamentOverlayUrl("http://localhost:3000", 24, "mvp");
  const preview20 = getTournamentOverlayUrl("http://localhost:3000", 20, "mvp");
  const liveBefore = getFollowOperatorOverlayUrl("http://localhost:3000", "mvp", "main", true);
  const liveAfter = getFollowOperatorOverlayUrl("http://localhost:3000", "mvp", "main", true);
  assert.notEqual(preview24, preview20);
  assert.equal(liveBefore, liveAfter);
});

test("50. URL de torneo explícita mantiene prioridad sobre canal main", () => {
  assert.deepEqual(
    resolveBroadcastContext({
      explicitTournamentId: 20,
      explicitMatchId: null,
      channel: { activeTournamentId: 25, broadcastMatchId: 103 },
    }),
    { tournamentId: 20, matchId: null, source: "explicit" }
  );
});

test("51. histórico sin player_stats mantiene estado honesto sin Team MVP", () => {
  const fixture = completedBracket();
  for (const match of fixture.matches) {
    for (const map of match.maps) map.player_stats = [];
  }
  const model = buildKillRaceMvpOverlay(fixture);
  assert.equal(model.state, "no-player-stats");
  assert.equal(model.message, "SIN DESGLOSE INDIVIDUAL CONFIRMADO");
  assert.deepEqual(model.leaders, []);
});

test("52. histórico sin final válida no produce campeón aunque tenga championTeamId", () => {
  const fixture = completedBracket();
  fixture.tournament.config.championTeamId = 1;
  fixture.matches[2].winner_id = null;
  const model = buildKillRaceChampionOverlay(fixture);
  assert.equal(model.state, "pending");
  assert.equal(model.champion, null);
});

test("53. WSOW conserva MVP acumulativo y rechaza Champion Kill Race", () => {
  assert.equal(resolveStreamSurface("mvp", { isKillRace: false, isBracket: false }), "standings");
  assert.equal(resolveStreamSurface("champion", { isKillRace: false, isBracket: false }), "unsupported-champion");
  assert.deepEqual(
    getCompatibleOverlayLayouts({ isKillRace: false, supportsMatchPoint: true }),
    ["sidebar", "lower-third", "matchpoint", "mvp", "leaderboard"]
  );
});

test("54. histórico cambia visualKey por torneo y conserva clave con payload equivalente", () => {
  const first = completedBracket();
  const second = structuredClone(first);
  second.tournament.id = 92;
  second.teams.forEach((entry) => { entry.tournament_id = 92; });
  second.matches.forEach((entry) => { entry.tournament_id = 92; });
  const firstModel = buildKillRaceMvpOverlay(first);
  const equivalent = buildKillRaceMvpOverlay(structuredClone(first));
  const switched = buildKillRaceMvpOverlay(second);
  assert.equal(firstModel.visualKey, equivalent.visualKey);
  assert.notEqual(firstModel.visualKey, switched.visualKey);
});

test("55. match fijo conserva scope de serie aun con torneo completado", () => {
  const fixture = completedBracket();
  const model = buildKillRaceMvpOverlay({ ...fixture, broadcastMatchId: 12 });
  assert.equal(model.scope, "series");
  assert.equal(model.matchId, 12);
  assert.equal(
    getTournamentOverlayUrl("http://localhost:3000", 91, "mvp", 12),
    "http://localhost:3000/stream?tournamentId=91&matchId=12&layout=mvp&obs=1"
  );
});
