import { z } from "zod";
import { getMarketPriceByCondition, getMarketPrice } from "../services/price-service.js";
import { checkMarketQuality } from "../services/market-filter.js";
import { log } from "../utils/logger.js";

export const compareMarketsSchema = z.object({
  condition_ids: z.array(z.string()).min(2).max(5).describe("2-5 condition IDs to compare"),
});

export async function handleCompareMarkets(input: z.infer<typeof compareMarketsSchema>): Promise<string> {
  log("info", `Comparing ${input.condition_ids.length} markets`);

  const results = await Promise.all(input.condition_ids.map(async (cid) => {
    const priceInfo = await getMarketPriceByCondition(cid);
    if (!priceInfo) return { cid, error: true };

    const [book, quality] = await Promise.all([
      getMarketPrice(priceInfo.tokenId),
      checkMarketQuality(priceInfo.tokenId),
    ]);

    return {
      cid,
      error: false,
      price: priceInfo.price,
      bid: book?.bid ?? 0,
      ask: book?.ask ?? 0,
      spread: book?.spread ?? 0,
      quality: quality.pass,
      bidDepth: quality.metrics.bidDepth,
      askDepth: quality.metrics.askDepth,
    };
  }));

  const valid = results.filter((r) => !r.error);
  if (valid.length === 0) return "Could not resolve any of the provided markets.";

  let output = `## Market Comparison (${valid.length})\n\n`;
  output += `| Metric |`;
  for (const r of valid) output += ` ${r.cid.slice(0, 10)}.. |`;
  output += `\n|--------|`;
  for (const _ of valid) output += `------------|`;
  output += `\n`;

  output += `| Price |`;
  for (const r of valid) output += ` $${(r as any).price.toFixed(4)} |`;
  output += `\n`;

  output += `| Bid |`;
  for (const r of valid) output += ` $${(r as any).bid.toFixed(4)} |`;
  output += `\n`;

  output += `| Ask |`;
  for (const r of valid) output += ` $${(r as any).ask.toFixed(4)} |`;
  output += `\n`;

  output += `| Spread |`;
  for (const r of valid) output += ` ${((r as any).spread * 100).toFixed(1)}% |`;
  output += `\n`;

  output += `| Bid Depth |`;
  for (const r of valid) output += ` $${(r as any).bidDepth.toFixed(0)} |`;
  output += `\n`;

  output += `| Ask Depth |`;
  for (const r of valid) output += ` $${(r as any).askDepth.toFixed(0)} |`;
  output += `\n`;

  output += `| Quality |`;
  for (const r of valid) output += ` ${(r as any).quality ? "PASS" : "FAIL"} |`;
  output += `\n`;

  // Best pick
  const best = valid.reduce((a, b) => ((a as any).spread < (b as any).spread ? a : b));
  output += `\n**Best liquidity:** ${(best as any).cid.slice(0, 12)}.. (tightest spread)\n`;

  return output;
}
