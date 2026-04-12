import { log } from "../utils/logger.js";
import { fetchWithRetry } from "../utils/fetch.js";

const CLOB_API_BASE = "https://clob.polymarket.com";

export interface MarketPrice {
  tokenId: string;
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  lastPrice: number;
}

export async function getMarketPrice(tokenId: string): Promise<MarketPrice | null> {
  try {
    const url = `${CLOB_API_BASE}/book?token_id=${tokenId}`;
    const res = await fetchWithRetry(url);
    if (!res.ok) return null;
    const book = await res.json();

    const bids: { price: string; size: string }[] = book.bids ?? [];
    const asks: { price: string; size: string }[] = book.asks ?? [];
    // CLOB returns bids ascending and asks descending; best bid = highest, best ask = lowest.
    const bestBid = bids.length > 0 ? Math.max(...bids.map((b) => parseFloat(b.price))) : 0;
    const bestAsk = asks.length > 0 ? Math.min(...asks.map((a) => parseFloat(a.price))) : 0;
    const mid = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : bestBid || bestAsk;
    const spread = bestAsk && bestBid ? bestAsk - bestBid : 0;

    return { tokenId, bid: bestBid, ask: bestAsk, mid, spread, lastPrice: mid };
  } catch (err) {
    log("error", `Failed to get price for ${tokenId}: ${err}`);
    return null;
  }
}

export async function getMarketPriceByCondition(conditionId: string): Promise<{ price: number; tokenId: string } | null> {
  try {
    // CLOB /markets/{conditionId} filters correctly (unlike Gamma /markets?condition_id=,
    // which silently ignores the param and returns the first market in the DB).
    const url = `${CLOB_API_BASE}/markets/${conditionId}`;
    const res = await fetchWithRetry(url);
    if (!res.ok) return null;
    const market = await res.json();
    if (!market?.condition_id || !Array.isArray(market.tokens)) return null;

    const yesToken = market.tokens.find((t: any) => String(t.outcome).toLowerCase() === "yes");
    if (!yesToken?.token_id) return null;

    return {
      price: Number(yesToken.price ?? 0),
      tokenId: String(yesToken.token_id),
    };
  } catch (err) {
    log("error", `Failed to get price by condition ${conditionId}: ${err}`);
    return null;
  }
}
