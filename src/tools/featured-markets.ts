import { z } from "zod";
import { fetchWithRetry } from "../utils/fetch.js";
import { log } from "../utils/logger.js";

const GAMMA_API_BASE = "https://gamma-api.polymarket.com";

export const featuredMarketsSchema = z.object({
  category: z.enum(["politics", "sports", "crypto", "pop-culture", "business", "science"]).optional().describe("Filter by category"),
  limit: z.number().int().min(1).max(30).optional().default(15),
});

export async function handleFeaturedMarkets(input: z.infer<typeof featuredMarketsSchema>): Promise<string> {
  let url = `${GAMMA_API_BASE}/markets?closed=false&order=liquidity&ascending=false&limit=${input.limit}`;
  if (input.category) url += `&tag=${input.category}`;

  log("info", `Fetching featured markets: category=${input.category ?? "all"}`);

  try {
    const res = await fetchWithRetry(url);
    if (!res.ok) return "Could not fetch markets. Try again in a moment.";

    const markets = await res.json();
    if (!Array.isArray(markets) || markets.length === 0) {
      return `No markets found${input.category ? ` for "${input.category}"` : ""}. Try a different category.`;
    }

    const categoryLabel = input.category ? input.category.charAt(0).toUpperCase() + input.category.slice(1) : "All";
    let output = `## Featured Markets — ${categoryLabel} (${markets.length})\n\n`;
    output += `Sorted by liquidity (most liquid first).\n\n`;
    output += `| # | Market | Liquidity | Volume | Price | End |\n`;
    output += `|---|--------|-----------|--------|-------|-----|\n`;

    for (let i = 0; i < markets.length; i++) {
      const m = markets[i] as any;
      const question = (m.question ?? "").slice(0, 35);
      const liq = parseFloat(m.liquidity ?? "0");
      const vol = parseFloat(m.volume ?? "0");
      const end = (m.endDate ?? "").slice(0, 10);

      let price = "-";
      try {
        const rawPrices = m.outcomePrices;
        if (rawPrices) {
          const parsed = typeof rawPrices === "string" ? JSON.parse(rawPrices) : rawPrices;
          if (Array.isArray(parsed)) price = "$" + parseFloat(parsed[0]).toFixed(2);
        }
      } catch {}

      const fmtNum = (n: number) => n >= 1000 ? (n / 1000).toFixed(1) + "k" : n.toFixed(0);

      output += `| ${i + 1} | ${question} | $${fmtNum(liq)} | $${fmtNum(vol)} | ${price} | ${end} |\n`;
    }

    return output;
  } catch (err) {
    log("error", `Featured markets failed: ${err}`);
    return "Could not reach the Polymarket API. Try again in a moment.";
  }
}
