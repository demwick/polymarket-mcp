import { z } from "zod";
import Database from "better-sqlite3";
import { updateTradeExit } from "../db/queries.js";
import { checkLicense, requirePro } from "../utils/license.js";
import { log } from "../utils/logger.js";

export const closePositionSchema = z.object({
  trade_id: z.number().int(),
  reason: z.string().optional().default("manual"),
});

export async function handleClosePosition(db: Database.Database, input: z.infer<typeof closePositionSchema>): Promise<string> {
  const isPro = await checkLicense();
  if (!isPro) return requirePro("close_position");

  const trade = db.prepare("SELECT * FROM trades WHERE id = ? AND status IN ('simulated', 'executed')").get(input.trade_id) as any;

  if (!trade) {
    return `No open position found with ID ${input.trade_id}. Use \`get_positions\` to see your open positions and their IDs.`;
  }

  // Get current market price for P&L calculation
  const { getMarketPriceByCondition } = await import("../services/price-service.js");
  const priceInfo = await getMarketPriceByCondition(trade.condition_id);
  const exitPrice = priceInfo?.price ?? trade.price;
  const pnl = trade.price > 0 ? ((exitPrice - trade.price) * trade.amount) / trade.price : 0;

  updateTradeExit(db, input.trade_id, exitPrice, input.reason, pnl);

  log("trade", `Position #${input.trade_id} closed manually: ${trade.market_slug}`);

  return `Position #${input.trade_id} closed (${trade.market_slug}). Exit reason: ${input.reason}`;
}
