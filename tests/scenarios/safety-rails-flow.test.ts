/**
 * Scenario: "Set a per-market limit, then try to over-allocate"
 *
 * Chains handleSetSafetyLimits → handleBuy → handleBuy, verifying that the
 * safety gate inside handleBuy respects the limit store and that hitting a
 * limit blocks the trade without touching the DB or the budget. The second
 * BUY on a different market must still succeed, proving the limit is scoped
 * per condition_id, not globally.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import Database from "better-sqlite3";
import { initializeDb } from "../../src/db/schema.js";
import { TradeExecutor } from "../../src/services/trade-executor.js";
import { getTradeHistory } from "../../src/db/queries.js";
import type { MarketInfo } from "../../src/services/market-resolver.js";

vi.mock("../../src/utils/license.js", () => ({
  checkLicense: vi.fn().mockResolvedValue(true),
  requirePro: vi.fn((name: string) => `${name} requires Pro`),
  resetLicenseCache: vi.fn(),
}));

vi.mock("../../src/services/market-resolver.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/services/market-resolver.js")>(
    "../../src/services/market-resolver.js"
  );
  return { ...actual, resolveMarketByConditionId: vi.fn() };
});

vi.mock("../../src/services/market-filter.js", () => ({
  checkMarketQuality: vi.fn().mockResolvedValue({
    pass: true,
    reasons: [],
    metrics: { spread: 0.02, midPrice: 0.5, bidDepth: 1000, askDepth: 1000, price: 0.5 },
  }),
}));

import { handleBuy } from "../../src/tools/buy.js";
import { handleSetSafetyLimits } from "../../src/tools/set-safety-limits.js";
import { resolveMarketByConditionId } from "../../src/services/market-resolver.js";

const mockResolve = vi.mocked(resolveMarketByConditionId);

function fakeMarket(conditionId: string, slug: string): MarketInfo {
  return {
    conditionId,
    slug,
    question: `Question for ${slug}`,
    tickSize: "0.01",
    negRisk: false,
    yesTokenId: `${slug}-yes`,
    yesPrice: 0.5,
    noTokenId: `${slug}-no`,
    noPrice: 0.5,
    tokenId: `${slug}-yes`,
  };
}

describe("scenario: safety rails block over-allocation per market", () => {
  let db: Database.Database;
  let executor: TradeExecutor;

  beforeEach(() => {
    db = new Database(":memory:");
    initializeDb(db);
    executor = new TradeExecutor(db, "preview");
  });

  it("per-market limit blocks the second BUY on the same condition_id", async () => {
    handleSetSafetyLimits(db, { max_per_market: 20, show: false });

    mockResolve.mockImplementation(async (cid: string) => {
      if (cid === "0xbtc") return fakeMarket("0xbtc", "btc-100k");
      if (cid === "0xeth") return fakeMarket("0xeth", "eth-merge");
      return null;
    });

    // 1. First BTC BUY: $15 — under the $20 per-market cap
    const first = await handleBuy(db, executor, {
      condition_id: "0xbtc",
      amount: 15,
      outcome: "YES",
    });
    expect(first).toContain("Simulated");

    // 2. Second BTC BUY: $10 — would push total to $25, exceeding the cap
    const second = await handleBuy(db, executor, {
      condition_id: "0xbtc",
      amount: 10,
      outcome: "YES",
    });
    expect(second).toContain("Safety limit exceeded");
    expect(second).toContain("per-market");

    // 3. ETH BUY: $10 — different market, should still pass
    const third = await handleBuy(db, executor, {
      condition_id: "0xeth",
      amount: 10,
      outcome: "YES",
    });
    expect(third).toContain("Simulated");

    // State: exactly 2 trades recorded (first and third). Budget spent = 25.
    const trades = getTradeHistory(db, { limit: 10 });
    expect(trades).toHaveLength(2);
    const btcTrades = trades.filter((t) => t.condition_id === "0xbtc");
    const ethTrades = trades.filter((t) => t.condition_id === "0xeth");
    expect(btcTrades).toHaveLength(1);
    expect(ethTrades).toHaveLength(1);
    expect(btcTrades[0].amount).toBe(15);
    expect(ethTrades[0].amount).toBe(10);

    const today = new Date().toISOString().split("T")[0];
    const budgetRow = db
      .prepare("SELECT spent FROM daily_budget WHERE date = ?")
      .get(today) as { spent: number };
    expect(budgetRow.spent).toBe(25);
  });

  it("max_exposure blocks total over-allocation across markets", async () => {
    handleSetSafetyLimits(db, { max_exposure: 30, show: false });

    mockResolve.mockImplementation(async (cid: string) => {
      if (cid === "0xa") return fakeMarket("0xa", "market-a");
      if (cid === "0xb") return fakeMarket("0xb", "market-b");
      if (cid === "0xc") return fakeMarket("0xc", "market-c");
      return null;
    });

    await handleBuy(db, executor, { condition_id: "0xa", amount: 15, outcome: "YES" });
    await handleBuy(db, executor, { condition_id: "0xb", amount: 10, outcome: "YES" });

    // Third BUY: $10 would push total to $35, exceeding the $30 cap
    const blocked = await handleBuy(db, executor, {
      condition_id: "0xc",
      amount: 10,
      outcome: "YES",
    });
    expect(blocked).toContain("Safety limit exceeded");
    expect(blocked).toContain("exposure");

    const trades = getTradeHistory(db, { limit: 10 });
    expect(trades).toHaveLength(2);
  });

  it("max_order_size blocks a single oversized BUY", async () => {
    handleSetSafetyLimits(db, { max_order_size: 10, show: false });
    mockResolve.mockResolvedValue(fakeMarket("0xbig", "big-market"));

    const blocked = await handleBuy(db, executor, {
      condition_id: "0xbig",
      amount: 25,
      outcome: "YES",
    });
    expect(blocked).toContain("Safety limit exceeded");
    expect(blocked).toContain("max order size");

    const trades = getTradeHistory(db, { limit: 10 });
    expect(trades).toHaveLength(0);
  });
});
