import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { BudgetManager } from "../../src/services/budget-manager.js";
import { setExitRules, addDailySpent } from "../../src/db/queries.js";
import { handleAssessRisk } from "../../src/tools/assess-risk.js";
import { makeTestDb, seedPosition, today } from "../helpers/fixtures.js";

describe("handleAssessRisk", () => {
  let db: Database.Database;
  let budget: BudgetManager;

  beforeEach(() => {
    db = makeTestDb();
    budget = new BudgetManager(db, 100);
  });

  it("returns zero exposure message when no open positions exist", async () => {
    const result = await handleAssessRisk(db, budget);
    expect(result).toContain("No open positions");
    expect(result).toContain("zero");
  });

  it("reports LOW risk for a well-diversified protected portfolio", async () => {
    const ids = [
      seedPosition(db, { condition_id: "c1", trader_address: "0xa", amount: 10 }),
      seedPosition(db, { condition_id: "c2", trader_address: "0xb", amount: 10 }),
      seedPosition(db, { condition_id: "c3", trader_address: "0xc", amount: 10 }),
    ];
    for (const id of ids) {
      setExitRules(db, id, 0.4, 0.7);
    }

    const result = await handleAssessRisk(db, budget);

    expect(result).toContain("Risk Assessment:");
    expect(result).toContain("LOW");
    expect(result).toContain("Open Positions");
    expect(result).toContain("3");
    expect(result).toContain("Strengths");
    expect(result).toContain("Diversified across 3 markets");
    expect(result).toContain("100% of positions have stop-loss");
  });

  it("flags HIGH concentration when one position dominates the portfolio", async () => {
    seedPosition(db, { condition_id: "c1", trader_address: "0xa", amount: 80 });
    seedPosition(db, { condition_id: "c2", trader_address: "0xb", amount: 5 });
    seedPosition(db, { condition_id: "c3", trader_address: "0xc", amount: 5 });

    const result = await handleAssessRisk(db, budget);

    expect(result).toContain("High concentration");
    expect(result).toContain("Warnings");
  });

  it("flags low market diversification when 3+ positions share <3 markets", async () => {
    seedPosition(db, { condition_id: "shared", trader_address: "0xa", amount: 5 });
    seedPosition(db, { condition_id: "shared", trader_address: "0xb", amount: 5 });
    seedPosition(db, { condition_id: "shared", trader_address: "0xc", amount: 5 });

    const result = await handleAssessRisk(db, budget);

    expect(result).toContain("Low market diversification");
    expect(result).toContain("1 unique markets");
  });

  it("flags single-trader source warning when 3+ positions share trader", async () => {
    seedPosition(db, { condition_id: "c1", trader_address: "0xsame", amount: 5 });
    seedPosition(db, { condition_id: "c2", trader_address: "0xsame", amount: 5 });
    seedPosition(db, { condition_id: "c3", trader_address: "0xsame", amount: 5 });

    const result = await handleAssessRisk(db, budget);

    expect(result).toContain("All positions from same trader source");
  });

  it("warns when stop-loss coverage is low", async () => {
    seedPosition(db, { condition_id: "c1", trader_address: "0xa", amount: 5 });
    seedPosition(db, { condition_id: "c2", trader_address: "0xb", amount: 5 });

    const result = await handleAssessRisk(db, budget);

    expect(result).toContain("Only 0% of positions have stop-loss");
  });

  it("flags budget exhaustion when >90% spent", async () => {
    seedPosition(db, { condition_id: "c1", trader_address: "0xa", amount: 5 });
    addDailySpent(db, today(), 95, 100);

    const result = await handleAssessRisk(db, budget);

    expect(result).toContain("Budget nearly exhausted");
    expect(result).toMatch(/Budget Used \| 9[5-9]%/);
  });

  it("clamps risk score at 100 and labels HIGH", async () => {
    seedPosition(db, { condition_id: "shared", trader_address: "0xsame", amount: 80 });
    seedPosition(db, { condition_id: "shared", trader_address: "0xsame", amount: 5 });
    seedPosition(db, { condition_id: "shared", trader_address: "0xsame", amount: 5 });
    addDailySpent(db, today(), 95, 100);

    const result = await handleAssessRisk(db, budget);

    expect(result).toContain("HIGH");
    expect(result).toMatch(/\d+\/100/);
  });
});
