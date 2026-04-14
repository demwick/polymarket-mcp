import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { handleGetBalance } from "../../src/tools/get-balance.js";
import { BudgetManager } from "../../src/services/budget-manager.js";
import { recordTrade, addDailySpent } from "../../src/db/queries.js";
import { makeTestDb, today } from "../helpers/fixtures.js";

describe("handleGetBalance", () => {
  let db: Database.Database;
  let budgetManager: BudgetManager;

  beforeEach(() => {
    db = makeTestDb();
    budgetManager = new BudgetManager(db, 100);
  });

  it("renders header and budget metrics for an empty DB", async () => {
    const result = await handleGetBalance(db, budgetManager);
    expect(result).toContain("## Account Balance");
    expect(result).toContain("Daily Budget");
    expect(result).toContain("$100.00");
    expect(result).toContain("Spent Today");
    expect(result).toContain("Remaining Today");
    expect(result).toContain("Open Positions");
    expect(result).toContain("0 ($0.00 invested)");
    expect(result).toContain("Total Trades");
  });

  it("reflects spent and remaining after addDailySpent", async () => {
    addDailySpent(db, today(), 25, 100);
    const result = await handleGetBalance(db, budgetManager);
    expect(result).toContain("$25.00");
    expect(result).toContain("$75.00");
  });

  it("counts open positions and totals invested amount", async () => {
    recordTrade(db, {
      trader_address: "0x1",
      market_slug: "m1",
      condition_id: "c1",
      token_id: "t1",
      side: "BUY",
      price: 0.5,
      amount: 12,
      original_amount: 20,
      mode: "preview",
      status: "simulated",
    });
    recordTrade(db, {
      trader_address: "0x2",
      market_slug: "m2",
      condition_id: "c2",
      token_id: "t2",
      side: "BUY",
      price: 0.3,
      amount: 8,
      original_amount: 10,
      mode: "preview",
      status: "simulated",
    });
    const result = await handleGetBalance(db, budgetManager);
    expect(result).toContain("2 ($20.00 invested)");
  });

  it("computes win rate and realized P&L from resolved trades", async () => {
    recordTrade(db, {
      trader_address: "0x1",
      market_slug: "m1",
      condition_id: "c1",
      token_id: "t1",
      side: "BUY",
      price: 0.5,
      amount: 10,
      original_amount: 10,
      mode: "preview",
      status: "resolved_win",
    });
    db.prepare("UPDATE trades SET pnl = 5 WHERE id = 1").run();

    recordTrade(db, {
      trader_address: "0x2",
      market_slug: "m2",
      condition_id: "c2",
      token_id: "t2",
      side: "BUY",
      price: 0.5,
      amount: 10,
      original_amount: 10,
      mode: "preview",
      status: "resolved_loss",
    });
    db.prepare("UPDATE trades SET pnl = -3 WHERE id = 2").run();

    const result = await handleGetBalance(db, budgetManager);
    expect(result).toContain("$2.00");
    expect(result).toContain("50.0%");
    expect(result).toContain("(1W / 1L)");
    expect(result).toContain("Total Trades");
  });

  it("uses dashboard-overridden daily limit when set", async () => {
    addDailySpent(db, today(), 10, 200);
    const result = await handleGetBalance(db, budgetManager);
    expect(result).toContain("$200.00");
    expect(result).toContain("$190.00");
  });
});
