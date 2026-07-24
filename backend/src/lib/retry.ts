const MAX_AI_ATTEMPTS = 5;
const RETRY_DELAY_MS = 500;

/** Retries an AI call up to maxAttempts times when it throws — covers both malformed/unparseable model output and transient API errors. */
export async function withRetry<T>(fn: () => Promise<T>, maxAttempts = MAX_AI_ATTEMPTS): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.warn(
        `[ai] attempt ${attempt}/${maxAttempts} failed: ${err instanceof Error ? err.message : String(err)}`
      );
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
      }
    }
  }
  throw lastError;
}
