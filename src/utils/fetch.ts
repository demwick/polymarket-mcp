import { log } from "./logger.js";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 2;
const RETRY_DELAY_MS = 1_000;

export async function fetchWithRetry(
  url: string,
  options?: RequestInit & { retries?: number; timeoutMs?: number }
): Promise<Response> {
  const retries = options?.retries ?? DEFAULT_RETRIES;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timer);
      return response;
    } catch (err: any) {
      const isLast = attempt === retries;
      const reason = err?.name === "AbortError" ? "timeout" : err?.message ?? "unknown";

      if (isLast) {
        log("error", `Fetch failed after ${retries + 1} attempts: ${url} (${reason})`);
        throw err;
      }

      log("warn", `Fetch attempt ${attempt + 1} failed: ${url} (${reason}), retrying...`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
    }
  }

  // Unreachable, but TypeScript needs it
  throw new Error("Fetch failed");
}
