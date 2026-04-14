import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../../src/utils/license.js", () => ({
  checkLicense: vi.fn().mockResolvedValue(true),
  requirePro: vi.fn((name: string) => `${name} requires Pro`),
}));

vi.mock("../../src/utils/fetch.js", () => ({
  fetchWithRetry: vi.fn(async (url: string) => globalThis.fetch(url)),
}));

import { handleCompareMarkets } from "../../src/tools/compare-markets.js";

// Helpers to build CLOB API responses consumed by price-service / market-filter
function clobMarketResponse(conditionId: string, yesTokenId: string, yesPrice: number) {
  return Response.json({
    condition_id: conditionId,
    tokens: [
      { token_id: yesTokenId, outcome: "Yes", price: yesPrice },
      { token_id: `${yesTokenId}-no`, outcome: "No", price: 1 - yesPrice },
    ],
  });
}

function clobBookResponse(bestBid: number, bestAsk: number, depth = 1000) {
  // size * price = depth → size = depth / price
  return Response.json({
    bids: [{ price: bestBid.toString(), size: (depth / bestBid).toString() }],
    asks: [{ price: bestAsk.toString(), size: (depth / bestAsk).toString() }],
  });
}

describe("handleCompareMarkets", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders comparison table for multiple condition ids", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/markets/0xcond1")) {
        return clobMarketResponse("0xcond1", "tok1", 0.6);
      }
      if (url.includes("/markets/0xcond2")) {
        return clobMarketResponse("0xcond2", "tok2", 0.4);
      }
      if (url.includes("token_id=tok1")) {
        return clobBookResponse(0.59, 0.61);
      }
      if (url.includes("token_id=tok2")) {
        return clobBookResponse(0.39, 0.42);
      }
      return new Response(null, { status: 404 });
    });

    const result = await handleCompareMarkets({
      condition_ids: ["0xcond1", "0xcond2"],
    });

    expect(result).toContain("Market Comparison (2)");
    expect(result).toContain("$0.6000");
    expect(result).toContain("$0.4000");
    expect(result).toContain("Bid");
    expect(result).toContain("Ask");
    expect(result).toContain("Spread");
    expect(result).toContain("Quality");
  });

  it("picks the market with tightest spread as best liquidity", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/markets/0xtight")) {
        return clobMarketResponse("0xtight", "toktight", 0.5);
      }
      if (url.includes("/markets/0xwide")) {
        return clobMarketResponse("0xwide", "tokwide", 0.5);
      }
      if (url.includes("token_id=toktight")) {
        return clobBookResponse(0.499, 0.501);
      }
      if (url.includes("token_id=tokwide")) {
        return clobBookResponse(0.45, 0.55);
      }
      return new Response(null, { status: 404 });
    });

    const result = await handleCompareMarkets({
      condition_ids: ["0xtight", "0xwide"],
    });

    expect(result).toContain("Best liquidity:");
    expect(result).toContain("0xtight");
  });

  it("returns fallback when none of the markets resolve", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 404 }));

    const result = await handleCompareMarkets({
      condition_ids: ["0xbad1", "0xbad2"],
    });

    expect(result).toContain("Could not resolve any of the provided markets");
  });

  it("filters out unresolvable markets but renders the rest", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/markets/0xgood")) {
        return clobMarketResponse("0xgood", "tokgood", 0.5);
      }
      if (url.includes("token_id=tokgood")) {
        return clobBookResponse(0.49, 0.51);
      }
      // Anything else fails
      return new Response(null, { status: 404 });
    });

    const result = await handleCompareMarkets({
      condition_ids: ["0xgood", "0xbad"],
    });

    expect(result).toContain("Market Comparison (1)");
    expect(result).toContain("0xgood");
  });

  it("forwards condition ids into CLOB market URLs", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/markets/0xaaa")) {
        return clobMarketResponse("0xaaa", "tokA", 0.3);
      }
      if (url.includes("/markets/0xbbb")) {
        return clobMarketResponse("0xbbb", "tokB", 0.7);
      }
      if (url.includes("token_id=tokA") || url.includes("token_id=tokB")) {
        return clobBookResponse(0.49, 0.51);
      }
      return new Response(null, { status: 404 });
    });

    await handleCompareMarkets({ condition_ids: ["0xaaa", "0xbbb"] });

    const calledUrls = fetchSpy.mock.calls.map((c) => String(c[0]));
    expect(calledUrls.some((u) => u.includes("/markets/0xaaa"))).toBe(true);
    expect(calledUrls.some((u) => u.includes("/markets/0xbbb"))).toBe(true);
  });
});
