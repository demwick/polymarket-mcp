import { z } from "zod";
import Database from "better-sqlite3";
import { TradeExecutor } from "../services/trade-executor.js";
import { getOpenPositions } from "../db/queries.js";
import { log } from "../utils/logger.js";

export const sellSchema = z.object({
  trade_id: z.number().int().optional().describe("Trade ID to sell (from get_positions)"),
  condition_id: z.string().optional().describe("Condition ID to sell (finds matching open position)"),
  price: z.number().min(0.01).max(0.99).optional().describe("Limit price (omit for current market price)"),
});

export async function handleSell(db: Database.Database, executor: TradeExecutor, input: z.infer<typeof sellSchema>): Promise<string> {
  if (!input.trade_id && !input.condition_id) {
    return "Provide either `trade_id` or `condition_id` to sell a position. Use `get_positions` to see your open positions.";
  }

  // Find the position
  let position: any;
  if (input.trade_id) {
    position = db.prepare("SELECT * FROM trades WHERE id = ? AND status IN ('simulated', 'executed')").get(input.trade_id);
  } else {
    position = db.prepare("SELECT * FROM trades WHERE condition_id = ? AND status IN ('simulated', 'executed') LIMIT 1").get(input.condition_id);
  }

  if (!position) {
    return `No open position found. Use \`get_positions\` to see your open positions and their IDs.`;
  }

  const sellPrice = input.price ?? position.price; // default to entry price if no price given

  const result = await executor.executeSell({
    traderAddress: position.trader_address,
    marketSlug: position.market_slug,
    conditionId: position.condition_id,
    tokenId: position.token_id,
    price: sellPrice,
    amount: position.amount,
    originalAmount: position.original_amount,
    tickSize: "0.01",
    negRisk: false,
  });

  if (result.status === "failed") return `Sell failed: ${result.message}`;

  log("trade", `Direct SELL $${position.amount} @ $${sellPrice.toFixed(2)} on ${position.market_slug}`);
  return `**${result.mode === "preview" ? "Simulated" : "Executed"}** SELL $${position.amount} @ $${sellPrice.toFixed(4)} on ${position.market_slug}\n\nTrade ID: #${result.tradeId} | Mode: ${result.mode}`;
}
