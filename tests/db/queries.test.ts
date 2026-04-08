import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { initializeDb } from "../../src/db/schema.js";
import {
  addToWatchlist,
  removeFromWatchlist,
  getWatchlist,
  getWatchlistCount,
  recordTrade,
  getTradeHistory,
  getDailySpent,
  addDailySpent,
  getConfig,
  setConfig,
} from "../../src/db/queries.js";

describe("Database queries", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    initializeDb(db);
  });

  it("adds and retrieves watchlist entries", () => {
    addToWatchlist(db, {
      address: "0xabc123def456abc123def456abc123def456abc1",
      alias: "TopTrader",
      roi: 142.5,
      volume: 50000,
      pnl: 12000,
      trade_count: 85,
    });
    const list = getWatchlist(db);
    expect(list).toHaveLength(1);
    expect(list[0].address).toBe("0xabc123def456abc123def456abc123def456abc1");
    expect(list[0].alias).toBe("TopTrader");
    expect(list[0].roi).toBe(142.5);
  });

  it("removes from watchlist", () => {
    addToWatchlist(db, { address: "0xabc123def456abc123def456abc123def456abc1", alias: null, roi: 10, volume: 100, pnl: 50, trade_count: 5 });
    removeFromWatchlist(db, "0xabc123def456abc123def456abc123def456abc1");
    expect(getWatchlist(db)).toHaveLength(0);
  });

  it("counts watchlist entries", () => {
    addToWatchlist(db, { address: "0xabc123def456abc123def456abc123def456abc1", alias: "A", roi: 10, volume: 100, pnl: 50, trade_count: 5 });
    addToWatchlist(db, { address: "0xdef456abc123def456abc123def456abc123def4", alias: "B", roi: 20, volume: 200, pnl: 100, trade_count: 10 });
    expect(getWatchlistCount(db)).toBe(2);
  });

  it("records and retrieves trades", () => {
    recordTrade(db, {
      trader_address: "0xabc",
      market_slug: "trump-wins-2028",
      condition_id: "cond123",
      token_id: "tok123",
      side: "BUY",
      price: 0.45,
      amount: 5.0,
      original_amount: 30.0,
      mode: "preview",
      status: "simulated",
    });
    const trades = getTradeHistory(db, { limit: 10 });
    expect(trades).toHaveLength(1);
    expect(trades[0].market_slug).toBe("trump-wins-2028");
    expect(trades[0].amount).toBe(5.0);
  });

  it("tracks daily budget spent", () => {
    const today = new Date().toISOString().split("T")[0];
    addDailySpent(db, today, 5.0, 20);
    addDailySpent(db, today, 3.0, 20);
    expect(getDailySpent(db, today)).toBe(8.0);
  });

  it("gets and sets config", () => {
    setConfig(db, "copy_mode", "preview");
    expect(getConfig(db, "copy_mode")).toBe("preview");
    setConfig(db, "copy_mode", "live");
    expect(getConfig(db, "copy_mode")).toBe("live");
  });
});
