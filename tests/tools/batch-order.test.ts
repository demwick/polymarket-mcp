import { describe, it, expect, beforeEach, vi } from "vitest";
import Database from "better-sqlite3";
import { TradeExecutor } from "../../src/services/trade-executor.js";
import { getTradeHistory } from "../../src/db/queries.js";
import {
  makeTestDb,
  makePreviewExecutor,
  makeFakeMarket,
  seedPosition,
} from "../helpers/fixtures.js";

vi.mock("../../src/utils/license.js", () => ({
  checkLicense: vi.fn().mockResolvedValue(true),
  requirePro: vi.fn((name: string) => `${name} requires Pro`),
  resetLicenseCache: vi.fn(),
}));

vi.mock("../../src/services/market-resolver.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/services/market-resolver.js")>(
    "../../src/services/market-resolver.js"
  );
  return { ...actual, resolveMarketByConditionId: vi.fn() };
});

import { handleBatchOrder, batchOrderSchema } from "../../src/tools/batch-order.js";
import { resolveMarketByConditionId } from "../../src/services/market-resolver.js";

const mockResolve = vi.mocked(resolveMarketByConditionId);

describe("handleBatchOrder", () => {
  let db: Database.Database;
  let executor: TradeExecutor;

  beforeEach(() => {
    db = makeTestDb();
    executor = makePreviewExecutor(db);
    mockResolve.mockReset();
    mockResolve.mockResolvedValue(
      makeFakeMarket({ slug: "market-one", tokenId: "tok-one" })
    );
  });

  it("executes all orders on the happy path and reports succeeded count", async () => {
    const result = await handleBatchOrder(db, executor, {
      orders: [
        { condition_id: "0xc1", amount: 5, price: 0.5, side: "BUY" },
        { condition_id: "0xc2", amount: 4, price: 0.6, side: "BUY" },
      ],
    });

    expect(result).toContain("Batch Order Results");
    expect(result).toContain("**2** succeeded");
    expect(result).toContain("**0** failed");
    expect(result).toContain("market-one");

    const trades = getTradeHistory(db, { limit: 10 });
    expect(trades).toHaveLength(2);
    expect(trades.every((t) => t.side === "BUY")).toBe(true);
  });

  it("marks individual rows as failed when market resolution returns null", async () => {
    mockResolve
      .mockResolvedValueOnce(makeFakeMarket({ slug: "good", tokenId: "tg" }))
      .mockResolvedValueOnce(null);

    const result = await handleBatchOrder(db, executor, {
      orders: [
        { condition_id: "0xgood", amount: 5, side: "BUY" },
        { condition_id: "0xbadbadbadbad", amount: 5, side: "BUY" },
      ],
    });

    expect(result).toContain("**1** succeeded");
    expect(result).toContain("**1** failed");
    expect(result).toContain("Could not resolve market");
  });

  it("rejects BUY orders that violate safety limits and continues with the rest", async () => {
    const result = await handleBatchOrder(db, executor, {
      orders: [
        { condition_id: "0xc1", amount: 9999, side: "BUY" },
        { condition_id: "0xc2", amount: 5, side: "BUY" },
      ],
    });

    expect(result).toContain("**1** succeeded");
    expect(result).toContain("**1** failed");
    expect(result).toContain("Safety:");

    const trades = getTradeHistory(db, { limit: 10 });
    expect(trades).toHaveLength(1);
  });

  it("skips safety check for SELL orders and routes them to executeSell", async () => {
    seedPosition(db, {
      condition_id: "0xc1",
      token_id: "tok-one",
      market_slug: "market-one",
      amount: 6,
    });

    const result = await handleBatchOrder(db, executor, {
      orders: [{ condition_id: "0xc1", amount: 6, price: 0.7, side: "SELL" }],
    });

    expect(result).toContain("**1** succeeded");
    expect(result).toContain("SELL");

    const trades = getTradeHistory(db, { limit: 10 });
    const sellRow = trades.find((t) => t.side === "SELL");
    expect(sellRow).toBeDefined();
    expect(sellRow!.price).toBe(0.7);
  });

  it("captures thrown errors as failed rows without crashing", async () => {
    mockResolve.mockRejectedValueOnce(new Error("network exploded"));

    const result = await handleBatchOrder(db, executor, {
      orders: [{ condition_id: "0xboom", amount: 5, side: "BUY" }],
    });

    expect(result).toContain("**0** succeeded");
    expect(result).toContain("**1** failed");
    expect(result).toContain("network exploded");
  });

  it("uses default price 0.5 when none is supplied", async () => {
    const result = await handleBatchOrder(db, executor, {
      orders: [{ condition_id: "0xc1", amount: 3, side: "BUY" }],
    });

    expect(result).toContain("**1** succeeded");
    expect(result).toContain("BUY $3 @ $0.50");

    const trades = getTradeHistory(db, { limit: 10 });
    expect(trades[0].side).toBe("BUY");
    expect(trades[0].price).toBe(0.5);
  });

  it("Zod schema parses an order without explicit side and defaults to BUY", () => {
    const parsed = batchOrderSchema.parse({
      orders: [{ condition_id: "0xc1", amount: 3 }],
    });
    expect(parsed.orders[0].side).toBe("BUY");
  });
});
