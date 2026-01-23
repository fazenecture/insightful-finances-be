import logger from "./logger";

export const callWithRateLimitRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries = 3,
): Promise<T> => {
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      if (err?.status === 429 && attempt < maxRetries) {
        const retryAfterMs =
          Number(err?.headers?.get?.("retry-after-ms")) || 20000;
          
        logger.warn(`Rate limited. Retrying after ${retryAfterMs}ms...`);

        await sleep(retryAfterMs);
        attempt++;
        continue;
      }

      throw err;
    }
  }
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
