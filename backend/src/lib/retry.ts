const MAX_AI_ATTEMPTS = 5;
const INITIAL_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 15_000;

type ErrorWithStatus = Error & { status?: unknown };

/** Whether an AI-provider error is likely to succeed on a later attempt. */
export function isRetryableAiError(error: unknown): boolean {
  if (!error || typeof error !== "object") return true;

  const status = (error as ErrorWithStatus).status;
  // SDK and parsing errors without an HTTP status are retried: model output can
  // be malformed on one request, and connection errors typically have no status.
  if (typeof status !== "number") return true;

  return status === 0 || status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function retryDelay(attempt: number): number {
  const exponentialDelay = Math.min(MAX_RETRY_DELAY_MS, INITIAL_RETRY_DELAY_MS * 2 ** (attempt - 1));
  // Spread simultaneous worker retries out after a provider outage.
  return Math.round(exponentialDelay * (0.75 + Math.random() * 0.5));
}

/**
 * Retries transient AI failures with capped exponential backoff.  Invalid
 * requests (for example, a bad API key or model name) fail immediately.
 */
export async function withRetry<T>(fn: () => Promise<T>, maxAttempts = MAX_AI_ATTEMPTS): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const retryable = isRetryableAiError(err);
      console.warn(
        `[ai] attempt ${attempt}/${maxAttempts} failed${retryable ? "; retrying if attempts remain" : "; not retryable"}: ${err instanceof Error ? err.message : String(err)}`
      );
      if (!retryable || attempt === maxAttempts) break;

      const delay = retryDelay(attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
