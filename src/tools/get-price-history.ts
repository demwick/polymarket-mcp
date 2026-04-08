import { z } from "zod";
import { getPriceHistory, type Interval } from "../services/price-history.js";
import { checkLicense, requirePro } from "../utils/license.js";

export const getPriceHistorySchema = z.object({
  token_id: z.string(),
  interval: z.enum(["1h", "6h", "1d", "1w", "1m"]).optional().default("1d").describe("Time window: 1h, 6h, 1d, 1w, or 1m"),
});

export async function handleGetPriceHistory(input: z.infer<typeof getPriceHistorySchema>): Promise<string> {
  const isPro = await checkLicense(); if (!isPro) return requirePro("get_price_history");
  const history = await getPriceHistory(input.token_id, input.interval as Interval);

  if (history.points.length === 0) {
    return `No price history available for this token (interval: ${input.interval}). The market may be too new or inactive.`;
  }

  const arrow = history.change >= 0 ? "+" : "";
  let output = `## Price History (${input.interval})\n\n`;
  output += `| Metric | Value |\n|--------|-------|\n`;
  output += `| Open | $${history.open.toFixed(4)} |\n`;
  output += `| Close | $${history.close.toFixed(4)} |\n`;
  output += `| High | $${history.high.toFixed(4)} |\n`;
  output += `| Low | $${history.low.toFixed(4)} |\n`;
  output += `| Change | ${arrow}$${history.change.toFixed(4)} (${arrow}${history.changePct.toFixed(1)}%) |\n`;
  output += `| Data Points | ${history.points.length} |\n`;

  // Show recent price points (last 10)
  const recent = history.points.slice(-10);
  if (recent.length > 0) {
    output += `\n### Recent Prices\n\n`;
    output += `| Time | Price |\n|------|-------|\n`;
    for (const p of recent) {
      const time = p.timestamp.slice(11, 16);
      output += `| ${time} | $${p.price.toFixed(4)} |\n`;
    }
  }

  // Sparkline summary
  const sampled = samplePoints(history.points, 20);
  if (sampled.length >= 2) {
    const min = Math.min(...sampled.map((p) => p.price));
    const max = Math.max(...sampled.map((p) => p.price));
    const range = max - min || 1;
    const bars = sampled.map((p) => {
      const level = Math.round(((p.price - min) / range) * 7);
      return ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"][level];
    }).join("");
    output += `\n**Trend:** ${bars}\n`;
  }

  return output;
}

function samplePoints(points: { price: number }[], count: number): { price: number }[] {
  if (points.length <= count) return points;
  const step = (points.length - 1) / (count - 1);
  return Array.from({ length: count }, (_, i) => points[Math.round(i * step)]);
}
