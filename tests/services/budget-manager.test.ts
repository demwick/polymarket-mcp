import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { initializeDb } from "../../src/db/schema.js";
import { BudgetManager } from "../../src/services/budget-manager.js";

describe("BudgetManager", () => {
  let db: Database.Database;
  let bm: BudgetManager;

  beforeEach(() => {
    db = new Database(":memory:");
    initializeDb(db);
    bm = new BudgetManager(db, 20);
  });

  it("calculates proportional copy amount with normal conviction", () => {
    const amount = bm.calculateCopyAmount({
      originalAmount: 30,
      activeTraderCount: 4,
    });
    expect(amount).toBe(5);
  });

  it("applies low conviction multiplier for small trades", () => {
    const amount = bm.calculateCopyAmount({
      originalAmount: 5,
      activeTraderCount: 4,
    });
    expect(amount).toBe(2.5);
  });

  it("applies high conviction multiplier for large trades", () => {
    const amount = bm.calculateCopyAmount({
      originalAmount: 100,
      activeTraderCount: 4,
    });
    expect(amount).toBe(5);
  });

  it("caps single trade at 25% of daily budget", () => {
    const amount = bm.calculateCopyAmount({
      originalAmount: 60,
      activeTraderCount: 1,
    });
    expect(amount).toBe(5);
  });

  it("returns 0 when daily budget is exhausted", () => {
    const today = new Date().toISOString().split("T")[0];
    bm.recordSpending(today, 20);
    const amount = bm.calculateCopyAmount({
      originalAmount: 30,
      activeTraderCount: 4,
    });
    expect(amount).toBe(0);
  });

  it("tracks remaining budget correctly", () => {
    const today = new Date().toISOString().split("T")[0];
    bm.recordSpending(today, 12);
    expect(bm.getRemainingBudget()).toBe(8);
  });

  it("uses daily_budget.limit_amount override when present for today", () => {
    const today = new Date().toISOString().split("T")[0];
    db.prepare(
      "INSERT INTO daily_budget (date, spent, limit_amount) VALUES (?, 0, 100)"
    ).run(today);
    expect(bm.getDailyLimit()).toBe(100);
    expect(bm.getRemainingBudget()).toBe(100);
  });

  it("falls back to env default when daily_budget row is absent", () => {
    expect(bm.getDailyLimit()).toBe(20);
  });

  it("falls back to env default when daily_budget.limit_amount is zero", () => {
    const today = new Date().toISOString().split("T")[0];
    db.prepare(
      "INSERT INTO daily_budget (date, spent, limit_amount) VALUES (?, 0, 0)"
    ).run(today);
    expect(bm.getDailyLimit()).toBe(20);
  });

  it("falls back to env default when daily_budget.limit_amount is negative", () => {
    const today = new Date().toISOString().split("T")[0];
    db.prepare(
      "INSERT INTO daily_budget (date, spent, limit_amount) VALUES (?, 0, -50)"
    ).run(today);
    expect(bm.getDailyLimit()).toBe(20);
  });

  it("calculateCopyAmount uses override limit for the 25% cap", () => {
    // With env limit 20, cap = 5. With override 100, cap = 25.
    // Inputs (high conviction, single trader) produce raw=150 — without the
    // override this would be capped to 5; with the override it hits 25.
    const today = new Date().toISOString().split("T")[0];
    db.prepare(
      "INSERT INTO daily_budget (date, spent, limit_amount) VALUES (?, 0, 100)"
    ).run(today);

    const amount = bm.calculateCopyAmount({
      originalAmount: 100,
      activeTraderCount: 1,
    });
    expect(amount).toBe(25);
  });

  it("calculateCopyAmount uses override limit for the base allocation", () => {
    // With env limit 20 / 10 traders = base 2. With override 100 / 10 = 10.
    // Normal conviction (mult=1), so raw = base; cap (25) never binds.
    const today = new Date().toISOString().split("T")[0];
    db.prepare(
      "INSERT INTO daily_budget (date, spent, limit_amount) VALUES (?, 0, 100)"
    ).run(today);

    const amount = bm.calculateCopyAmount({
      originalAmount: 30,
      activeTraderCount: 10,
    });
    expect(amount).toBe(10);
  });
});
