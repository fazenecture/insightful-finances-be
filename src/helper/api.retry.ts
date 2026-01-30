import { setTimeout as sleep } from "timers/promises";
import logger from "./logger";

type RateLimitContext = {
  attempt: number;
  waitMs: number;
  retryAfterMs?: number;
  resetTokensMs?: number;
  remainingTokens?: number;
  limitTokens?: number;
  remainingRequests?: number;
  limitRequests?: number;
};

/**
 * Parse x-ratelimit-reset-tokens header
 * Examples:
 *  - "6m0s"
 *  - "2m13.008s"
 */
const parseResetTokensMs = (value?: string | null): number | null => {
  if (!value) return null;

  const match = value.match(/(?:(\d+)m)?([\d.]+)s/);
  if (!match) return null;

  const minutes = Number(match[1] || 0);
  const seconds = Number(match[2] || 0);

  return (minutes * 60 + seconds) * 1000;
};

const jitter = (ms: number) =>
  ms + Math.floor(Math.random() * Math.min(1000, ms * 0.1));

/**
 * 🔒 Global lock to serialize OpenAI calls
 * Prevents concurrent TPM drain
 */
let openAIExecutionLock: Promise<void> = Promise.resolve();

/**
 * Incremental backoff controller
 */
const nextBackoff = (current: number) =>
  Math.min(current * 2, 5 * 60 * 1000); // cap at 5 mins

export const callWithRateLimitRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries = 8
): Promise<T> => {
  let attempt = 0;
  let backoffMs = 1_000;

  const execute = async (): Promise<T> => {
    while (true) {
      try {
        return await fn();
      } catch (err: any) {
        if (err?.status !== 429) {
          console.error("[OpenAI] Non-rate-limit error", err);
          throw err;
        }

        attempt++;
        if (attempt > maxRetries) {
          console.error(
            `[OpenAI] Rate limit retries exhausted after ${maxRetries} attempts`
          );
          throw err;
        }

        const headers = err.headers;

        const retryAfterMs =
          Number(headers?.get?.("retry-after-ms")) || undefined;

        const resetTokensMs = parseResetTokensMs(
          headers?.get?.("x-ratelimit-reset-tokens")
        );

        const remainingTokens = Number(
          headers?.get?.("x-ratelimit-remaining-tokens")
        );
        const limitTokens = Number(
          headers?.get?.("x-ratelimit-limit-tokens")
        );

        const remainingRequests = Number(
          headers?.get?.("x-ratelimit-remaining-requests")
        );
        const limitRequests = Number(
          headers?.get?.("x-ratelimit-limit-requests")
        );

        /**
         * Decide primary bottleneck
         */
        const isTokenLimited =
          remainingTokens === 0 || resetTokensMs != null;

        const baseWaitMs = Math.max(
          retryAfterMs ?? 0,
          resetTokensMs ?? 0,
          backoffMs
        );

        const waitMs = jitter(baseWaitMs);

        const context: RateLimitContext = {
          attempt,
          waitMs,
          retryAfterMs,
          resetTokensMs: resetTokensMs || undefined,
          remainingTokens,
          limitTokens,
          remainingRequests,
          limitRequests,
        };

        console.warn("[OpenAI] Rate limited — backing off", context);

        await sleep(waitMs);

        /**
         * Incremental rate limiting:
         * If token-limited, slow down more aggressively
         */
        backoffMs = isTokenLimited
          ? nextBackoff(backoffMs)
          : Math.min(backoffMs * 1.5, 60_000);
      }
    }
  };

  /**
   * Serialize OpenAI calls
   */
  const previous = openAIExecutionLock;
  let release!: () => void;

  openAIExecutionLock = new Promise<void>((res) => (release = res));

  try {
    await previous;

    logger.info("[OpenAI] Executing request with rate-limit guard");

    const result = await execute();

    logger.info("[OpenAI] Request succeeded");

    return result;
  } finally {
    release();
  }
};
