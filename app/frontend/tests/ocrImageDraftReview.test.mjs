import test from "node:test";
import assert from "node:assert/strict";

import {
  buildOcrDraftReports,
  createOcrCandidateRow,
  evaluateOcrBatch,
} from "../lib/ocrImageDraftReview.mjs";

const teams = [
  { id: 1, name: "Amon Reapers", members: [{ player: { nickname: "VITO" } }, { player: { nickname: "JOAN" } }] },
  { id: 2, name: "Ghost Squad", members: [{ player: { nickname: "NEO" } }] },
];

function baseContext(overrides = {}) {
  return {
    teams,
    usesPlacement: true,
    effectiveLobbySize: 20,
    officialResults: [],
    existingDraftTeamIds: new Set(),
    lowConfidenceThreshold: 0.6,
    ...overrides,
  };
}

function extractionRow(overrides = {}) {
  return {
    rawTeamName: "Amon Reapers",
    kills: 15,
    placement: 2,
    confidence: 0.9,
    warnings: [],
    ...overrides,
  };
}

const draftParams = {
  tournamentId: 1,
  matchNumber: 1,
  activeMatchKey: "match:1",
  imageFileName: "shot.png",
};

test("a valid OCR-normalized row becomes a local draft with source OCR_DRAFT", () => {
  const candidate = createOcrCandidateRow(extractionRow());
  const rows = evaluateOcrBatch([candidate], baseContext());
  assert.equal(rows[0].evaluation.status, "valida");

  const drafts = buildOcrDraftReports(rows, draftParams);
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].teamId, 1);
  assert.equal(drafts[0].kills, 15);
  assert.equal(drafts[0].placement, 2);
  assert.equal(drafts[0].source, "OCR_DRAFT");
  assert.equal(drafts[0].status, "pending");
  assert.match(drafts[0].note, /OCR imagen/);
});

test("an unrecognized team remains unresolved and cannot become a draft", () => {
  const candidate = createOcrCandidateRow(extractionRow({ rawTeamName: "Nobody FC" }));
  const rows = evaluateOcrBatch([candidate], baseContext());
  assert.equal(rows[0].evaluation.status, "equipo_no_reconocido");
  assert.equal(rows[0].evaluation.teamId, null);
  assert.equal(buildOcrDraftReports(rows, draftParams).length, 0);
});

test("an ambiguous team is never auto-mapped", () => {
  const ambiguousTeams = [...teams, { id: 3, name: "Amon Reapers" }];
  const candidate = createOcrCandidateRow(extractionRow({ rawTeamName: "Amon Reapers" }));
  const rows = evaluateOcrBatch([candidate], baseContext({ teams: ambiguousTeams }));
  assert.equal(rows[0].evaluation.status, "equipo_ambiguo");
  assert.equal(rows[0].evaluation.teamId, null);
  assert.equal(rows[0].evaluation.ambiguousCandidates.length, 2);
  assert.equal(buildOcrDraftReports(rows, draftParams).length, 0);
});

test("negative kills are invalid", () => {
  const candidate = createOcrCandidateRow(extractionRow({ kills: -3 }));
  const rows = evaluateOcrBatch([candidate], baseContext());
  assert.equal(rows[0].evaluation.status, "datos_incompletos");
});

test("missing placement is incomplete", () => {
  const candidate = createOcrCandidateRow(extractionRow({ placement: null }));
  const rows = evaluateOcrBatch([candidate], baseContext());
  assert.equal(rows[0].evaluation.status, "datos_incompletos");
});

test("placement outside the lobby range is invalid", () => {
  const candidate = createOcrCandidateRow(extractionRow({ placement: 99 }));
  const rows = evaluateOcrBatch([candidate], baseContext({ effectiveLobbySize: 20 }));
  assert.equal(rows[0].evaluation.status, "datos_incompletos");
});

test("a duplicate extracted team within the same image is flagged", () => {
  const candidates = [
    createOcrCandidateRow(extractionRow({ rawTeamName: "Amon Reapers", placement: 1 })),
    createOcrCandidateRow(extractionRow({ rawTeamName: "Amon Reapers", placement: 2 })),
  ];
  const rows = evaluateOcrBatch(candidates, baseContext());
  assert.equal(rows[0].evaluation.status, "valida");
  assert.equal(rows[1].evaluation.status, "draft_duplicado");
});

test("an existing official report is never overwritten and mismatches surface as a conflict", () => {
  const matchingOfficial = baseContext({
    officialResults: [{ team_id: 1, kills: 15, placement: 2 }],
  });
  const matchingRows = evaluateOcrBatch([createOcrCandidateRow(extractionRow())], matchingOfficial);
  assert.equal(matchingRows[0].evaluation.status, "reporte_oficial_existente");
  assert.equal(buildOcrDraftReports(matchingRows, draftParams).length, 0);

  const conflictingOfficial = baseContext({
    officialResults: [{ team_id: 1, kills: 9, placement: 4 }],
  });
  const conflictingRows = evaluateOcrBatch([createOcrCandidateRow(extractionRow())], conflictingOfficial);
  assert.equal(conflictingRows[0].evaluation.status, "conflicto");
  assert.equal(buildOcrDraftReports(conflictingRows, draftParams).length, 0);
});

