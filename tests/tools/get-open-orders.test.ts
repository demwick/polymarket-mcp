import { describe, it, expect, beforeEach, vi } from "vitest";
import Database from "better-sqlite3";
import { TradeExecutor } from "../../src/services/trade-executor.js";
import { handleGetOpenOrders } from "../../src/tools/get-open-orders.js";
import { makeTestDb } from "../helpers/fixtures.js";

describe("handleGetOpenOrders", () => {
  let db: Database.Database;
  let executor: TradeExecutor;

  beforeEach(() => {
    db = makeTestDb();
    executor = new TradeExecutor(db, "preview");
  });

  it("rejects in preview mode", async () => {
    const result = await handleGetOpenOrders(executor);
    expect(result).toContain("only available in live mode");
  });

  it("returns 'no open orders' when client returns empty array", async () => {
    executor.setMode("live");
    vi.spyOn(executor as any, "getClobClient").mockResolvedValue({
      getOpenOrders: vi.fn().mockResolvedValue([]),
    });
    const result = await handleGetOpenOrders(executor);
    expect(result).toBe("No open orders.");
  });

  it("returns 'no open orders' when client returns null", async () => {
    executor.setMode("live");
    vi.spyOn(executor as any, "getClobClient").mockResolvedValue({
      getOpenOrders: vi.fn().mockResolvedValue(null),
    });
    const result = await handleGetOpenOrders(executor);
    expect(result).toBe("No open orders.");
  });

  it("renders order rows for happy path", async () => {
    executor.setMode("live");
    vi.spyOn(executor as any, "getClobClient").mockResolvedValue({
      getOpenOrders: vi.fn().mockResolvedValue([
        {
          id: "0xorderabcdef123456",
          market: "btc-100k-by-end-of-2025",
          side: "BUY",
          price: "0.42",
          original_size: "10.5",
          order_type: "GTC",
        },
        {
          id: "0xanotherorder789",
          asset_id: "tok_xyz",
          side: "SELL",
          price: "0.6",
          size: "7",
          type: "GTD",
        },
      ]),
    });

    const result = await handleGetOpenOrders(executor);
    expect(result).toContain("## Open Orders (2)");
    expect(result).toContain("BUY");
    expect(result).toContain("SELL");
    expect(result).toContain("$0.42");
    expect(result).toContain("$10.50");
    expect(result).toContain("GTC");
    expect(result).toContain("GTD");
    expect(result).toContain("0xorderabcd");
  });

  it("returns friendly error when client throws", async () => {
    executor.setMode("live");
    vi.spyOn(executor as any, "getClobClient").mockRejectedValue(new Error("boom"));
    const result = await handleGetOpenOrders(executor);
    expect(result).toContain("Could not fetch open orders");
  });
});
