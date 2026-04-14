import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../../src/utils/license.js", () => ({
  checkLicense: vi.fn().mockResolvedValue(true),
  requirePro: vi.fn((name: string) => `${name} requires Pro`),
}));

vi.mock("../../src/utils/fetch.js", () => ({
  fetchWithRetry: vi.fn(async (url: string) => globalThis.fetch(url)),
}));

import { handleFeaturedMarkets } from "../../src/tools/featured-markets.js";

describe("handleFeaturedMarkets", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders featured markets table sorted by liquidity", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json([
        {
          question: "Will BTC hit 100k?",
          endDate: "2026-04-10T00:00:00Z",
          liquidity: "12000",
          volume: "50000",
          outcomePrices: "[\"0.65\",\"0.35\"]",
        },
        {
          question: "Will ETH hit 5k?",
          endDate: "2026-04-12T00:00:00Z",
          liquidity: "8000",
          volume: "30000",
          outcomePrices: "[\"0.40\",\"0.60\"]",
        },
      ]),
    );

    const result = await handleFeaturedMarkets({ limit: 15 });

    expect(result).toContain("Featured Markets");
    expect(result).toContain("All");
    expect(result).toContain("(2)");
    expect(result).toContain("Sorted by liquidity");
    expect(result).toContain("Will BTC hit 100k?");
    expect(result).toContain("Will ETH hit 5k?");
    expect(result).toContain("$0.65");
    expect(result).toContain("$0.40");
  });

  it("includes order=liquidity and tag in URL when category is set", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([]));

    await handleFeaturedMarkets({ category: "politics", limit: 10 });

    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("order=liquidity");
    expect(url).toContain("ascending=false");
    expect(url).toContain("limit=10");
    expect(url).toContain("tag=politics");
  });

  it("formats liquidity and volume with k suffix when large", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json([
        {
          question: "Big liquidity market",
          liquidity: "15500",
          volume: "234000",
          outcomePrices: "[\"0.50\",\"0.50\"]",
        },
      ]),
    );

    const result = await handleFeaturedMarkets({ limit: 15 });

    expect(result).toContain("$15.5k");
    expect(result).toContain("$234.0k");
  });

  it("uppercases the category label in the heading", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json([
        { question: "Sport market", liquidity: "100", volume: "100", outcomePrices: "[\"0.5\",\"0.5\"]" },
      ]),
    );

    const result = await handleFeaturedMarkets({ category: "sports", limit: 15 });

    expect(result).toContain("Featured Markets — Sports");
  });

  it("returns empty state when API returns no markets", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([]));

    const result = await handleFeaturedMarkets({ category: "crypto", limit: 15 });

    expect(result).toContain('No markets found for "crypto"');
  });

  it("returns generic error on non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 500 }));

    const result = await handleFeaturedMarkets({ limit: 15 });

    expect(result).toContain("Could not fetch markets");
  });

  it("returns unreachable message on rejected fetch", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("boom"));

    const result = await handleFeaturedMarkets({ limit: 15 });

    expect(result).toContain("Could not reach the Polymarket API");
  });
});
