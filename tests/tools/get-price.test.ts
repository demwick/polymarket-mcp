import { describe, it, expect, beforeEach, vi } from "vitest";
import Database from "better-sqlite3";
import { initializeDb } from "../../src/db/schema.js";
import { handleGetPrice } from "../../src/tools/get-price.js";
import { recordTrade } from "../../src/db/queries.js";

vi.mock("../../src/services/price-service.js", () => ({
  getMarketPriceByCondition: vi.fn().mockResolvedValue({ price: 0.65, tokenId: "tok_abc" }),
  getMarketPrice: vi.fn().mockResolvedValue({
    tokenId: "tok_abc",
    bid: 0.63,
    ask: 0.67,
    mid: 0.65,
    spread: 0.04,
    lastPrice: 0.65,
  }),
}));

import { getMarketPriceByCondition, getMarketPrice } from "../../src/services/price-service.js";
const mockPriceByCondition = vi.mocked(getMarketPriceByCondition);
const mockPrice = vi.mocked(getMarketPrice);

describe("handleGetPrice", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    initializeDb(db);
  });

  it("returns order book price for condition_id", async () => {
    const result = await handleGetPrice(db, { condition_id: "cond123", show_positions: false });
    expect(result).toContain("Market Price");
    expect(result).toContain("Bid");
    expect(result).toContain("Ask");
    expect(result).toContain("$0.63");
    expect(result).toContain("$0.67");
  });

  it("falls back to gamma price when CLOB unavailable", async () => {
    mockPrice.mockResolvedValue(null);

    const result = await handleGetPrice(db, { condition_id: "cond123", show_positions: false });
    expect(result).toContain("$0.65");
    expect(result).toContain("gamma API");
  });

  it("returns error when condition price unavailable", async () => {
    mockPriceByCondition.mockResolvedValue(null);

    const result = await handleGetPrice(db, { condition_id: "cond_bad", show_positions: false });
    expect(result).toContain("Could not fetch price");
  });

  it("shows position prices with mark-to-market", async () => {
    recordTrade(db, {
      trader_address: "0x1",
      market_slug: "position-market",
      condition_id: "cond_pos",
      token_id: "tok1",
      side: "BUY",
      price: 0.5,
      amount: 10,
      original_amount: 20,
      mode: "preview",
      status: "simulated",
    });

    mockPriceByCondition.mockResolvedValue({ price: 0.65, tokenId: "tok1" });

    const result = await handleGetPrice(db, { show_positions: true });
    expect(result).toContain("Position Prices");
    expect(result).toContain("position-market");
    expect(result).toContain("$0.50");
    expect(result).toContain("$0.65");
  });

  it("returns message when no positions and show_positions=true", async () => {
    const result = await handleGetPrice(db, { show_positions: true });
    expect(result).toContain("No open positions");
  });

  it("returns hint when no params provided", async () => {
    const result = await handleGetPrice(db, { show_positions: false });
    expect(result).toContain("condition_id");
  });
});
