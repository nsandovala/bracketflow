import test from "node:test";
import assert from "node:assert/strict";

import {
  CASTER_CONTEXT_KEYS,
  createCasterInspectorSelection,
  getMatchPointDefinitionSummary,
  reconcileCasterInspectorSelection,
  toggleCasterInspectorContext,
  toggleCasterPlayerSelection,
  reconcileCasterPlayerSelection,
} from "../lib/casterInspectorState.mjs";

test("all five Caster cards activate their inspector panel", () => {
  let state = createCasterInspectorSelection(1, 0, 0);

  for (const contextKey of CASTER_CONTEXT_KEYS) {
    state = toggleCasterInspectorContext(state, contextKey);
    assert.equal(state.selected, contextKey);
  }
});

test("Kill Race player selection opens, closes, replaces and clears stale keys", () => {
  let selected = toggleCasterPlayerSelection(null, "1:7");
  assert.equal(selected, "1:7");
  selected = toggleCasterPlayerSelection(selected, "1:7");
  assert.equal(selected, null);
  selected = toggleCasterPlayerSelection(selected, "2:7");
  assert.equal(selected, "2:7");
  assert.equal(reconcileCasterPlayerSelection(selected, ["1:7"]), null);
});

test("same nickname in different teams uses distinct player keys", () => {
  assert.notEqual("1:endgamex", "2:endgamex");
});

test("Match Point panel consumes the backend completion policy", () => {
  const policy = {
    state: "match_point_not_configured",
    action: "configure_match_point",
    code: "MATCH_POINT_NOT_CONFIGURED",
    reason:
      "Este torneo admite Match Point, pero no tiene un umbral persistido.",
    matchPointThreshold: null,
  };

  const summary = getMatchPointDefinitionSummary({
    policy,
    status: {
      state: "not_configured",
      reason: policy.reason,
    },
    isBracket: false,
    bracketChampionLabel: null,
    tournamentCompleted: false,
  });

  assert.equal(summary.label, "Match Point no configurado");
  assert.equal(summary.detail, "Requiere configuración persistida");
  assert.equal(summary.reason, policy.reason);
  assert.equal(summary.threshold, null);
});

test("tournament switch clears and recomputes inspector selection", () => {
  let state = createCasterInspectorSelection(10, 2, 2);
  state = toggleCasterInspectorContext(state, "mvp");
  assert.equal(state.selected, "mvp");

  state = reconcileCasterInspectorSelection(state, 11, 0, 3);
  assert.equal(state.tournamentId, 11);
  assert.equal(state.selected, "matches");

  state = reconcileCasterInspectorSelection(state, 12, 0, 0);
  assert.equal(state.selected, "definition");
});
