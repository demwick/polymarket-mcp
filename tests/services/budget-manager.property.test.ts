import { describe, it, beforeEach, expect } from "vitest";
import fc from "fast-check";
import Database from "better-sqlite3";
import { initializeDb } from "../../src/db/schema.js";
import { BudgetManager } from "../../src/services/budget-manager.js";

describe("BudgetManager property tests", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    initializeDb(db);
  });

  it("calculateCopyAmount never exceeds 25% of daily limit or remaining budget", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 10_000, noNaN: true, noDefaultInfinity: true }),
        fc.integer({ min: 1, max: 50 }),
        fc.double({ min: 0.01, max: 100_000, noNaN: true, noDefaultInfinity: true }),
        (dailyLimit, activeTraderCount, originalAmount) => {
          const bm = new BudgetManager(db, dailyLimit);
          const amount = bm.calculateCopyAmount({ originalAmount, activeTraderCount });

          expect(amount).toBeGreaterThanOrEqual(0);
          expect(amount).toBeLessThanOrEqual(dailyLimit * 0.25 + 1e-9);
          expect(amount).toBeLessThanOrEqual(bm.getRemainingBudget() + 1e-9);
          expect(Number.isFinite(amount)).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("calculateCopyAmount returns 0 when remaining budget is exhausted", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 1_000, noNaN: true, noDefaultInfinity: true }),
        fc.integer({ min: 1, max: 20 }),
        fc.double({ min: 1, max: 1_000, noNaN: true, noDefaultInfinity: true }),
        (dailyLimit, activeTraderCount, originalAmount) => {
          const bm = new BudgetManager(db, dailyLimit);
          const today = new Date().toISOString().split("T")[0];
          bm.recordSpending(today, dailyLimit);

          const amount = bm.calculateCopyAmount({ originalAmount, activeTraderCount });
          expect(amount).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
