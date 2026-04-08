import { describe, it, expect, beforeEach, vi } from "vitest";
import Database from "better-sqlite3";
import { initializeDb } from "../../src/db/schema.js";
import { handleListWatchlist } from "../../src/tools/list-watchlist.js";
import { addToWatchlist } from "../../src/db/queries.js";

vi.mock("../../src/utils/license.js", () => ({
  checkLicense: vi.fn().mockResolvedValue(true),
  requirePro: vi.fn((name: string) => `${name} requires Pro`),
}));

describe("handleListWatchlist", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    initializeDb(db);
  });

  it("returns empty message when watchlist is empty", async () => {
    const result = await handleListWatchlist(db);
    expect(result).toContain("empty");
  });

  it("renders watchlist as markdown table", async () => {
    addToWatchlist(db, { address: "0xabc123def456abc123def456abc123def456abc1", alias: "Alpha", roi: 142.5, volume: 50000, pnl: 12000, trade_count: 85 });
    addToWatchlist(db, { address: "0xdef456abc123def456abc123def456abc123def4", alias: "Beta", roi: 80.0, volume: 25000, pnl: 5000, trade_count: 42 });

    const result = await handleListWatchlist(db);
    expect(result).toContain("Watchlist (2");
    expect(result).toContain("Alpha");
    expect(result).toContain("Beta");
    expect(result).toContain("0xabc1");
    expect(result).toContain("142.5");
  });

  it("handles null alias gracefully", async () => {
    addToWatchlist(db, { address: "0xabc123def456abc123def456abc123def456abc1", alias: null, roi: 10, volume: 100, pnl: 50, trade_count: 5 });

    const result = await handleListWatchlist(db);
    expect(result).toContain("-");
  });
});
