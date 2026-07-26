import test from "node:test";
import assert from "node:assert/strict";

import {
  createPlayerBroadcastProfileView,
  getOfficialPlayerPerformance,
  getStableMvpRanks,
} from "../lib/playerBroadcastProfile.mjs";

const fullProfile = {
  id: 7,
  display_name: "NeonWolf",
  short_name: "NEO",
  country: "CL",
  avatar_url: null,
  notes: "Nota operativa existente",
  role: "flex",
  declared_kd: 2.45,
  declared_platform: "pc",
  preferred_input: "controller",
  short_bio: "Competidor de Warzone.",
  social_handle: "@neonwolf",
  broadcast_notes: "Contexto declarado para caster.",
};

const officialResults = [
  {
    match_id: 11,
    round: 1,
    team_id: 3,
    team_name: "Neon Team",
    player_stats: [{ player_name: "NeonWolf", kills: 8 }],
  },
  {
    match_id: 12,
    round: 2,
    team_id: 3,
    team_name: "Neon Team",
    player_stats: [{ player_name: "OtraPersona", kills: 4 }],
  },
  {
    match_id: 13,
    round: 3,
    team_id: 3,
    team_name: "Neon Team",
    player_stats: [{ player_name: "NeonWolf", kills: 16 }],
  },
];

test("declared profile and official tournament performance stay separated", () => {
  const view = createPlayerBroadcastProfileView({
    playerName: "NeonWolf",
    teamId: 3,
    teamName: "Neon Team",
    profile: fullProfile,
    results: officialResults,
    mvpRank: 1,
  });

  assert.equal(view.declared.declaredKd, 2.45);
  assert.equal(view.declared.role, "Flex");
  assert.equal(view.official.kills, 24);
  assert.equal(view.official.reportedMatches, 2);
  assert.equal(view.official.averageKills, 12);
});

test("missing declared values use honest fallbacks", () => {
  const view = createPlayerBroadcastProfileView({
    playerName: "Legacy",
    teamId: 4,
    teamName: "Legacy Team",
    profile: {
      ...fullProfile,
      display_name: "Legacy",
      country: null,
      role: null,
      declared_kd: null,
      declared_platform: null,
      preferred_input: null,
      short_bio: null,
      social_handle: null,
      broadcast_notes: null,
    },
  });

  assert.equal(view.profileStatus, "Perfil broadcast no configurado");
  assert.equal(view.declared.declaredKdLabel, "Sin K/D declarado");
  assert.equal(view.declared.role, "Sin dato");
  assert.equal(view.official.status, "Sin player stats oficiales");
});

test("average kills only uses reports containing that player's stats", () => {
  const performance = getOfficialPlayerPerformance({
    playerName: "NeonWolf",
    teamId: 3,
    teamName: "Neon Team",
    results: officialResults,
  });

  assert.equal(performance.kills, 24);
  assert.equal(performance.reportedMatches, 2);
  assert.equal(performance.averageKills, 12);
  assert.deepEqual(
    performance.perMatch.map((match) => match.round),
    [1, 3]
  );
});

test("tied MVP ranks are stable and deterministic", () => {
  const ranking = getStableMvpRanks([
    { playerName: "Zulu", teamName: "B", kills: 18, matches: 3 },
    { playerName: "Alpha", teamName: "A", kills: 18, matches: 3 },
    { playerName: "Bravo", teamName: "C", kills: 12, matches: 2 },
  ]);

  assert.deepEqual(
    ranking.map(({ playerName, rank }) => [playerName, rank]),
    [["Alpha", 1], ["Zulu", 1], ["Bravo", 3]]
  );
});

test("unresolved identity still produces a safe inspector view", () => {
  const view = createPlayerBroadcastProfileView({
    playerName: "RosterOnly",
    teamId: 9,
    teamName: "Roster Team",
    profile: null,
    results: [],
  });

  assert.equal(view.identityStatus, "Identidad no vinculada");
  assert.equal(view.profileStatus, "Perfil broadcast no configurado");
  assert.equal(view.declared.displayName, "RosterOnly");
  assert.equal(view.official.status, "Sin player stats oficiales");
});
