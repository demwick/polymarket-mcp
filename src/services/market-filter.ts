import { log } from "../utils/logger.js";
import { fetchWithRetry } from "../utils/fetch.js";

const CLOB_API_BASE = "https://clob.polymarket.com";

export interface MarketQuality {
  conditionId: string;
  pass: boolean;
  reasons: string[];
  metrics: {
    spread: number;
    bidDepth: number;
    askDepth: number;
    midPrice: number;
  };
}

export interface MarketFilterConfig {
  maxSpread: number;     // max bid-ask spread (default 0.10)
  minDepth: number;      // min $ depth on each side (default 50)
  minPrice: number;      // skip markets with price < this (default 0.05)
  maxPrice: number;      // skip markets with price > this (default 0.95)
}

const DEFAULT_CONFIG: MarketFilterConfig = {
  maxSpread: 0.10,
  minDepth: 50,
  minPrice: 0.05,
  maxPrice: 0.95,
};

export async function checkMarketQuality(
  tokenId: string,
  config: Partial<MarketFilterConfig> = {}
): Promise<MarketQuality> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const reasons: string[] = [];

  try {
    const url = `${CLOB_API_BASE}/book?token_id=${tokenId}`;
    const res = await fetchWithRetry(url, { retries: 1, timeoutMs: 5_000 });
    if (!res.ok) {
      return { conditionId: tokenId, pass: false, reasons: ["Order book unavailable"], metrics: { spread: 0, bidDepth: 0, askDepth: 0, midPrice: 0 } };
    }

    const book = await res.json();
    const bids: { price: string; size: string }[] = book.bids ?? [];
    const asks: { price: string; size: string }[] = book.asks ?? [];

    // Polymarket CLOB returns bids ascending (worst→best) and asks descending (worst→best).
    // Best bid is the highest, best ask is the lowest — don't trust array index 0.
    const bestBid = bids.length > 0 ? Math.max(...bids.map((b) => parseFloat(b.price))) : 0;
    const bestAsk = asks.length > 0 ? Math.min(...asks.map((a) => parseFloat(a.price))) : 0;
    const spread = bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : 1;
    const midPrice = bestBid > 0 && bestAsk > 0 ? (bestBid + bestAsk) / 2 : 0;

    // Calculate depth (total $ available on each side)
    const bidDepth = bids.reduce((sum: number, b: any) => sum + parseFloat(b.size) * parseFloat(b.price), 0);
    const askDepth = asks.reduce((sum: number, a: any) => sum + parseFloat(a.size) * parseFloat(a.price), 0);

    const metrics = { spread, bidDepth, askDepth, midPrice };

    if (spread > cfg.maxSpread) reasons.push(`Spread too wide: ${(spread * 100).toFixed(1)}% (max: ${(cfg.maxSpread * 100).toFixed(1)}%)`);
    if (bidDepth < cfg.minDepth) reasons.push(`Bid depth too thin: $${bidDepth.toFixed(0)} (min: $${cfg.minDepth})`);
    if (askDepth < cfg.minDepth) reasons.push(`Ask depth too thin: $${askDepth.toFixed(0)} (min: $${cfg.minDepth})`);
    if (midPrice > 0 && midPrice < cfg.minPrice) reasons.push(`Price too low: $${midPrice.toFixed(2)} (min: $${cfg.minPrice})`);
    if (midPrice > 0 && midPrice > cfg.maxPrice) reasons.push(`Price too high: $${midPrice.toFixed(2)} (max: $${cfg.maxPrice})`);

    const pass = reasons.length === 0;

    if (!pass) log("info", `Market filter rejected ${tokenId}: ${reasons.join(", ")}`);

    return { conditionId: tokenId, pass, reasons, metrics };
  } catch (err) {
    log("error", `Market filter error for ${tokenId}: ${err}`);
    return { conditionId: tokenId, pass: false, reasons: ["Failed to check market quality"], metrics: { spread: 0, bidDepth: 0, askDepth: 0, midPrice: 0 } };
  }
}
