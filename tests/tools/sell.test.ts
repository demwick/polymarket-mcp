import { describe, it, expect, beforeEach, vi } from "vitest";
import Database from "better-sqlite3";
import { initializeDb } from "../../src/db/schema.js";
import { TradeExecutor } from "../../src/services/trade-executor.js";
import { recordTrade, getTradeHistory } from "../../src/db/queries.js";

vi.mock("../../src/utils/license.js", () => ({
  checkLicense: vi.fn().mockResolvedValue(true),
  requirePro: vi.fn((name: string) => `${name} requires Pro`),
  resetLicenseCache: vi.fn(),
}));

import { handleSell } from "../../src/tools/sell.js";
import { checkLicense } from "../../src/utils/license.js";

const mockLicense = vi.mocked(checkLicense);

function seedPosition(db: Database.Database, overrides: Record<string, unknown> = {}): number {
  return recordTrade(db, {
    trader_address: "0xabc",
    market_slug: "btc-100k",
    condition_id: "cond123",
    token_id: "tok123",
    side: "BUY",
    price: 0.5,
    amount: 10,
    original_amount: 20,
    mode: "preview",
    status: "simulated",
    ...overrides,
  });
}

describe("handleSell", () => {
  let db: Database.Database;
  let executor: TradeExecutor;

  beforeEach(() => {
    db = new Database(":memory:");
    initializeDb(db);
    executor = new TradeExecutor(db, "preview");
    mockLicense.mockResolvedValue(true);
  });

  it("preview mode does NOT require Pro license", async () => {
    mockLicense.mockResolvedValue(false);
    const id = seedPosition(db);
    const result = await handleSell(db, executor, { trade_id: id });
    expect(result).not.toContain("Pro");
    expect(result).toContain("Simulated");
  });

  it("live mode requires Pro license", async () => {
    executor.setMode("live");
    mockLicense.mockResolvedValue(false);
    const result = await handleSell(db, executor, { trade_id: 1 });
    expect(result).toContain("Pro");
  });

  it("returns error when neither trade_id nor condition_id provided", async () => {
    const result = await handleSell(db, executor, {});
    expect(result).toContain("Provide either");
  });

  it("returns error when trade_id does not match any position", async () => {
    const result = await handleSell(db, executor, { trade_id: 999 });
    expect(result).toContain("No open position");
  });

  it("returns error when condition_id has no open position", async () => {
    const result = await handleSell(db, executor, { condition_id: "missing-cond" });
    expect(result).toContain("No open position");
  });

  it("sells a position found by trade_id", async () => {
    const id = seedPosition(db, { amount: 7 });
    const result = await handleSell(db, executor, { trade_id: id, price: 0.62 });

    expect(result).toContain("Simulated");
    expect(result).toContain("SELL");
    expect(result).toContain("0.6200");
    expect(result).toContain("btc-100k");

    const trades = getTradeHistory(db, { limit: 10 });
    const sellRow = trades.find((t) => t.side === "SELL");
    expect(sellRow).toBeDefined();
    expect(sellRow!.price).toBe(0.62);
    expect(sellRow!.amount).toBe(7);
  });

  it("sells a position found by condition_id", async () => {
    seedPosition(db, { condition_id: "cond-xyz", token_id: "tok-xyz" });
    const result = await handleSell(db, executor, { condition_id: "cond-xyz" });

    expect(result).toContain("Simulated");
    const trades = getTradeHistory(db, { limit: 10 });
    const sellRow = trades.find((t) => t.side === "SELL");
    expect(sellRow).toBeDefined();
    expect(sellRow!.token_id).toBe("tok-xyz");
  });

  it("defaults to entry price when no explicit price given", async () => {
    const id = seedPosition(db, { price: 0.37 });
    await handleSell(db, executor, { trade_id: id });
    const trades = getTradeHistory(db, { limit: 10 });
    const sellRow = trades.find((t) => t.side === "SELL");
    expect(sellRow!.price).toBe(0.37);
  });

  it("does not create a daily_budget row for SELL (unchanged from trade-executor)", async () => {
    const id = seedPosition(db);
    await handleSell(db, executor, { trade_id: id });
    const today = new Date().toISOString().split("T")[0];
    const budgetRow = db
      .prepare("SELECT * FROM daily_budget WHERE date = ?")
      .get(today);
    expect(budgetRow).toBeUndefined();
  });
});
