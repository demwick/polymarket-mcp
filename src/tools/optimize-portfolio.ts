import { z } from "zod";
import Database from "better-sqlite3";
import { getOpenPositions, getTradeStats } from "../db/queries.js";
import { getMarketPriceByCondition } from "../services/price-service.js";
import { log } from "../utils/logger.js";

export const optimizePortfolioSchema = z.object({
  strategy: z.enum(["conservative", "balanced", "aggressive"]).optional().default("balanced"),
});

export async function handleOptimizePortfolio(db: Database.Database, input: z.infer<typeof optimizePortfolioSchema>): Promise<string> {
  const positions = getOpenPositions(db);
  const stats = getTradeStats(db);

  if (positions.length === 0) {
    return "No open positions to optimize.";
  }

  log("info", `Portfolio optimization: strategy=${input.strategy}, positions=${positions.length}`);

  const thresholds = {
    conservative: { maxConcentration: 20, minDiversity: 5, slBuffer: 0.15, tpTarget: 0.10 },
    balanced: { maxConcentration: 30, minDiversity: 3, slBuffer: 0.20, tpTarget: 0.20 },
    aggressive: { maxConcentration: 50, minDiversity: 2, slBuffer: 0.30, tpTarget: 0.40 },
  }[input.strategy];

  const totalInvested = positions.reduce((sum, p) => sum + p.amount, 0);
  const uniqueMarkets = new Set(positions.map((p) => p.condition_id)).size;
  const recommendations: string[] = [];

  // Analyze each position
  const posAnalysis = await Promise.all(positions.map(async (p) => {
    const priceInfo = await getMarketPriceByCondition(p.condition_id!);
    const currentPrice = priceInfo?.price ?? p.price;
    const pnlPct = p.price > 0 ? ((currentPrice - p.price) / p.price) * 100 : 0;
    const concentrationPct = totalInvested > 0 ? (p.amount / totalInvested) * 100 : 0;
    const hasSl = p.sl_price != null;
    const hasTp = p.tp_price != null;

    return { ...p, currentPrice, pnlPct, concentrationPct, hasSl, hasTp };
  }));

  // Concentration recommendations
  const overConcentrated = posAnalysis.filter((p) => p.concentrationPct > thresholds.maxConcentration);
  for (const p of overConcentrated) {
    recommendations.push(`REDUCE #${p.id} (${(p.market_slug ?? "").slice(0, 20)}) — ${p.concentrationPct.toFixed(0)}% of portfolio exceeds ${thresholds.maxConcentration}% limit`);
  }

  // Diversification
  if (uniqueMarkets < thresholds.minDiversity && positions.length >= thresholds.minDiversity) {
    recommendations.push(`DIVERSIFY — only ${uniqueMarkets} unique markets, aim for ${thresholds.minDiversity}+`);
  }

  // SL/TP recommendations
  const unprotected = posAnalysis.filter((p) => !p.hasSl);
  if (unprotected.length > 0) {
    for (const p of unprotected) {
      const slPrice = Math.max(0.01, p.price * (1 - thresholds.slBuffer));
      recommendations.push(`SET SL on #${p.id} (${(p.market_slug ?? "").slice(0, 20)}) — suggest $${slPrice.toFixed(2)} (${(thresholds.slBuffer * 100).toFixed(0)}% below entry)`);
    }
  }

  const noTp = posAnalysis.filter((p) => !p.hasTp);
  for (const p of noTp) {
    const tpPrice = Math.min(0.99, p.price * (1 + thresholds.tpTarget));
    recommendations.push(`SET TP on #${p.id} (${(p.market_slug ?? "").slice(0, 20)}) — suggest $${tpPrice.toFixed(2)} (${(thresholds.tpTarget * 100).toFixed(0)}% above entry)`);
  }

  // Losers to cut
  const bigLosers = posAnalysis.filter((p) => p.pnlPct < -20);
  for (const p of bigLosers) {
    recommendations.push(`CLOSE #${p.id} (${(p.market_slug ?? "").slice(0, 20)}) — down ${p.pnlPct.toFixed(1)}%, consider cutting losses`);
  }

  // Winners to take profit
  const bigWinners = posAnalysis.filter((p) => p.pnlPct > 30 && !p.hasTp);
  for (const p of bigWinners) {
    recommendations.push(`TAKE PROFIT #${p.id} (${(p.market_slug ?? "").slice(0, 20)}) — up ${p.pnlPct.toFixed(1)}%, consider securing gains`);
  }

  let output = `## Portfolio Optimization — ${input.strategy.toUpperCase()}\n\n`;

  output += `| Position | Entry | Current | P&L | Weight | SL | TP |\n`;
  output += `|----------|-------|---------|-----|--------|----|----|`;
  output += `\n`;

  for (const p of posAnalysis) {
    const name = (p.market_slug ?? "").slice(0, 20);
    const pnlStr = p.pnlPct >= 0 ? `+${p.pnlPct.toFixed(1)}%` : `${p.pnlPct.toFixed(1)}%`;
    output += `| ${name} | $${p.price.toFixed(2)} | $${p.currentPrice.toFixed(2)} | ${pnlStr} | ${p.concentrationPct.toFixed(0)}% | ${p.hasSl ? "set" : "none"} | ${p.hasTp ? "set" : "none"} |\n`;
  }

  if (recommendations.length > 0) {
    output += `\n### Recommendations (${recommendations.length})\n\n`;
    for (const r of recommendations) output += `- ${r}\n`;
  } else {
    output += `\nPortfolio looks well-optimized for ${input.strategy} strategy.\n`;
  }

  return output;
}
