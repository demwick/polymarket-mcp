import { describe, it, expect, vi, beforeEach } from "vitest";
import type Database from "better-sqlite3";

vi.mock("../../src/services/price-service.js", () => ({
  getMarketPriceByCondition: vi.fn(),
}));

import { handleOptimizePortfolio } from "../../src/tools/optimize-portfolio.js";
import { getMarketPriceByCondition } from "../../src/services/price-service.js";
import { setExitRules } from "../../src/db/queries.js";
import { makeTestDb, seedPosition } from "../helpers/fixtures.js";

const mockPrice = vi.mocked(getMarketPriceByCondition);

function setPrice(price: number) {
  return { price, tokenId: "tok" };
}

describe("handleOptimizePortfolio", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeTestDb();
    vi.clearAllMocks();
    mockPrice.mockResolvedValue(setPrice(0.5));
  });

  it("returns empty message when no positions", async () => {
    const result = await handleOptimizePortfolio(db, { strategy: "balanced" });
    expect(result).toBe("No open positions to optimize.");
    expect(mockPrice).not.toHaveBeenCalled();
  });

  it("renders header with selected strategy", async () => {
    seedPosition(db, { condition_id: "c1", market_slug: "btc-100k", price: 0.5, amount: 10 });
    mockPrice.mockResolvedValue(setPrice(0.55));
    const result = await handleOptimizePortfolio(db, { strategy: "aggressive" });
    expect(result).toContain("## Portfolio Optimization");
    expect(result).toContain("AGGRESSIVE");
    expect(result).toContain("btc-100k");
  });

  it("flags over-concentrated positions for balanced strategy", async () => {
    // 70% / 30% split -> 70% > 30% balanced threshold
    seedPosition(db, { condition_id: "c1", market_slug: "big-bet", price: 0.5, amount: 70 });
    seedPosition(db, { condition_id: "c2", market_slug: "small-bet", price: 0.5, amount: 30 });
    mockPrice.mockResolvedValue(setPrice(0.5));
    const result = await handleOptimizePortfolio(db, { strategy: "balanced" });
    expect(result).toContain("REDUCE");
    expect(result).toContain("big-bet");
    expect(result).toContain("70%");
  });

  it("recommends SL and TP when positions are unprotected", async () => {
    seedPosition(db, { condition_id: "c1", market_slug: "unguarded", price: 0.5, amount: 10 });
    mockPrice.mockResolvedValue(setPrice(0.5));
    const result = await handleOptimizePortfolio(db, { strategy: "balanced" });
    expect(result).toContain("SET SL");
    expect(result).toContain("SET TP");
    // balanced: 20% buffer below 0.5 -> $0.40, 20% above -> $0.60
    expect(result).toContain("$0.40");
    expect(result).toContain("$0.60");
  });

  it("does not recommend SL/TP when both are already set", async () => {
    const id = seedPosition(db, { condition_id: "c1", market_slug: "guarded", price: 0.5, amount: 10 });
    setExitRules(db, id, 0.4, 0.6);
    mockPrice.mockResolvedValue(setPrice(0.5));
    const result = await handleOptimizePortfolio(db, { strategy: "balanced" });
    expect(result).not.toContain("SET SL");
    expect(result).not.toContain("SET TP");
    expect(result).toContain("| set | set |");
  });

  it("recommends closing big losers", async () => {
    seedPosition(db, { condition_id: "c1", market_slug: "loser-mkt", price: 0.5, amount: 10 });
    // current price 0.3 -> -40%
    mockPrice.mockResolvedValue(setPrice(0.3));
    const result = await handleOptimizePortfolio(db, { strategy: "balanced" });
    expect(result).toContain("CLOSE");
    expect(result).toContain("loser-mkt");
    expect(result).toContain("-40.0%");
  });

  it("recommends taking profit on big winners without TP", async () => {
    seedPosition(db, { condition_id: "c1", market_slug: "winner-mkt", price: 0.5, amount: 10 });
    // current price 0.75 -> +50%
    mockPrice.mockResolvedValue(setPrice(0.75));
    const result = await handleOptimizePortfolio(db, { strategy: "balanced" });
    expect(result).toContain("TAKE PROFIT");
    expect(result).toContain("winner-mkt");
    expect(result).toContain("+50.0%");
  });

  it("falls back to entry price when price service returns null", async () => {
    seedPosition(db, { condition_id: "c1", market_slug: "no-price", price: 0.5, amount: 10 });
    mockPrice.mockResolvedValue(null);
    const result = await handleOptimizePortfolio(db, { strategy: "balanced" });
    // pnl% should be 0 when current == entry
    expect(result).toContain("+0.0%");
    expect(result).not.toContain("CLOSE");
  });

  it("forwards strategy parameter to threshold selection", async () => {
    // Conservative: maxConcentration 20%, 25% should trigger; balanced (30%) should not
    seedPosition(db, { condition_id: "c1", market_slug: "pos-a", price: 0.5, amount: 25 });
    seedPosition(db, { condition_id: "c2", market_slug: "pos-b", price: 0.5, amount: 25 });
    seedPosition(db, { condition_id: "c3", market_slug: "pos-c", price: 0.5, amount: 25 });
    seedPosition(db, { condition_id: "c4", market_slug: "pos-d", price: 0.5, amount: 25 });
    mockPrice.mockResolvedValue(setPrice(0.5));

    const conservative = await handleOptimizePortfolio(db, { strategy: "conservative" });
    expect(conservative).toContain("REDUCE");

    const balanced = await handleOptimizePortfolio(db, { strategy: "balanced" });
    expect(balanced).not.toContain("REDUCE");
  });
});
