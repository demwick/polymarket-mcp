import { z } from "zod";
import Database from "better-sqlite3";
import { TradeExecutor } from "../services/trade-executor.js";
import { discoverWtaMarkets } from "../services/wta-discovery.js";
import { hasExistingPosition, recordTrade } from "../db/queries.js";
import { checkLicense, requirePro } from "../utils/license.js";
import { log } from "../utils/logger.js";

export const placeStinkBidSchema = z.object({
  discount_pct: z.number().min(5).max(50).optional().default(30),
  bet_size: z.number().min(1).max(50).optional().default(5),
});

export type PlaceStinkBidInput = z.infer<typeof placeStinkBidSchema>;

export async function handlePlaceStinkBid(
  db: Database.Database,
  executor: TradeExecutor,
  input: PlaceStinkBidInput
): Promise<string> {
  const isPro = await checkLicense();
  if (!isPro) return requirePro("place_stink_bid");

  const markets = await discoverWtaMarkets(input.discount_pct);

  if (markets.length === 0) {
    return "No WTA markets found for stink bids today.";
  }

  let placed = 0;
  let skipped = 0;
  let output = `## Stink Bid Results\n\nDiscount: ${input.discount_pct}% | Bet size: $${input.bet_size}\n\n`;

  for (const market of markets) {
    // Skip if we already have a position
    if (hasExistingPosition(db, market.conditionId)) {
      output += `- **${market.question}**: Skipped (existing position)\n`;
      skipped++;
      continue;
    }

    // Place limit order on favorite at stink bid price
    const result = await executor.execute({
      traderAddress: "stink-bid-bot",
      marketSlug: market.slug,
      conditionId: market.conditionId,
      tokenId: market.favoriteTokenId,
      price: market.stinkBidPrice,
      amount: input.bet_size,
      originalAmount: input.bet_size,
      tickSize: market.tickSize,
      negRisk: market.negRisk,
      orderType: "GTC",
    });

    if (result.status !== "failed") {
      output += `- **${market.question}**: Bid placed @ $${market.stinkBidPrice.toFixed(3)} on ${market.favoriteOutcome} (was $${market.favoritePrice.toFixed(3)})\n`;
      placed++;
    } else {
      output += `- **${market.question}**: Failed — ${result.message}\n`;
    }
  }

  output += `\n**Summary:** ${placed} bids placed, ${skipped} skipped, ${markets.length - placed - skipped} failed`;

  log("trade", `Stink bids: ${placed} placed, ${skipped} skipped`);
  return output;
}
