import test from "node:test";
import assert from "node:assert/strict";

import {
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
