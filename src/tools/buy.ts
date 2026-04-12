import { z } from "zod";
import Database from "better-sqlite3";
import { TradeExecutor, type TradeOrder } from "../services/trade-executor.js";
import { resolveMarketByConditionId, pickTokenId, pickPrice } from "../services/market-resolver.js";
import { checkMarketQuality } from "../services/market-filter.js";
import { checkLicense, requirePro } from "../utils/license.js";
import { checkSafetyLimits } from "../utils/safety.js";
import { log } from "../utils/logger.js";

export const buySchema = z.object({
  condition_id: z.string().describe("Polymarket market condition ID (hex string from market URL or API)"),
  amount: z.number().min(0.5).describe("Amount in USDC to spend"),
  price: z.number().min(0.01).max(0.99).optional().describe("Limit price (0.01-0.99). Omit for market price from order book"),
  outcome: z.enum(["YES", "NO"]).optional().default("YES").describe("Outcome to buy: YES for the event happening, NO for it not happening"),
});

export async function handleBuy(db: Database.Database, executor: TradeExecutor, input: z.infer<typeof buySchema>): Promise<string> {
  // Live mode requires Pro
  if (executor.getMode() === "live") {
    const isPro = await checkLicense();
    if (!isPro) return requirePro("buy (live mode)");
  }

  const marketInfo = await resolveMarketByConditionId(input.condition_id);
  if (!marketInfo) return "Could not resolve market. Check the condition_id is correct.";

  const tokenId = pickTokenId(marketInfo, input.outcome);

  // Market quality check runs on the token the user is actually buying.
  const quality = await checkMarketQuality(tokenId);
  if (!quality.pass) {
    return `Market quality check failed:\n${quality.reasons.map((r) => "- " + r).join("\n")}\n\nUse \`check_market\` for details or proceed with caution.`;
  }

  const safety = checkSafetyLimits(db, { amount: input.amount, conditionId: input.condition_id });
  if (!safety.pass) {
    return `Safety limit exceeded: ${safety.reason}\n\nUse \`set_safety_limits show=true\` to review limits.`;
  }

  const price = input.price ?? quality.metrics.midPrice ?? pickPrice(marketInfo, input.outcome);
  if (price <= 0) return "Could not determine market price. Provide a `price` parameter.";

  const order: TradeOrder = {
    traderAddress: "direct",
    marketSlug: marketInfo.slug,
    conditionId: input.condition_id,
    tokenId,
    price,
    amount: input.amount,
    originalAmount: input.amount,
    tickSize: marketInfo.tickSize ?? "0.01",
    negRisk: marketInfo.negRisk ?? false,
    orderSide: "BUY",
  };

  const result = await executor.execute(order);

  if (result.status === "failed") return `Buy failed: ${result.message}`;

  log("trade", `Direct BUY ${input.outcome} $${input.amount} @ $${price.toFixed(2)} on ${marketInfo.slug}`);
  return `**${result.mode === "preview" ? "Simulated" : "Executed"}** BUY ${input.outcome} $${input.amount} @ $${price.toFixed(4)} on ${marketInfo.slug}\n\nTrade ID: #${result.tradeId} | Mode: ${result.mode}`;
}
