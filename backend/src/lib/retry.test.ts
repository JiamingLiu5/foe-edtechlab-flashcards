import assert from "node:assert/strict";
import test from "node:test";
import { isRetryableAiError, withRetry } from "./retry.js";

test("classifies transient provider statuses for retry", () => {
  assert.equal(isRetryableAiError(Object.assign(new Error("unavailable"), { status: 503 })), true);
  assert.equal(isRetryableAiError(Object.assign(new Error("rate limited"), { status: 429 })), true);
  assert.equal(isRetryableAiError(Object.assign(new Error("connection failed"), { status: 0 })), true);
  assert.equal(isRetryableAiError(Object.assign(new Error("request aborted"), { name: "AbortError" })), false);
  assert.equal(isRetryableAiError(Object.assign(new Error("bad request"), { status: 400 })), false);
  assert.equal(isRetryableAiError(Object.assign(new Error("unauthorized"), { status: 401 })), false);
});

test("does not repeatedly call the provider for a non-retryable error", async () => {
  let calls = 0;
  const error = Object.assign(new Error("invalid model"), { status: 400 });

  await assert.rejects(
    withRetry(async () => {
      calls++;
      throw error;
    }),
    error
  );

  assert.equal(calls, 1);
});

test("retries a transient provider failure", async () => {
  const originalSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = ((callback: () => void) => {
    callback();
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;

  try {
    let calls = 0;
    const result = await withRetry(async () => {
      calls++;
      if (calls === 1) throw Object.assign(new Error("service unavailable"), { status: 503 });
      return "recovered";
    });

    assert.equal(result, "recovered");
    assert.equal(calls, 2);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }
});
