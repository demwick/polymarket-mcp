import { log } from "../utils/logger.js";
import { fetchWithRetry } from "../utils/fetch.js";

const CLOB_API_BASE = "https://clob.polymarket.com";

export interface MarketInfo {
  conditionId: string;
  slug: string;
  question: string;
  tickSize: string;
  negRisk: boolean;
  yesTokenId: string;
  yesPrice: number;
  noTokenId: string;
  noPrice: number;
  // Default token (YES side) for callers that don't care about outcome.
  tokenId: string;
}

export async function resolveMarketByConditionId(conditionId: string): Promise<MarketInfo | null> {
  try {
    // CLOB /markets/{conditionId} returns a single market filtered by conditionId.
    // Gamma /markets?condition_id= silently ignores the filter and returns the first DB row.
    const url = `${CLOB_API_BASE}/markets/${conditionId}`;
    const response = await fetchWithRetry(url);
    if (!response.ok) return null;

    const market = await response.json();
    if (!market?.condition_id || !Array.isArray(market.tokens)) return null;

    const yesToken = market.tokens.find((t: any) => String(t.outcome).toLowerCase() === "yes");
    const noToken = market.tokens.find((t: any) => String(t.outcome).toLowerCase() === "no");
    if (!yesToken?.token_id || !noToken?.token_id) return null;

    const yesTokenId = String(yesToken.token_id);
    return {
      conditionId: market.condition_id,
      slug: market.market_slug ?? "",
      question: market.question ?? "",
      tickSize: String(market.minimum_tick_size ?? "0.01"),
      negRisk: Boolean(market.neg_risk),
      yesTokenId,
      yesPrice: Number(yesToken.price ?? 0),
      noTokenId: String(noToken.token_id),
      noPrice: Number(noToken.price ?? 0),
      tokenId: yesTokenId,
    };
  } catch (err) {
    log("error", `Failed to resolve market ${conditionId}`, { error: String(err) });
    return null;
  }
}

export function pickTokenId(info: MarketInfo, outcome: "YES" | "NO"): string {
  return outcome === "NO" ? info.noTokenId : info.yesTokenId;
}

export function pickPrice(info: MarketInfo, outcome: "YES" | "NO"): number {
  return outcome === "NO" ? info.noPrice : info.yesPrice;
}
