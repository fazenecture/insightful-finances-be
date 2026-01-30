import { setTimeout as sleep } from "timers/promises";
import logger from "./logger";

/**
 * Simple semaphore to limit concurrency
 */
class Semaphore {
  private queue: (() => void)[] = [];
  private permits: number;

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<() => void> {
    if (this.permits > 0) {
      this.permits--;
      return () => this.release();
    }

    return new Promise((resolve) => {
      this.queue.push(() => {
        this.permits--;
        resolve(() => this.release());
      });
    });
  }

  private release() {
    this.permits++;
    const next = this.queue.shift();
    if (next) next();
  }
}

/**
 * Allow LIMITED parallelism (important)
 * 2–3 is ideal for GPT-4.1
 */
const openAISemaphore = new Semaphore(2);

/**
 * Parse "2m13.008s" → ms
 */
const parseResetTokensMs = (value?: string | null): number | null => {
  if (!value) return null;
  const match = value.match(/(?:(\d+)m)?([\d.]+)s/);
  if (!match) return null;

  return (
    (Number(match[1] || 0) * 60 + Number(match[2])) * 1000
  );
};

const jitter = (ms: number) =>
  ms + Math.floor(Math.random() * Math.min(1000, ms * 0.1));

export const callWithRateLimitRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries = 6
): Promise<T> => {
  const release = await openAISemaphore.acquire();

  let attempt = 0;
  let backoffMs = 1_000;

  try {
    while (true) {
      try {
        logger.info(`Attempt ${attempt + 1} - Executing request`);
        return await fn();
      } catch (err: any) {
        if (err?.status !== 429) {
          logger.error("[OpenAI] Non-rate-limit error", err);
          throw err;
        }

        attempt++;
        if (attempt > maxRetries) {
          logger.error(
            `[OpenAI] Rate limit retries exhausted (${maxRetries})`
          );
          throw err;
        }

        const headers = err.headers;

        const retryAfterMs =
          Number(headers?.get?.("retry-after-ms")) || 0;

        const resetTokensMs = parseResetTokensMs(
          headers?.get?.("x-ratelimit-reset-tokens")
        );

        const remainingTokens = Number(
          headers?.get?.("x-ratelimit-remaining-tokens")
        );

        /**
         * Only treat as token-limited if tokens are actually zero
         */
        const isTokenLimited = remainingTokens === 0;

        const baseWaitMs = Math.max(
          retryAfterMs,
          resetTokensMs ?? 0,
          backoffMs
        );

        /**
         * Hard safety cap: never sleep more than 90s
         * Prevents system stall
         */
        const waitMs = jitter(Math.min(baseWaitMs, 90_000));

        logger.warn(
          `[OpenAI] Rate limit hit. Retry #${attempt} in ${Math.round(
            waitMs
          )}ms (retryAfterMs: ${retryAfterMs}, resetTokensMs: ${resetTokensMs}, remainingTokens: ${remainingTokens})`
        );

        await sleep(waitMs);

        backoffMs = isTokenLimited
          ? Math.min(backoffMs * 2, 60_000)
          : Math.min(backoffMs * 1.5, 30_000);
      }
    }
  } finally {
    release();
    logger.debug("[OpenAI] Semaphore released");
  }
};
