/**
 * Scenario: "Buy $5 on this market" → "Show me my positions" → "Sell that position"
 *
 * Chains handleBuy → handleGetPositions → handleSell against a single shared
 * in-memory DB and TradeExecutor. External services (market resolver, market
 * quality filter, license) are mocked; the trade-executor, queries, and budget
 * manager run for real so the scenario verifies the full happy-path wiring:
 *   - BUY creates a trade row AND a daily_budget row
 *   - positions endpoint sees the trade
 *   - SELL closes it without touching daily_budget
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
  checkMarketQuality: vi.fn(),
}));

import { handleBuy } from "../../src/tools/buy.js";
import { handleSell } from "../../src/tools/sell.js";
import { handleGetPositions } from "../../src/tools/get-positions.js";
import { resolveMarketByConditionId } from "../../src/services/market-resolver.js";
import { checkMarketQuality } from "../../src/services/market-filter.js";

const mockResolve = vi.mocked(resolveMarketByConditionId);
const mockQuality = vi.mocked(checkMarketQuality);

const MARKET: MarketInfo = {
  conditionId: "0xbtc100k",
  slug: "btc-100k-by-eoy",
  question: "Will BTC hit $100k by EOY?",
  tickSize: "0.01",
  negRisk: false,
  yesTokenId: "yes-token",
  yesPrice: 0.58,
  noTokenId: "no-token",
  noPrice: 0.42,
  tokenId: "yes-token",
};

describe("scenario: direct buy → positions → sell lifecycle", () => {
  let db: Database.Database;
  let executor: TradeExecutor;

  beforeEach(() => {
    db = new Database(":memory:");
    initializeDb(db);
    executor = new TradeExecutor(db, "preview");
    mockResolve.mockResolvedValue(MARKET);
    mockQuality.mockResolvedValue({
      pass: true,
      reasons: [],
      metrics: { spread: 0.02, midPrice: 0.58, bidDepth: 1000, askDepth: 1000, price: 0.58 },
    });
  });

  it("completes the full buy → inspect → sell flow against a shared DB", async () => {
    // 1. User: "Buy $5 on this market"
    const buyResult = await handleBuy(db, executor, {
      condition_id: MARKET.conditionId,
      amount: 5,
      outcome: "YES",
    });
    expect(buyResult).toContain("Simulated");
    expect(buyResult).toContain("BUY YES");
    expect(buyResult).toContain(MARKET.slug);

    // Budget row was created by the trade-executor auto-populate path
    const today = new Date().toISOString().split("T")[0];
    const budgetAfterBuy = db
      .prepare("SELECT spent FROM daily_budget WHERE date = ?")
      .get(today) as { spent: number } | undefined;
    expect(budgetAfterBuy?.spent).toBe(5);

    // 2. User: "Show me my positions"
    const positions = await handleGetPositions(db, { status: "open" });
    expect(positions).toContain("Positions (1)");
    expect(positions).toContain(MARKET.slug.slice(0, 25));

    // 3. User: "Sell that position"
    const openRows = getTradeHistory(db, { limit: 10, status: "simulated" });
    const openTradeId = openRows[0].id;
    const sellResult = await handleSell(db, executor, {
      trade_id: openTradeId,
      price: 0.63,
    });
    expect(sellResult).toContain("Simulated");
    expect(sellResult).toContain("SELL");
    expect(sellResult).toContain("0.6300");

    // Now we should have 2 rows: the original BUY and the new SELL
    const allRows = getTradeHistory(db, { limit: 10 });
    expect(allRows).toHaveLength(2);
    const buys = allRows.filter((t) => t.side === "BUY");
    const sells = allRows.filter((t) => t.side === "SELL");
    expect(buys).toHaveLength(1);
    expect(sells).toHaveLength(1);
    expect(sells[0].price).toBe(0.63);

    // SELL must NOT have touched daily_budget — it's a close, not a spend
    const budgetAfterSell = db
      .prepare("SELECT spent FROM daily_budget WHERE date = ?")
      .get(today) as { spent: number };
    expect(budgetAfterSell.spent).toBe(5);
  });

  it("two consecutive BUYs accumulate into a single daily_budget row", async () => {
    await handleBuy(db, executor, {
      condition_id: MARKET.conditionId,
      amount: 3,
      outcome: "YES",
    });
    await handleBuy(db, executor, {
      condition_id: MARKET.conditionId,
      amount: 4,
      outcome: "NO",
    });

    const positions = await handleGetPositions(db, { status: "open" });
    expect(positions).toContain("Positions (2)");

    const today = new Date().toISOString().split("T")[0];
    const budgetRows = db
      .prepare("SELECT COUNT(*) as n, SUM(spent) as total FROM daily_budget WHERE date = ?")
      .get(today) as { n: number; total: number };
    expect(budgetRows.n).toBe(1);
    expect(budgetRows.total).toBe(7);
  });

  it("selling by condition_id picks the most recent open position", async () => {
    await handleBuy(db, executor, {
      condition_id: MARKET.conditionId,
      amount: 5,
      outcome: "YES",
    });

    const result = await handleSell(db, executor, {
      condition_id: MARKET.conditionId,
    });

    expect(result).toContain("Simulated");
    expect(result).toContain("SELL");
    const sells = getTradeHistory(db, { limit: 10 }).filter((t) => t.side === "SELL");
    expect(sells).toHaveLength(1);
    expect(sells[0].condition_id).toBe(MARKET.conditionId);
  });
});
