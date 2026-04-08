import { z } from "zod";
import Database from "better-sqlite3";
import { TradeExecutor, type TradeOrder } from "../services/trade-executor.js";
import { resolveMarketByConditionId } from "../services/market-resolver.js";
import { checkMarketQuality } from "../services/market-filter.js";
import { log } from "../utils/logger.js";

export const buySchema = z.object({
  condition_id: z.string(),
  amount: z.number().min(0.5).describe("Amount in USDC to spend"),
  price: z.number().min(0.01).max(0.99).optional().describe("Limit price (omit for market price from order book)"),
  outcome: z.enum(["YES", "NO"]).optional().default("YES"),
});

export async function handleBuy(db: Database.Database, executor: TradeExecutor, input: z.infer<typeof buySchema>): Promise<string> {
  const marketInfo = await resolveMarketByConditionId(input.condition_id);
  if (!marketInfo) return "Could not resolve market. Check the condition_id is correct.";

  // Market quality check
  const quality = await checkMarketQuality(marketInfo.tokenId);
  if (!quality.pass) {
    return `Market quality check failed:\n${quality.reasons.map((r) => "- " + r).join("\n")}\n\nUse \`check_market\` for details or proceed with caution.`;
  }

  const price = input.price ?? quality.metrics.midPrice;
  if (price <= 0) return "Could not determine market price. Provide a `price` parameter.";

  const order: TradeOrder = {
    traderAddress: "direct",
    marketSlug: marketInfo.slug,
    conditionId: input.condition_id,
    tokenId: marketInfo.tokenId,
    price,
    amount: input.amount,
    originalAmount: input.amount,
    tickSize: marketInfo.tickSize ?? "0.01",
    negRisk: marketInfo.negRisk ?? false,
    orderSide: "BUY",
  };

  const result = await executor.execute(order);

  if (result.status === "failed") return `Buy failed: ${result.message}`;

  log("trade", `Direct BUY $${input.amount} @ $${price.toFixed(2)} on ${marketInfo.slug}`);
  return `**${result.mode === "preview" ? "Simulated" : "Executed"}** BUY $${input.amount} @ $${price.toFixed(4)} on ${marketInfo.slug}\n\nTrade ID: #${result.tradeId} | Mode: ${result.mode}`;
}
