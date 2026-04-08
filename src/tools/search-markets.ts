import { z } from "zod";
import { fetchWithRetry } from "../utils/fetch.js";
import { log } from "../utils/logger.js";

const GAMMA_API_BASE = "https://gamma-api.polymarket.com";

export const searchMarketsSchema = z.object({
  query: z.string().min(1).describe("Search query (e.g. 'bitcoin', 'election', 'UFC')"),
  limit: z.number().int().min(1).max(50).optional().default(10),
  active_only: z.boolean().optional().default(true),
});

export async function handleSearchMarkets(input: z.infer<typeof searchMarketsSchema>): Promise<string> {
  const encoded = encodeURIComponent(input.query);
  const closed = input.active_only ? "false" : "";
  let url = `${GAMMA_API_BASE}/markets?_q=${encoded}&limit=${input.limit}&order=volume&ascending=false`;
  if (closed) url += `&closed=${closed}`;

  log("info", `Searching markets: "${input.query}" (limit=${input.limit})`);

  try {
    const res = await fetchWithRetry(url);
    if (!res.ok) return "Market search unavailable. Try again in a moment.";

    const markets = await res.json();
    if (!Array.isArray(markets) || markets.length === 0) {
      return `No markets found for "${input.query}". Try a different search term.`;
    }

    let output = `## Markets matching "${input.query}" (${markets.length})\n\n`;
    output += "| # | Market | Volume | End Date | Condition ID |\n";
    output += "|---|--------|--------|----------|--------------|\n";

    for (let i = 0; i < markets.length; i++) {
      const m = markets[i] as any;
      const question = (m.question ?? "").slice(0, 45);
      const vol = parseFloat(m.volume ?? "0");
      const end = (m.endDate ?? "").slice(0, 10);
      const condId = m.conditionId ?? "-";

      output += `| ${i + 1} | ${question} | $${vol.toFixed(0)} | ${end} | ${condId.slice(0, 12)}... |\n`;
    }

    output += `\nUse \`get_price\` with a condition_id for live prices, or \`buy\` to trade.`;
    return output;
  } catch (err) {
    log("error", `Market search failed: ${err}`);
    return "Could not reach the Polymarket API. Try again in a moment.";
  }
}
