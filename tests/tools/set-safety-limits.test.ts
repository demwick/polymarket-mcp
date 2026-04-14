import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { getConfig } from "../../src/db/queries.js";
import { makeTestDb } from "../helpers/fixtures.js";
import {
  handleSetSafetyLimits,
  getSafetyLimit,
} from "../../src/tools/set-safety-limits.js";

describe("handleSetSafetyLimits", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeTestDb();
  });

  it("returns current limits with defaults when show=true and nothing stored", () => {
    const result = handleSetSafetyLimits(db, { show: true });

    expect(result).toContain("Safety Limits");
    expect(result).toContain("$50");
    expect(result).toContain("$200");
    expect(result).toContain("$100");
    expect(result).toContain("10.0%");
  });

  it("returns guidance message when no limits and not show", () => {
    const result = handleSetSafetyLimits(db, { show: false });
    expect(result).toContain("No limits provided");
  });

  it("persists max_order_size and confirms the update", () => {
    const result = handleSetSafetyLimits(db, {
      show: false,
      max_order_size: 75,
    });

    expect(result).toContain("Safety limits updated");
    expect(result).toContain("Max order size: $75");
    expect(getConfig(db, "safety_max_order_size")).toBe("75");
    expect(getSafetyLimit(db, "max_order_size")).toBe(75);
  });

  it("persists multiple limits in a single call", () => {
    const result = handleSetSafetyLimits(db, {
      show: false,
      max_order_size: 25,
      max_exposure: 150,
      max_per_market: 60,
      min_liquidity: 100,
      max_spread: 0.05,
    });

    expect(result).toContain("Max order size: $25");
    expect(result).toContain("Max exposure: $150");
    expect(result).toContain("Max per market: $60");
    expect(result).toContain("Min liquidity: $100");
    expect(result).toContain("Max spread: 5.0%");

    expect(getConfig(db, "safety_max_order_size")).toBe("25");
    expect(getConfig(db, "safety_max_exposure")).toBe("150");
    expect(getConfig(db, "safety_max_per_market")).toBe("60");
    expect(getConfig(db, "safety_min_liquidity")).toBe("100");
    expect(getConfig(db, "safety_max_spread")).toBe("0.05");
  });

  it("renders updated values after a write when show appears in output", () => {
    handleSetSafetyLimits(db, { show: false, max_order_size: 33 });
    const result = handleSetSafetyLimits(db, { show: true });
    expect(result).toContain("$33");
  });

  it("getSafetyLimit returns the default when no value stored", () => {
    expect(getSafetyLimit(db, "max_order_size")).toBe(50);
    expect(getSafetyLimit(db, "max_exposure")).toBe(200);
    expect(getSafetyLimit(db, "max_spread")).toBeCloseTo(0.1, 5);
  });

  it("getSafetyLimit returns 0 for unknown keys with no default", () => {
    expect(getSafetyLimit(db, "nonexistent_key")).toBe(0);
  });
});
