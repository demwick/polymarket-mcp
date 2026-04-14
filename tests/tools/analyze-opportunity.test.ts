import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/services/price-service.js", () => ({
  getMarketPriceByCondition: vi.fn(),
  getMarketPrice: vi.fn(),
}));

vi.mock("../../src/services/market-filter.js", () => ({
  checkMarketQuality: vi.fn(),
}));

vi.mock("../../src/services/price-history.js", () => ({
  getPriceHistory: vi.fn(),
}));

import { handleAnalyzeOpportunity } from "../../src/tools/analyze-opportunity.js";
import { getMarketPriceByCondition, getMarketPrice } from "../../src/services/price-service.js";
import { checkMarketQuality } from "../../src/services/market-filter.js";
import { getPriceHistory } from "../../src/services/price-history.js";

const mockResolve = vi.mocked(getMarketPriceByCondition);
const mockBook = vi.mocked(getMarketPrice);
const mockQuality = vi.mocked(checkMarketQuality);
const mockHistory = vi.mocked(getPriceHistory);

const COND = "0xcondabc";
const TOK = "tok-yes";

function makeBook(overrides: Partial<{ bid: number; ask: number; mid: number; spread: number }> = {}) {
  return {
    tokenId: TOK,
    bid: 0.58,
    ask: 0.62,
    mid: 0.60,
    spread: 0.04,
    lastPrice: 0.60,
    ...overrides,
  };
}

function makeQuality(pass: boolean, reasons: string[] = []) {
  return {
    conditionId: TOK,
    pass,
    reasons,
    metrics: { spread: 0.04, bidDepth: 1000, askDepth: 1000, midPrice: 0.60 },
  };
}

function makeHistory(prices: number[]) {
  const points = prices.map((p, i) => ({
    timestamp: new Date(1700000000000 + i * 60000).toISOString(),
    price: p,
  }));
  const high = prices.length ? Math.max(...prices) : 0;
  const low = prices.length ? Math.min(...prices) : 0;
  const open = prices[0] ?? 0;
  const close = prices[prices.length - 1] ?? 0;
  const change = close - open;
  const changePct = open > 0 ? (change / open) * 100 : 0;
  return { tokenId: TOK, interval: "1d", points, high, low, open, close, change, changePct };
}

describe("handleAnalyzeOpportunity", () => {
  beforeEach(() => {
    mockResolve.mockResolvedValue({ price: 0.60, tokenId: TOK });
    mockBook.mockResolvedValue(makeBook());
    mockQuality.mockResolvedValue(makeQuality(true));
    mockHistory.mockResolvedValue(makeHistory([0.55, 0.56, 0.57, 0.58, 0.60]));
  });

  it("returns error when market cannot be resolved", async () => {
    mockResolve.mockResolvedValue(null);
    const result = await handleAnalyzeOpportunity({ condition_id: COND });
    expect(result).toContain("Could not resolve market");
    expect(mockBook).not.toHaveBeenCalled();
  });

  it("renders happy path with metrics table and signals", async () => {
    const result = await handleAnalyzeOpportunity({ condition_id: COND });
    expect(result).toContain("Opportunity Analysis");
    expect(result).toContain("Recommendation");
    expect(result).toContain("Mid Price");
    expect(result).toContain("$0.6000");
    expect(result).toContain("Bid / Ask");
    expect(result).toContain("$0.5800");
    expect(result).toContain("$0.6200");
    expect(result).toContain("Spread");
    expect(result).toContain("Signals");
  });

  it("recommends BUY when momentum is strong upward and quality passes", async () => {
    // Strong upward momentum: 0.50 → 0.60 = +20%
    mockHistory.mockResolvedValue(makeHistory([0.50, 0.52, 0.54, 0.57, 0.60]));
    mockBook.mockResolvedValue(makeBook({ spread: 0.02, mid: 0.60, bid: 0.59, ask: 0.61 }));
    const result = await handleAnalyzeOpportunity({ condition_id: COND });
    expect(result).toContain("BUY");
    expect(result).toContain("strong candidate");
    expect(result).toContain("Strong upward momentum");
    expect(result).toContain("bullish");
  });

  it("recommends AVOID when momentum is sharply down and quality fails", async () => {
    // Strong downward momentum: 0.80 → 0.60 = -25%
    mockHistory.mockResolvedValue(makeHistory([0.80, 0.75, 0.70, 0.65, 0.60]));
    mockQuality.mockResolvedValue(makeQuality(false, ["Spread too wide"]));
    mockBook.mockResolvedValue(makeBook({ spread: 0.15, mid: 0.60, bid: 0.50, ask: 0.65 }));
    const result = await handleAnalyzeOpportunity({ condition_id: COND });
    expect(result).toContain("AVOID");
    expect(result).toContain("too risky");
    expect(result).toContain("Strong downward momentum");
    expect(result).toContain("bearish");
    expect(result).toContain("Wide spread");
    expect(result).toContain("Market quality issues");
  });

  it("falls back to priceInfo.price when book is null", async () => {
    mockBook.mockResolvedValue(null);
    mockResolve.mockResolvedValue({ price: 0.42, tokenId: TOK });
    const result = await handleAnalyzeOpportunity({ condition_id: COND });
    expect(result).toContain("$0.4200");
  });

  it("handles empty price history without crashing (neutral trend)", async () => {
    mockHistory.mockResolvedValue(makeHistory([]));
    const result = await handleAnalyzeOpportunity({ condition_id: COND });
    expect(result).toContain("neutral");
    expect(result).toContain("Price stable");
  });

  it("flags low price as potential high upside", async () => {
    mockBook.mockResolvedValue(makeBook({ mid: 0.10, bid: 0.09, ask: 0.11, spread: 0.02 }));
    mockHistory.mockResolvedValue(makeHistory([0.10, 0.10, 0.10]));
    const result = await handleAnalyzeOpportunity({ condition_id: COND });
    expect(result).toContain("Low price");
    expect(result).toContain("high upside");
  });

  it("flags high price as limited upside", async () => {
    mockBook.mockResolvedValue(makeBook({ mid: 0.90, bid: 0.89, ask: 0.91, spread: 0.02 }));
    mockHistory.mockResolvedValue(makeHistory([0.90, 0.90, 0.90]));
    const result = await handleAnalyzeOpportunity({ condition_id: COND });
    expect(result).toContain("High price");
    expect(result).toContain("limited upside");
  });

  it("renders 24h range when history has data", async () => {
    mockHistory.mockResolvedValue(makeHistory([0.50, 0.55, 0.60, 0.65, 0.70]));
    const result = await handleAnalyzeOpportunity({ condition_id: COND });
    expect(result).toContain("24h Range");
    expect(result).toContain("$0.5000");
    expect(result).toContain("$0.7000");
  });
});
