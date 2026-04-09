import { z } from "zod";
import { analyzeTrader } from "../services/trader-analyzer.js";
import { checkLicense } from "../utils/license.js";

export const analyzeTraderSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid Ethereum address (0x + 40 hex chars)").describe("Trader's Ethereum wallet address (0x...) to analyze"),
});

export async function handleAnalyzeTrader(input: z.infer<typeof analyzeTraderSchema>): Promise<string> {
  const isPro = await checkLicense();
  const profile = await analyzeTrader(input.address, isPro);

  let output = `## Trader Analysis: ${input.address.slice(0, 6)}...${input.address.slice(-4)}\n\n`;
  output += `| Metric | Value |\n|--------|-------|\n`;
  output += `| Active Positions | ${profile.activePositions} |\n`;
  output += `| Win Rate | ${profile.winRate.toFixed(1)}% |\n`;
  output += `| Avg Position Size | $${profile.avgPositionSize.toFixed(2)} |\n`;

  if (isPro && profile.recentTrades.length > 0) {
    output += `\n### Recent Trades\n\n`;
    output += `| Time | Market | Side | Size | Price |\n|------|--------|------|------|-------|\n`;
    for (const t of profile.recentTrades) {
      const time = t.timestamp?.split("T")[1]?.slice(0, 5) ?? "-";
      output += `| ${time} | ${t.title.slice(0, 30)} | ${t.side} | ${t.size.toFixed(2)} | $${t.price.toFixed(2)} |\n`;
    }
  } else if (!isPro) {
    output += `\n_Upgrade to Pro for detailed trade history._\n`;
  }

  return output;
}
