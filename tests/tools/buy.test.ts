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
import { checkLicense } from "../../src/utils/license.js";
import { resolveMarketByConditionId } from "../../src/services/market-resolver.js";
import { checkMarketQuality } from "../../src/services/market-filter.js";

const mockLicense = vi.mocked(checkLicense);
const mockResolve = vi.mocked(resolveMarketByConditionId);
const mockQuality = vi.mocked(checkMarketQuality);

function fakeMarket(overrides: Partial<MarketInfo> = {}): MarketInfo {
  return {
    conditionId: "0xcond",
    slug: "btc-100k",
    question: "Will BTC hit 100k?",
    tickSize: "0.01",
    negRisk: false,
    yesTokenId: "yes-tok",
    yesPrice: 0.6,
    noTokenId: "no-tok",
    noPrice: 0.4,
    tokenId: "yes-tok",
    ...overrides,
  };
}

function passingQuality(midPrice = 0.6) {
  return {
    pass: true,
    reasons: [] as string[],
    metrics: { spread: 0.02, midPrice, bidDepth: 1000, askDepth: 1000, price: midPrice },
  };
}

describe("handleBuy", () => {
  let db: Database.Database;
  let executor: TradeExecutor;

  beforeEach(() => {
    db = new Database(":memory:");
    initializeDb(db);
    executor = new TradeExecutor(db, "preview");
    mockLicense.mockResolvedValue(true);
    mockResolve.mockResolvedValue(fakeMarket());
    mockQuality.mockResolvedValue(passingQuality());
  });

  it("preview mode does NOT require Pro license", async () => {
    mockLicense.mockResolvedValue(false);
    const result = await handleBuy(db, executor, {
      condition_id: "0xcond",
      amount: 5,
      outcome: "YES",
    });
    expect(result).not.toContain("Pro");
    expect(result).toContain("Simulated");
  });

  it("live mode requires Pro license", async () => {
    executor.setMode("live");
    mockLicense.mockResolvedValue(false);
    const result = await handleBuy(db, executor, {
      condition_id: "0xcond",
      amount: 5,
      outcome: "YES",
    });
    expect(result).toContain("Pro");
  });

  it("returns error when market cannot be resolved", async () => {
    mockResolve.mockResolvedValue(null);
    const result = await handleBuy(db, executor, {
      condition_id: "0xbad",
      amount: 5,
      outcome: "YES",
    });
    expect(result).toContain("Could not resolve");
  });

  it("returns quality failure reasons when market quality check fails", async () => {
    mockQuality.mockResolvedValue({
      pass: false,
      reasons: ["spread too wide", "bid depth too thin"],
      metrics: { spread: 0.2, midPrice: 0.5, bidDepth: 10, askDepth: 10, price: 0.5 },
    });
    const result = await handleBuy(db, executor, {
      condition_id: "0xcond",
      amount: 5,
      outcome: "YES",
    });
    expect(result).toContain("Market quality check failed");
    expect(result).toContain("spread too wide");
    expect(result).toContain("bid depth too thin");
  });

  it("happy path records a preview BUY and creates daily_budget row", async () => {
    const result = await handleBuy(db, executor, {
      condition_id: "0xcond",
      amount: 5,
      outcome: "YES",
    });

    expect(result).toContain("Simulated");
    expect(result).toContain("BUY YES");
    expect(result).toContain("btc-100k");

    const trades = getTradeHistory(db, { limit: 10 });
    expect(trades).toHaveLength(1);
    expect(trades[0].token_id).toBe("yes-tok");
    expect(trades[0].amount).toBe(5);
    expect(trades[0].mode).toBe("preview");

    const today = new Date().toISOString().split("T")[0];
    const budgetRow = db
      .prepare("SELECT * FROM daily_budget WHERE date = ?")
      .get(today) as { spent: number } | undefined;
    expect(budgetRow).toBeDefined();
    expect(budgetRow!.spent).toBe(5);
  });

  it("uses explicit price parameter when provided", async () => {
    await handleBuy(db, executor, {
      condition_id: "0xcond",
      amount: 5,
      price: 0.42,
      outcome: "YES",
    });
    const trades = getTradeHistory(db, { limit: 1 });
    expect(trades[0].price).toBe(0.42);
  });

  it("falls back to quality midPrice when no explicit price", async () => {
    mockQuality.mockResolvedValue(passingQuality(0.73));
    await handleBuy(db, executor, {
      condition_id: "0xcond",
      amount: 5,
      outcome: "YES",
    });
    const trades = getTradeHistory(db, { limit: 1 });
    expect(trades[0].price).toBe(0.73);
  });

  it("picks noTokenId when outcome is NO", async () => {
    await handleBuy(db, executor, {
      condition_id: "0xcond",
      amount: 5,
      outcome: "NO",
    });
    const trades = getTradeHistory(db, { limit: 1 });
    expect(trades[0].token_id).toBe("no-tok");
  });
});
