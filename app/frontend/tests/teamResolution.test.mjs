import test from "node:test";
import assert from "node:assert/strict";

import { buildTeamResolutionIndex, resolveTeamCandidate } from "../lib/teamResolution.mjs";

const teams = [
  { id: 1, name: "Amon Reapers", members: [{ player: { nickname: "VITO" } }, { player: { nickname: "JOAN" } }] },
  { id: 2, name: "Ghost Squad", members: [{ player: { nickname: "NEO" } }] },
  { id: 3, name: "ghost squad clone", members: [{ player: { nickname: "NEO" } }] },
];

test("resolves an exact team name match", () => {
  const index = buildTeamResolutionIndex(teams);
  const outcome = resolveTeamCandidate("Amon Reapers", index);
  assert.equal(outcome.kind, "found");
  assert.equal(outcome.team.id, 1);
});

test("resolves a single-player/captain match", () => {
  const index = buildTeamResolutionIndex(teams);
  const outcome = resolveTeamCandidate("VITO", index);
  assert.equal(outcome.kind, "found");
  assert.equal(outcome.team.id, 1);
});

test("reports not_found for text matching no team", () => {
  const index = buildTeamResolutionIndex(teams);
  const outcome = resolveTeamCandidate("Nonexistent Team", index);
  assert.equal(outcome.kind, "not_found");
});

test("reports ambiguous when a single player name maps to 2+ teams", () => {
  const index = buildTeamResolutionIndex(teams);
  const outcome = resolveTeamCandidate("NEO", index);
  assert.equal(outcome.kind, "ambiguous");
  assert.equal(outcome.candidates.length, 2);
});

test("reports empty for blank input", () => {
  const index = buildTeamResolutionIndex(teams);
  const outcome = resolveTeamCandidate("   ", index);
  assert.equal(outcome.kind, "empty");
});
