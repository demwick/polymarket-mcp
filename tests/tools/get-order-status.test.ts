import { describe, it, expect, beforeEach, vi } from "vitest";
import Database from "better-sqlite3";
import { TradeExecutor } from "../../src/services/trade-executor.js";
import { handleGetOrderStatus } from "../../src/tools/get-order-status.js";
import { makeTestDb } from "../helpers/fixtures.js";

describe("handleGetOrderStatus", () => {
  let db: Database.Database;
  let executor: TradeExecutor;

  beforeEach(() => {
    db = makeTestDb();
    executor = new TradeExecutor(db, "preview");
  });

  it("rejects in preview mode", async () => {
    const result = await handleGetOrderStatus(executor, { order_id: "0xabc" });
    expect(result).toContain("only available in live mode");
  });

  it("reports 'not found' when client returns null", async () => {
    executor.setMode("live");
    vi.spyOn(executor as any, "getClobClient").mockResolvedValue({
      getOrder: vi.fn().mockResolvedValue(null),
    });
    const result = await handleGetOrderStatus(executor, { order_id: "0xmissing" });
    expect(result).toContain("0xmissing");
    expect(result).toContain("not found");
  });

  it("renders order details for happy path", async () => {
    executor.setMode("live");
    vi.spyOn(executor as any, "getClobClient").mockResolvedValue({
      getOrder: vi.fn().mockResolvedValue({
        id: "0xorder1",
        status: "LIVE",
        side: "BUY",
        price: "0.4321",
        original_size: "12",
        size_matched: "5",
        order_type: "GTC",
        created_at: "2025-01-01T00:00:00Z",
      }),
    });

    const result = await handleGetOrderStatus(executor, { order_id: "0xorder1" });
    expect(result).toContain("## Order Status");
    expect(result).toContain("0xorder1");
    expect(result).toContain("LIVE");
    expect(result).toContain("BUY");
    expect(result).toContain("$0.4321");
    expect(result).toContain("$12.00");
    expect(result).toContain("$5.00");
    expect(result).toContain("GTC");
    expect(result).toContain("2025-01-01T00:00:00Z");
  });

  it("falls back to alt field names (size, type, timestamp, order_status)", async () => {
    executor.setMode("live");
    vi.spyOn(executor as any, "getClobClient").mockResolvedValue({
      getOrder: vi.fn().mockResolvedValue({
        order_status: "FILLED",
        side: "SELL",
        price: "0.7",
        size: "3",
        type: "GTD",
        timestamp: "2025-02-02T12:00:00Z",
      }),
    });

    const result = await handleGetOrderStatus(executor, { order_id: "0xfallback" });
    expect(result).toContain("0xfallback");
    expect(result).toContain("FILLED");
    expect(result).toContain("SELL");
    expect(result).toContain("$0.7000");
    expect(result).toContain("$3.00");
    expect(result).toContain("GTD");
    expect(result).toContain("2025-02-02T12:00:00Z");
  });

  it("returns friendly error when client throws", async () => {
    executor.setMode("live");
    vi.spyOn(executor as any, "getClobClient").mockRejectedValue(new Error("network"));
    const result = await handleGetOrderStatus(executor, { order_id: "0xabc" });
    expect(result).toContain("Could not fetch order status");
  });
});
