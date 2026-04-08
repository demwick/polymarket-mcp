import { z } from "zod";
import { discoverWtaMarkets, type WtaMarket } from "../services/wta-discovery.js";

export const discoverWtaSchema = z.object({
  discount_pct: z.number().min(5).max(50).optional().default(30),
});

export type DiscoverWtaInput = z.infer<typeof discoverWtaSchema>;

export async function handleDiscoverWta(input: DiscoverWtaInput): Promise<string> {
  const markets = await discoverWtaMarkets(input.discount_pct);

  if (markets.length === 0) {
    return "No WTA markets found for today. Check if matches are scheduled.";
  }

  let output = `## WTA Markets (${markets.length}) — Stink Bid Targets\n\n`;
  output += `Discount: ${input.discount_pct}%\n\n`;
  output += `| # | Match | Favorite | Price | Stink Bid | Underdog | Price |\n`;
  output += `|---|-------|----------|-------|-----------|----------|-------|\n`;

  for (let i = 0; i < markets.length; i++) {
    const m = markets[i];
    output += `| ${i + 1} | ${m.question.slice(0, 35)} | ${m.favoriteOutcome.slice(0, 15)} | $${m.favoritePrice.toFixed(3)} | $${m.stinkBidPrice.toFixed(3)} | ${m.underdogOutcome.slice(0, 15)} | $${m.underdogPrice.toFixed(3)} |\n`;
  }

  output += `\nUse \`place_stink_bid\` to place limit orders on these markets.`;

  return output;
}
