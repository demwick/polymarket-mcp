import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../../src/utils/fetch.js", () => ({
  fetchWithRetry: vi.fn(async (url: string) => globalThis.fetch(url)),
}));

import { getMarketPrice, getMarketPriceByCondition } from "../../src/services/price-service.js";

describe("getMarketPrice", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns best bid/ask regardless of array order (CLOB sorts bids asc, asks desc)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        bids: [{ price: "0.40" }, { price: "0.42" }, { price: "0.45" }], // ascending → best is last
        asks: [{ price: "0.55" }, { price: "0.50" }, { price: "0.47" }], // descending → best is last
      })
    );

    const result = await getMarketPrice("tok123");
    expect(result).not.toBeNull();
    expect(result!.bid).toBe(0.45);
    expect(result!.ask).toBe(0.47);
    expect(result!.mid).toBeCloseTo(0.46, 4);
    expect(result!.spread).toBeCloseTo(0.02, 4);
    expect(result!.tokenId).toBe("tok123");
  });

  it("handles empty order book", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ bids: [], asks: [] })
    );

    const result = await getMarketPrice("tok_empty");
    expect(result).not.toBeNull();
    expect(result!.bid).toBe(0);
    expect(result!.ask).toBe(0);
    expect(result!.mid).toBe(0);
    expect(result!.spread).toBe(0);
  });

  it("handles bids-only book", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ bids: [{ price: "0.50" }], asks: [] })
    );

    const result = await getMarketPrice("tok_bid");
    expect(result).not.toBeNull();
    expect(result!.bid).toBe(0.5);
    expect(result!.ask).toBe(0);
    expect(result!.mid).toBe(0.5);
  });

  it("returns null on API error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 500 }));
    const result = await getMarketPrice("tok_err");
    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fail"));
    const result = await getMarketPrice("tok_err");
    expect(result).toBeNull();
  });
});

describe("getMarketPriceByCondition", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns yes-side price and token from CLOB market response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        condition_id: "cond123",
        tokens: [
          { token_id: "tok_yes", outcome: "Yes", price: 0.65 },
          { token_id: "tok_no", outcome: "No", price: 0.35 },
        ],
      })
    );

    const result = await getMarketPriceByCondition("cond123");
    expect(result).not.toBeNull();
    expect(result!.price).toBeCloseTo(0.65, 4);
    expect(result!.tokenId).toBe("tok_yes");
  });

  it("returns null when tokens array is missing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ condition_id: "cond123" }));
    const result = await getMarketPriceByCondition("cond123");
    expect(result).toBeNull();
  });

  it("returns null when yes token is missing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        condition_id: "cond123",
        tokens: [{ token_id: "tok_no", outcome: "No", price: 0.8 }],
      })
    );
    const result = await getMarketPriceByCondition("cond123");
    expect(result).toBeNull();
  });

  it("returns null on API failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 500 }));
    const result = await getMarketPriceByCondition("cond_err");
    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fail"));
    const result = await getMarketPriceByCondition("cond_err");
    expect(result).toBeNull();
  });

  it("handles missing price field with 0", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        condition_id: "cond123",
        tokens: [
          { token_id: "tok_yes", outcome: "Yes" },
          { token_id: "tok_no", outcome: "No" },
        ],
      })
    );

    const result = await getMarketPriceByCondition("cond123");
    expect(result).not.toBeNull();
    expect(result!.price).toBe(0);
    expect(result!.tokenId).toBe("tok_yes");
  });
});
