import { describe, it, expect, beforeEach, vi } from "vitest";
import Database from "better-sqlite3";
import { TradeExecutor } from "../../src/services/trade-executor.js";
import { recordTrade, getTradeHistory } from "../../src/db/queries.js";
import { makeTestDb } from "../helpers/fixtures.js";
import type { WtaMarket } from "../../src/services/wta-discovery.js";

vi.mock("../../src/utils/license.js", () => ({
  checkLicense: vi.fn().mockResolvedValue(true),
  requirePro: vi.fn((name: string) => `${name} requires Pro`),
  resetLicenseCache: vi.fn(),
}));

vi.mock("../../src/services/wta-discovery.js", () => ({
  discoverWtaMarkets: vi.fn(),
}));

import { handlePlaceStinkBid } from "../../src/tools/place-stink-bid.js";
import { checkLicense } from "../../src/utils/license.js";
import { discoverWtaMarkets } from "../../src/services/wta-discovery.js";

const mockLicense = vi.mocked(checkLicense);
const mockDiscover = vi.mocked(discoverWtaMarkets);

function fakeWtaMarket(overrides: Partial<WtaMarket> = {}): WtaMarket {
  return {
    conditionId: "0xcondA",
    question: "Madrid: Sabalenka vs Swiatek",
    slug: "wta-sabalenk-swiatek-2026-04-13",
    favoriteOutcome: "Swiatek",
    favoritePrice: 0.7,
    favoriteTokenId: "tok_fav_a",
    underdogOutcome: "Sabalenka",
    underdogPrice: 0.3,
    underdogTokenId: "tok_dog_a",
    stinkBidPrice: 0.49,
    tickSize: "0.01",
    negRisk: false,
    closed: false,
    ...overrides,
  };
}

describe("handlePlaceStinkBid", () => {
  let db: Database.Database;
  let executor: TradeExecutor;

  beforeEach(() => {
    db = makeTestDb();
    executor = new TradeExecutor(db, "preview");
    mockLicense.mockResolvedValue(true);
    mockDiscover.mockReset();
  });

  it("requires Pro license", async () => {
    mockLicense.mockResolvedValue(false);
    const result = await handlePlaceStinkBid(db, executor, { discount_pct: 30, bet_size: 5 });
    expect(result).toContain("Pro");
  });

  it("returns message when no markets found", async () => {
    mockDiscover.mockResolvedValue([]);
    const result = await handlePlaceStinkBid(db, executor, { discount_pct: 30, bet_size: 5 });
    expect(result).toContain("No WTA markets found");
  });

  it("places bid for a fresh market and records trade", async () => {
    mockDiscover.mockResolvedValue([fakeWtaMarket()]);
    const result = await handlePlaceStinkBid(db, executor, { discount_pct: 30, bet_size: 5 });

    expect(result).toContain("## Stink Bid Results");
    expect(result).toContain("Discount: 30%");
    expect(result).toContain("$5");
    expect(result).toContain("Bid placed");
    expect(result).toContain("Swiatek");
    expect(result).toContain("$0.490");
    expect(result).toContain("**Summary:** 1 bids placed, 0 skipped");

    const trades = getTradeHistory(db, { limit: 10 });
    expect(trades).toHaveLength(1);
    expect(trades[0].token_id).toBe("tok_fav_a");
    expect(trades[0].price).toBe(0.49);
    expect(trades[0].amount).toBe(5);
  });

  it("skips markets with an existing position", async () => {
    recordTrade(db, {
      trader_address: "0xabc",
      market_slug: "old",
      condition_id: "0xcondA",
      token_id: "tok_existing",
      side: "BUY",
      price: 0.5,
      amount: 10,
      original_amount: 10,
      mode: "preview",
      status: "simulated",
    });
    mockDiscover.mockResolvedValue([fakeWtaMarket()]);

    const result = await handlePlaceStinkBid(db, executor, { discount_pct: 30, bet_size: 5 });
    expect(result).toContain("Skipped (existing position)");
    expect(result).toContain("**Summary:** 0 bids placed, 1 skipped");
  });

  it("reports failures when executor returns failed status", async () => {
    mockDiscover.mockResolvedValue([fakeWtaMarket()]);
    vi.spyOn(executor, "execute").mockResolvedValue({
      tradeId: 0,
      mode: "preview",
      status: "failed",
      message: "tick size mismatch",
    });

    const result = await handlePlaceStinkBid(db, executor, { discount_pct: 30, bet_size: 5 });
    expect(result).toContain("Failed");
    expect(result).toContain("tick size mismatch");
    expect(result).toContain("**Summary:** 0 bids placed, 0 skipped, 1 failed");
  });

  it("processes multiple markets independently", async () => {
    mockDiscover.mockResolvedValue([
      fakeWtaMarket(),
      fakeWtaMarket({
        conditionId: "0xcondB",
        question: "Rome: Gauff vs Rybakina",
        slug: "wta-gauff-rybakin-2026-04-13",
        favoriteOutcome: "Gauff",
        favoritePrice: 0.6,
        favoriteTokenId: "tok_fav_b",
        stinkBidPrice: 0.42,
      }),
    ]);

    const result = await handlePlaceStinkBid(db, executor, { discount_pct: 30, bet_size: 5 });
    expect(result).toContain("**Summary:** 2 bids placed");
    const trades = getTradeHistory(db, { limit: 10 });
    expect(trades).toHaveLength(2);
  });
});
