import { z } from "zod";
import { checkMarketQuality } from "../services/market-filter.js";
import { checkLicense, requirePro } from "../utils/license.js";

export const checkMarketSchema = z.object({
  token_id: z.string(),
  max_spread: z.number().min(0).max(1).optional().describe("Max acceptable spread (default: 0.10)"),
  min_depth: z.number().min(0).optional().describe("Min $ depth per side (default: $50)"),
});

export async function handleCheckMarket(input: z.infer<typeof checkMarketSchema>): Promise<string> {
  const isPro = await checkLicense(); if (!isPro) return requirePro("check_market");
  const result = await checkMarketQuality(input.token_id, {
    maxSpread: input.max_spread,
    minDepth: input.min_depth,
  });

  const m = result.metrics;
  const verdict = result.pass ? "PASS" : "FAIL";

  let output = `## Market Quality: ${verdict}\n\n`;
  output += `| Metric | Value |\n|--------|-------|\n`;
  output += `| Spread | ${(m.spread * 100).toFixed(1)}% |\n`;
  output += `| Bid Depth | $${m.bidDepth.toFixed(0)} |\n`;
  output += `| Ask Depth | $${m.askDepth.toFixed(0)} |\n`;
  output += `| Mid Price | $${m.midPrice.toFixed(4)} |\n`;

  if (!result.pass) {
    output += `\n### Issues\n\n`;
    result.reasons.forEach((r) => { output += `- ${r}\n`; });
  }

  return output;
}
