import { z } from "zod";
import { fetchWithRetry } from "../utils/fetch.js";
import { log } from "../utils/logger.js";

const GAMMA_API_BASE = "https://gamma-api.polymarket.com";

export const searchMarketsSchema = z.object({
  query: z.string().min(1).describe("Search query (e.g. 'bitcoin', 'election', 'UFC')"),
  limit: z.number().int().min(1).max(50).optional().default(10).describe("Maximum number of markets to return"),
  active_only: z.boolean().optional().default(true).describe("Only return active (non-resolved) markets"),
});

export async function handleSearchMarkets(input: z.infer<typeof searchMarketsSchema>): Promise<string> {
  const encoded = encodeURIComponent(input.query);
  // Gamma's /markets endpoint does not support free-text search (it silently
  // ignores unknown params like `q`/`_q`). The dedicated search endpoint is
  // /public-search, which returns events containing nested markets.
  let url = `${GAMMA_API_BASE}/public-search?q=${encoded}&limit_per_type=${input.limit}`;
  if (input.active_only) url += `&events_status=active`;

  log("info", `Searching markets: "${input.query}" (limit=${input.limit})`);

  try {
    const res = await fetchWithRetry(url);
    if (!res.ok) return "Market search unavailable. Try again in a moment.";

    const data = (await res.json()) as any;
    const events = Array.isArray(data?.events) ? data.events : [];

    // Flatten nested markets from each event
    const flattened: any[] = [];
    for (const ev of events) {
      const markets = Array.isArray(ev?.markets) ? ev.markets : [];
      for (const m of markets) {
        if (input.active_only && m?.closed) continue;
        flattened.push(m);
      }
    }

    if (flattened.length === 0) {
      return `No markets found for "${input.query}". Try a different search term.`;
    }

    // Sort by volume (desc) and cap at requested limit
    flattened.sort((a, b) => parseFloat(b?.volume ?? "0") - parseFloat(a?.volume ?? "0"));
    const markets = flattened.slice(0, input.limit);

    let output = `## Markets matching "${input.query}" (${markets.length})\n\n`;
    output += "| # | Market | Volume | End Date | Condition ID |\n";
    output += "|---|--------|--------|----------|--------------|\n";

    for (let i = 0; i < markets.length; i++) {
      const m = markets[i];
      const question = (m.question ?? "").slice(0, 45);
      const vol = parseFloat(m.volume ?? "0");
      const end = (m.endDate ?? "").slice(0, 10);
      const condId = m.conditionId ?? "-";

      output += `| ${i + 1} | ${question} | $${vol.toFixed(0)} | ${end} | \`${condId}\` |\n`;
    }

    output += `\nUse \`get_price\` with a condition_id for live prices, or \`buy\` to trade.`;
    return output;
  } catch (err) {
    log("error", `Market search failed: ${err}`);
    return "Could not reach the Polymarket API. Try again in a moment.";
  }
}
