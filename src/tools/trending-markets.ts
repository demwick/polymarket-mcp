import { z } from "zod";
import { fetchWithRetry } from "../utils/fetch.js";
import { log } from "../utils/logger.js";

const GAMMA_API_BASE = "https://gamma-api.polymarket.com";

export const trendingMarketsSchema = z.object({
  period: z.enum(["24h", "7d", "30d"]).optional().default("24h").describe("Volume period to rank by"),
  category: z.string().optional().describe("Filter by category slug (e.g. politics, sports, crypto, bitcoin, ethereum)"),
  limit: z.number().int().min(1).max(50).optional().default(15).describe("Maximum number of trending markets to return"),
});

// Map period → the Gamma field used for both ordering and display.
const PERIOD_FIELD: Record<"24h" | "7d" | "30d", "volume24hr" | "volume1wk" | "volume1mo"> = {
  "24h": "volume24hr",
  "7d": "volume1wk",
  "30d": "volume1mo",
};

export async function handleTrendingMarkets(input: z.infer<typeof trendingMarketsSchema>): Promise<string> {
  const volumeField = PERIOD_FIELD[input.period];

  // Gamma's /markets endpoint filters tags by numeric `tag_id`, not `tag`
  // or `tag_slug` — unknown params are silently ignored. Resolve the slug
  // to an ID via /tags/slug/<slug> first.
  let tagId: string | null = null;
  if (input.category) {
    try {
      const tagRes = await fetchWithRetry(
        `${GAMMA_API_BASE}/tags/slug/${encodeURIComponent(input.category.toLowerCase())}`,
      );
      if (tagRes.ok) {
        const tag = (await tagRes.json()) as any;
        if (tag && typeof tag.id !== "undefined") tagId = String(tag.id);
      }
    } catch (err) {
      log("warn", `Tag lookup failed for "${input.category}": ${err}`);
    }
    if (!tagId) {
      return `Unknown category "${input.category}". Try slugs like: politics, sports, crypto, bitcoin, ethereum, business, tech.`;
    }
  }

  let url = `${GAMMA_API_BASE}/markets?closed=false&order=${volumeField}&ascending=false&limit=${input.limit}`;
  if (tagId) url += `&tag_id=${tagId}&related_tags=true`;

  log("info", `Fetching trending markets: period=${input.period}, category=${input.category ?? "all"}`);

  try {
    const res = await fetchWithRetry(url);
    if (!res.ok) return "Could not fetch trending markets. Try again in a moment.";

    const markets = await res.json();
    if (!Array.isArray(markets) || markets.length === 0) {
      return `No trending markets found${input.category ? ` for "${input.category}"` : ""}. Try a different category.`;
    }

    let output = `## Trending Markets (${input.period})\n\n`;
    if (input.category) output += `Category: ${input.category}\n\n`;
    output += `| # | Market | Volume | Price | End Date |\n`;
    output += `|---|--------|--------|-------|----------|\n`;

    for (let i = 0; i < markets.length; i++) {
      const m = markets[i] as any;
      const question = (m.question ?? "").slice(0, 40);
      // Prefer the period-specific volume field; fall back to cumulative volume.
      const vol = parseFloat(m[volumeField] ?? m.volume ?? "0");
      const end = (m.endDate ?? "").slice(0, 10);

      let price = "-";
      try {
        const rawPrices = m.outcomePrices;
        if (rawPrices) {
          const parsed = typeof rawPrices === "string" ? JSON.parse(rawPrices) : rawPrices;
          if (Array.isArray(parsed)) price = "$" + parseFloat(parsed[0]).toFixed(2);
        }
      } catch {}

      output += `| ${i + 1} | ${question} | $${vol >= 1000 ? (vol / 1000).toFixed(1) + "k" : vol.toFixed(0)} | ${price} | ${end} |\n`;
    }

    return output;
  } catch (err) {
    log("error", `Trending markets failed: ${err}`);
    return "Could not reach the Polymarket API. Try again in a moment.";
  }
}