test("a team that already has a local draft for this match is flagged as duplicate", () => {
  const context = baseContext({ existingDraftTeamIds: new Set([1]) });
  const rows = evaluateOcrBatch([createOcrCandidateRow(extractionRow())], context);
  assert.equal(rows[0].evaluation.status, "draft_duplicado");
});

test("optional player stats are accepted when they sum to the team kills", () => {
  const row = extractionRow({
    playerStats: [
      { playerName: "VITO", kills: 8 },
      { playerName: "JOAN", kills: 7 },
    ],
  });
  const rows = evaluateOcrBatch([createOcrCandidateRow(row)], baseContext());
  assert.equal(rows[0].evaluation.status, "valida");
  assert.deepEqual(rows[0].evaluation.playerStats, [
    { playerName: "VITO", kills: 8 },
    { playerName: "JOAN", kills: 7 },
  ]);

  const drafts = buildOcrDraftReports(rows, draftParams);
  assert.deepEqual(drafts[0].playerStats, [
    { playerName: "VITO", kills: 8 },
    { playerName: "JOAN", kills: 7 },
  ]);
});

test("a player kills sum mismatch blocks the row instead of guessing", () => {
  const row = extractionRow({
    playerStats: [
      { playerName: "VITO", kills: 5 },
      { playerName: "JOAN", kills: 5 },
    ],
  });
  const rows = evaluateOcrBatch([createOcrCandidateRow(row)], baseContext());
  assert.equal(rows[0].evaluation.status, "datos_incompletos");
  assert.ok(rows[0].evaluation.warnings.some((warning) => warning.includes("no coinciden")));
});

test("a team-only row (no player breakdown) remains valid", () => {
  const row = extractionRow({ playerStats: undefined });
  const rows = evaluateOcrBatch([createOcrCandidateRow(row)], baseContext());
  assert.equal(rows[0].evaluation.status, "valida");
  assert.equal(rows[0].evaluation.playerStats, null);
});

test("an extraction with no rows cannot create any drafts", () => {
  const rows = evaluateOcrBatch([], baseContext());
  assert.deepEqual(rows, []);
  assert.deepEqual(buildOcrDraftReports(rows, draftParams), []);
});

test("low extraction confidence is flagged for review instead of accepted silently", () => {
  const row = extractionRow({ confidence: 0.3 });
  const rows = evaluateOcrBatch([createOcrCandidateRow(row)], baseContext());
  assert.equal(rows[0].evaluation.status, "baja_confianza");
  assert.equal(buildOcrDraftReports(rows, draftParams).length, 0);
});

test("an uncertain digit warning downgrades the row even at high confidence, never auto-normalized", () => {
  const row = extractionRow({ confidence: 0.95, warnings: ["uncertain_digit:kills"] });
  const rows = evaluateOcrBatch([createOcrCandidateRow(row)], baseContext());
  assert.equal(rows[0].evaluation.status, "baja_confianza");
  // El valor original (15) se conserva intacto: nunca se re-adivina el digito.
  assert.equal(rows[0].evaluation.kills, 15);
});

test("operator can manually resolve an unrecognized team without altering global identity", () => {
  const candidate = createOcrCandidateRow(extractionRow({ rawTeamName: "Nobody FC" }));
  const manuallyResolved = { ...candidate, teamOverrideId: 2, edited: { ...candidate.edited, team: true } };
  const rows = evaluateOcrBatch([manuallyResolved], baseContext());
  assert.equal(rows[0].evaluation.status, "valida");
  assert.equal(rows[0].evaluation.teamId, 2);

  const drafts = buildOcrDraftReports(rows, draftParams);
  assert.equal(drafts.length, 1);
  assert.match(drafts[0].note, /corregido manualmente/);
  // El texto crudo detectado se preserva como metadata, no se pierde.
  assert.match(drafts[0].note, /Nobody FC/);
});

test("excluding a valid row keeps it out of the created drafts", () => {
  const candidate = createOcrCandidateRow(extractionRow());
  const excluded = { ...candidate, included: false };
  const rows = evaluateOcrBatch([excluded], baseContext());
  assert.equal(rows[0].evaluation.status, "valida");
  assert.equal(buildOcrDraftReports(rows, draftParams).length, 0);
});

test("created drafts are always stamped with the CURRENT tournament/match context, never a stale one", () => {
  const candidate = createOcrCandidateRow(extractionRow());
  const rows = evaluateOcrBatch([candidate], baseContext());

  const draftsForMatchOne = buildOcrDraftReports(rows, draftParams);
  assert.equal(draftsForMatchOne[0].tournamentId, 1);
  assert.equal(draftsForMatchOne[0].matchNumber, 1);
  assert.equal(draftsForMatchOne[0].activeMatchKey, "match:1");

  const draftsForMatchTwo = buildOcrDraftReports(rows, {
    tournamentId: 9,
    matchNumber: 4,
    activeMatchKey: "match:42",
    imageFileName: "shot.png",
  });
  assert.equal(draftsForMatchTwo[0].tournamentId, 9);
  assert.equal(draftsForMatchTwo[0].matchNumber, 4);
  assert.equal(draftsForMatchTwo[0].activeMatchKey, "match:42");
});
