import { z } from "zod";
import { getMarketPriceByCondition } from "../services/price-service.js";
import { getMarketPrice } from "../services/price-service.js";
import Database from "better-sqlite3";
import { getOpenPositions } from "../db/queries.js";

export const getPriceSchema = z.object({
  condition_id: z.string().optional(),
  show_positions: z.boolean().optional().default(false),
});

export async function handleGetPrice(db: Database.Database, input: z.infer<typeof getPriceSchema>): Promise<string> {
  if (input.condition_id) {
    const info = await getMarketPriceByCondition(input.condition_id);
    if (!info) return "Could not fetch price for this market. Verify the condition_id is correct, or the market may have been resolved.";

    const price = await getMarketPrice(info.tokenId);
    if (!price) return `Market price: $${info.price.toFixed(4)} (from gamma API)`;

    return `## Market Price\n\n| Metric | Value |\n|--------|-------|\n| Bid | $${price.bid.toFixed(4)} |\n| Ask | $${price.ask.toFixed(4)} |\n| Mid | $${price.mid.toFixed(4)} |\n| Spread | $${price.spread.toFixed(4)} |`;
  }

  if (input.show_positions) {
    const positions = getOpenPositions(db);
    if (positions.length === 0) return "No open positions.";

    let output = "## Position Prices\n\n| # | Market | Entry | Current | P&L | Change |\n|---|--------|-------|---------|-----|--------|\n";

    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      const info = await getMarketPriceByCondition(p.condition_id!);
      const currentPrice = info?.price ?? 0;
      const pnl = p.price > 0 ? ((currentPrice - p.price) * p.amount) / p.price : 0;
      const change = p.price > 0 ? ((currentPrice - p.price) / p.price * 100) : 0;
      const changeStr = change >= 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
      output += `| ${i + 1} | ${(p.market_slug ?? "-").slice(0, 25)} | $${p.price.toFixed(2)} | $${currentPrice.toFixed(2)} | $${pnl.toFixed(2)} | ${changeStr} |\n`;
    }

    return output;
  }

  return "Please provide a `condition_id` to check a specific market, or set `show_positions=true` to see prices for all your open positions.";
}
