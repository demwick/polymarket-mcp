import { z } from "zod";
import { log } from "../utils/logger.js";
import { fetchWithRetry } from "../utils/fetch.js";
import { checkLicense, requirePro } from "../utils/license.js";

const GAMMA_API_BASE = "https://gamma-api.polymarket.com";

export const discoverMarketsSchema = z.object({
  ending: z.enum(["today", "this_week", "all"]).optional().default("today").describe("Filter by resolution deadline: today, this_week, or all active markets"),
  category: z.string().optional().describe("Filter by category (e.g. politics, sports, crypto, pop-culture)"),
  min_volume: z.number().optional().default(100).describe("Minimum trading volume in USDC to include a market"),
  limit: z.number().int().min(1).max(50).optional().default(20).describe("Maximum number of markets to return"),
});

export type DiscoverMarketsInput = z.infer<typeof discoverMarketsSchema>;

export async function handleDiscoverMarkets(input: DiscoverMarketsInput): Promise<string> {
  const isPro = await checkLicense(); if (!isPro) return requirePro("discover_markets");
  const now = new Date();
  let endBefore = "";

  if (input.ending === "today") {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    endBefore = tomorrow.toISOString();
  } else if (input.ending === "this_week") {
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    endBefore = nextWeek.toISOString();
  }

  let url = `${GAMMA_API_BASE}/markets?closed=false&order=volume&ascending=false&limit=${input.limit}`;
  if (endBefore) {
    url += `&end_date_max=${endBefore}`;
  }
  if (input.category) {
    url += `&tag=${input.category}`;
  }

  log("info", `Discovering markets: ending=${input.ending}, category=${input.category ?? "all"}`);

  try {
    const res = await fetchWithRetry(url);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();

    const markets = (data as any[]).filter((m: any) => {
      const vol = parseFloat(m.volume ?? "0");
      return vol >= input.min_volume;
    });

    if (markets.length === 0) {
      return "No markets found matching criteria. Try 'this_week' or 'all' for more results.";
    }

    let output = `## Markets (${markets.length}) — ending: ${input.ending}\n\n`;
    output += `| # | Market | Condition ID | End Date | Volume | Price |\n`;
    output += `|---|--------|--------------|----------|--------|-------|\n`;

    for (let i = 0; i < markets.length; i++) {
      const m = markets[i] as any;
      const q = (m.question ?? "").slice(0, 40);
      const end = (m.endDate ?? "").slice(0, 16).replace("T", " ");
      const vol = parseFloat(m.volume ?? "0");
      const prices = m.outcomePrices ?? "";
      // Exposing conditionId here lets the agent skip a second lookup via
      // search_markets/resolveMarketByConditionId before pre-trade gating.
      const cid = (m.conditionId ?? "").slice(0, 12) + "…";
      output += `| ${i + 1} | ${q} | \`${cid}\` (${m.conditionId ?? ""}) | ${end} | $${vol.toFixed(0)} | ${prices} |\n`;
    }

    return output;
  } catch (err) {
    log("error", `Failed to discover markets: ${err}`);
    return "Could not reach the Polymarket API. This may be a temporary issue — try again in a moment.";
  }
}
