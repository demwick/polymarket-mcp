import { z } from "zod";
import { backtestTrader } from "../services/backtester.js";
import { checkLicense, requirePro } from "../utils/license.js";

export const backtestTraderSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid Ethereum address (0x + 40 hex chars)").describe("Ethereum wallet address of the trader to backtest"),
  copy_budget: z.number().min(1).max(100).optional().default(5).describe("Simulated $ amount per trade (default: $5)"),
});

export async function handleBacktestTrader(input: z.infer<typeof backtestTraderSchema>): Promise<string> {
  const isPro = await checkLicense();
  if (!isPro) return requirePro("backtest_trader");

  const result = await backtestTrader(input.address, input.copy_budget);
  const s = result.summary;

  let output = `## Backtest: ${input.address.slice(0, 8)}..${input.address.slice(-4)}\n\n`;
  output += `**Period:** ${result.period} | **Copy Budget:** $${input.copy_budget}/trade\n\n`;

  output += `| Metric | Value |\n|--------|-------|\n`;
  output += `| Total Trades | ${s.totalTrades} |\n`;
  output += `| Wins / Losses / Open | ${s.wins} / ${s.losses} / ${s.open} |\n`;
  output += `| Win Rate | ${s.winRate.toFixed(1)}% |\n`;
  output += `| Simulated P&L | $${s.simulatedCopyPnl.toFixed(2)} |\n`;
  output += `| Avg P&L/Trade | $${s.avgPnl.toFixed(2)} |\n`;
  output += `| Best Trade | $${s.bestTrade.toFixed(2)} |\n`;
  output += `| Worst Trade | $${s.worstTrade.toFixed(2)} |\n`;

  if (result.trades.length > 0) {
    output += `\n### Trade Details\n\n`;
    output += `| # | Market | Entry | Exit | P&L | Status |\n|---|--------|-------|------|-----|--------|\n`;

    for (let i = 0; i < Math.min(result.trades.length, 15); i++) {
      const t = result.trades[i];
      const exit = t.exitPrice !== null ? `$${t.exitPrice.toFixed(2)}` : "open";
      const pnlStr = t.pnl >= 0 ? `+$${t.pnl.toFixed(2)}` : `-$${Math.abs(t.pnl).toFixed(2)}`;
      output += `| ${i + 1} | ${t.title.slice(0, 30)} | $${t.entryPrice.toFixed(2)} | ${exit} | ${pnlStr} | ${t.status} |\n`;
    }

    if (result.trades.length > 15) {
      output += `\n_...and ${result.trades.length - 15} more trades_\n`;
    }
  }

  return output;
}
