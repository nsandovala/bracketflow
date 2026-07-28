import test from "node:test";
import assert from "node:assert/strict";

import {
  createBackendOcrProvider,
  getBackendOcrProviderStatus,
  OCR_IMAGE_MAX_BYTES,
  unavailableOcrProvider,
  validateOcrImageFile,
} from "../lib/ocrImageExtraction.mjs";

function fakeFile({ name, type, size }) {
  return { name, type, size };
}

test("accepts PNG/JPG/WEBP within the size limit", () => {
  assert.equal(validateOcrImageFile(fakeFile({ name: "shot.png", type: "image/png", size: 1024 })).ok, true);
  assert.equal(validateOcrImageFile(fakeFile({ name: "shot.jpg", type: "image/jpeg", size: 1024 })).ok, true);
  assert.equal(validateOcrImageFile(fakeFile({ name: "shot.webp", type: "image/webp", size: 1024 })).ok, true);
});

test("rejects an unsupported file type clearly", () => {
  const result = validateOcrImageFile(fakeFile({ name: "report.pdf", type: "application/pdf", size: 1024 }));
  assert.equal(result.ok, false);
  assert.equal(result.reason, "unsupported_file");
  assert.match(result.message, /PNG|JPG|WEBP/);
});

test("rejects a file over the max size", () => {
  const result = validateOcrImageFile(
    fakeFile({ name: "shot.png", type: "image/png", size: OCR_IMAGE_MAX_BYTES + 1 })
  );
  assert.equal(result.ok, false);
  assert.equal(result.reason, "file_too_large");
});

test("rejects an empty/unreadable file", () => {
  const result = validateOcrImageFile(fakeFile({ name: "shot.png", type: "image/png", size: 0 }));
  assert.equal(result.ok, false);
  assert.equal(result.reason, "unsupported_file");
});

test("default provider honestly reports it is unavailable instead of faking success", async () => {
  const outcome = await unavailableOcrProvider(fakeFile({ name: "shot.png", type: "image/png", size: 1024 }));
  assert.equal(outcome.ok, false);
  assert.equal(outcome.reason, "provider_unavailable");
  assert.equal(typeof outcome.message, "string");
  assert.ok(outcome.message.length > 0);
});

test("backend provider maps normalized structured rows into the existing review contract", async () => {
  const provider = createBackendOcrProvider({
    tournamentId: 4,
    matchId: 9,
    fetchImpl: async (url, init) => {
      assert.match(url, /tournaments\/4\/matches\/9\/ocr\/extract/);
      assert.equal(init.method, "POST");
      assert.equal(init.headers["Content-Type"], "image/png");
      return {
        ok: true,
        json: async () => ({
          provider: "openai",
          model: "fixture-model",
          confidence: 0.87,
          warnings: ["review_crop"],
          raw_text: null,
          rows: [
            {
              raw_team_name: "Amon Reapers",
              kills: 10,
              placement: null,
              confidence: 0.7,
              warnings: ["missing_placement"],
              player_stats: [
                {
                  player_name: "VITO",
                  kills: 10,
                  damage: 2500,
                  assists: 1,
                  redeploys: 0,
                },
              ],
            },
          ],
        }),
      };
    },
  });

  const outcome = await provider(
    fakeFile({ name: "shot.png", type: "image/png", size: 1024 })
  );
  assert.equal(outcome.ok, true);
  assert.equal(outcome.result.provider, "openai");
  assert.equal(outcome.result.confidence, 0.87);
  assert.equal(outcome.result.rows[0].placement, null);
  assert.equal(outcome.result.rows[0].playerStats[0].damage, 2500);
});

test("backend unavailable response preserves the honest fallback state", async () => {
  const provider = createBackendOcrProvider({
    tournamentId: 4,
    matchId: 9,
    fetchImpl: async () => ({
      ok: false,
      status: 503,
      json: async () => ({ detail: "Proveedor no configurado." }),
    }),
  });
  const outcome = await provider(
    fakeFile({ name: "shot.png", type: "image/png", size: 1024 })
  );
  assert.equal(outcome.ok, false);
  assert.equal(outcome.reason, "provider_unavailable");
  assert.equal(outcome.message, "Proveedor no configurado.");
});

test("provider configuration is reported without claiming remote verification", async () => {
  const status = await getBackendOcrProviderStatus(async () => ({
    ok: true,
    json: async () => ({
      provider: "openai",
      model: "fixture-model",
      configured: true,
      remote_verified: false,
    }),
  }));
  assert.deepEqual(status, {
    provider: "openai",
    model: "fixture-model",
    configured: true,
    remote_verified: false,
  });
});
