import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { initializeDb } from "../../src/db/schema.js";
import { TradeExecutor, type TradeOrder } from "../../src/services/trade-executor.js";
import { getTradeHistory } from "../../src/db/queries.js";
import { getConfig } from "../../src/utils/config.js";

const ENV_DAILY_BUDGET = getConfig().DAILY_BUDGET;
const today = () => new Date().toISOString().split("T")[0];

function makeOrder(overrides: Partial<TradeOrder> = {}): TradeOrder {
  return {
    traderAddress: "0xabc",
    marketSlug: "test-market",
    conditionId: "cond_test",
    tokenId: "tok_test",
    price: 0.5,
    amount: 5,
    originalAmount: 20,
    tickSize: "0.01",
    negRisk: false,
    ...overrides,
  };
}

type BudgetRow = { date: string; spent: number; limit_amount: number };

describe("TradeExecutor (preview mode)", () => {
  let db: Database.Database;
  let executor: TradeExecutor;

  beforeEach(() => {
    db = new Database(":memory:");
    initializeDb(db);
    executor = new TradeExecutor(db, "preview");
  });

  it("simulates a trade in preview mode", async () => {
    const result = await executor.execute({
      traderAddress: "0xabc",
      marketSlug: "btc-100k",
      conditionId: "cond123",
      tokenId: "tok123",
      price: 0.45,
      amount: 5,
      originalAmount: 30,
      tickSize: "0.01",
      negRisk: false,
    });

    expect(result.status).toBe("simulated");
    expect(result.mode).toBe("preview");

    const trades = getTradeHistory(db, { limit: 10 });
    expect(trades).toHaveLength(1);
    expect(trades[0].status).toBe("simulated");
    expect(trades[0].amount).toBe(5);
  });

  it("always simulates in preview mode", async () => {
    const result = await executor.execute({
      traderAddress: "0xabc",
      marketSlug: "test",
      conditionId: "cond",
      tokenId: "tok",
      price: 0.5,
      amount: 5,
      originalAmount: 10,
      tickSize: "0.01",
      negRisk: false,
    });
    expect(result.mode).toBe("preview");
    expect(result.status).toBe("simulated");
  });

  it("simulates a SELL trade in preview mode", async () => {
    const result = await executor.executeSell({
      traderAddress: "0xabc",
      marketSlug: "sell-test",
      conditionId: "cond_sell",
      tokenId: "tok_sell",
      price: 0.65,
      amount: 8,
      originalAmount: 15,
      tickSize: "0.01",
      negRisk: false,
    });

    expect(result.status).toBe("simulated");
    expect(result.mode).toBe("preview");

    const trades = getTradeHistory(db, { limit: 10 });
    const sellTrade = trades.find((t) => t.condition_id === "cond_sell");
    expect(sellTrade).toBeDefined();
    expect(sellTrade!.side).toBe("SELL");
    expect(sellTrade!.price).toBe(0.65);
  });

  it("switches mode correctly", () => {
    expect(executor.getMode()).toBe("preview");
    executor.setMode("live");
    expect(executor.getMode()).toBe("live");
    executor.setMode("preview");
    expect(executor.getMode()).toBe("preview");
  });

  describe("preview BUY auto-budget", () => {
    it("auto-populates daily_budget row when caller omits order.budget (env fallback)", async () => {
      await executor.execute(makeOrder({ amount: 5 }));

      const row = db
        .prepare("SELECT * FROM daily_budget WHERE date = ?")
        .get(today()) as BudgetRow | undefined;

      expect(row).toBeDefined();
      expect(row!.spent).toBe(5);
      expect(row!.limit_amount).toBe(ENV_DAILY_BUDGET);
    });

    it("honors daily_budget override row when auto-populating", async () => {
      const d = today();
      db.prepare(
        "INSERT INTO daily_budget (date, spent, limit_amount) VALUES (?, 0, 100)"
      ).run(d);

      await executor.execute(makeOrder({ amount: 7 }));

      const row = db
        .prepare("SELECT * FROM daily_budget WHERE date = ?")
        .get(d) as BudgetRow;
      // addDailySpent preserves limit_amount on UPDATE — override must survive.
      expect(row.limit_amount).toBe(100);
      expect(row.spent).toBe(7);
    });

    it("uses caller-provided budget verbatim when order.budget is passed", async () => {
      const customDate = "2020-01-01";
      await executor.execute(
        makeOrder({
          amount: 5,
          budget: { date: customDate, spendAmount: 99, dailyLimit: 500 },
        })
      );

      const row = db
        .prepare("SELECT * FROM daily_budget WHERE date = ?")
        .get(customDate) as BudgetRow;
      expect(row.spent).toBe(99);
      expect(row.limit_amount).toBe(500);

      const todayRow = db
        .prepare("SELECT * FROM daily_budget WHERE date = ?")
        .get(today());
      expect(todayRow).toBeUndefined();
    });

    it("always records via recordTradeWithBudget — every BUY creates a budget row", async () => {
      await executor.execute(makeOrder({ amount: 3, conditionId: "c1", tokenId: "t1" }));
      await executor.execute(makeOrder({ amount: 4, conditionId: "c2", tokenId: "t2" }));

      const row = db
        .prepare("SELECT * FROM daily_budget WHERE date = ?")
        .get(today()) as BudgetRow;
      expect(row.spent).toBe(7);
      expect(getTradeHistory(db, { limit: 10 })).toHaveLength(2);
    });

    it("accumulates spent on repeated BUYs without resetting limit_amount", async () => {
      const d = today();
      db.prepare(
        "INSERT INTO daily_budget (date, spent, limit_amount) VALUES (?, 10, 100)"
      ).run(d);

      await executor.execute(makeOrder({ amount: 5 }));

      const row = db
        .prepare("SELECT * FROM daily_budget WHERE date = ?")
        .get(d) as BudgetRow;
      expect(row.spent).toBe(15);
      expect(row.limit_amount).toBe(100);
    });
  });

  describe("preview SELL path (unchanged)", () => {
    it("does not create a daily_budget row — SELL is not a spend", async () => {
      await executor.executeSell(makeOrder({ amount: 8 }));

      const budgetRow = db
        .prepare("SELECT * FROM daily_budget WHERE date = ?")
        .get(today());
      expect(budgetRow).toBeUndefined();

      const trades = getTradeHistory(db, { limit: 10 });
      expect(trades).toHaveLength(1);
      expect(trades[0].side).toBe("SELL");
    });
  });

  it("records trade with correct fields", async () => {
    await executor.execute({
      traderAddress: "0xtrader",
      marketSlug: "btc-market",
      conditionId: "cond_btc",
      tokenId: "tok_btc",
      price: 0.72,
      amount: 12.5,
      originalAmount: 50,
      tickSize: "0.01",
      negRisk: true,
    });

    const trades = getTradeHistory(db, { limit: 10 });
    expect(trades).toHaveLength(1);
    expect(trades[0].trader_address).toBe("0xtrader");
    expect(trades[0].condition_id).toBe("cond_btc");
    expect(trades[0].token_id).toBe("tok_btc");
    expect(trades[0].price).toBe(0.72);
    expect(trades[0].amount).toBe(12.5);
    expect(trades[0].original_amount).toBe(50);
    expect(trades[0].mode).toBe("preview");
  });
});
