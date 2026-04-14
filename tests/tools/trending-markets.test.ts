import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../../src/utils/license.js", () => ({
  checkLicense: vi.fn().mockResolvedValue(true),
  requirePro: vi.fn((name: string) => `${name} requires Pro`),
}));

vi.mock("../../src/utils/fetch.js", () => ({
  fetchWithRetry: vi.fn(async (url: string) => globalThis.fetch(url)),
}));

import { handleTrendingMarkets } from "../../src/tools/trending-markets.js";

describe("handleTrendingMarkets", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders trending markets table from API", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json([
        {
          question: "Will BTC hit 100k?",
          endDate: "2026-04-10T00:00:00Z",
          volume24hr: "5000",
          outcomePrices: "[\"0.65\",\"0.35\"]",
        },
        {
          question: "Will ETH merge succeed?",
          endDate: "2026-04-12T00:00:00Z",
          volume24hr: "3000",
          outcomePrices: "[\"0.80\",\"0.20\"]",
        },
      ]),
    );

    const result = await handleTrendingMarkets({ period: "24h", limit: 15 });

    expect(result).toContain("Trending Markets (24h)");
    expect(result).toContain("Will BTC hit 100k?");
    expect(result).toContain("Will ETH merge succeed?");
    expect(result).toContain("$0.65");
    expect(result).toContain("$0.80");
  });

  it("uses period-specific volume field in URL", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([]));

    await handleTrendingMarkets({ period: "7d", limit: 10 });

    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("order=volume1wk");
    expect(url).toContain("ascending=false");
    expect(url).toContain("limit=10");
  });

  it("formats large volume with k suffix", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json([
        {
          question: "Big market",
          volume24hr: "12345",
          outcomePrices: "[\"0.50\",\"0.50\"]",
        },
      ]),
    );

    const result = await handleTrendingMarkets({ period: "24h", limit: 15 });

    expect(result).toContain("$12.3k");
  });

  it("returns empty state when API returns no markets", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([]));

    const result = await handleTrendingMarkets({ period: "24h", limit: 15 });

    expect(result).toContain("No trending markets found");
  });

  it("looks up tag id from slug and includes tag_id in URL", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/tags/slug/crypto")) {
        return Response.json({ id: 21 });
      }
      return Response.json([
        {
          question: "Crypto market",
          volume24hr: "1000",
          outcomePrices: "[\"0.5\",\"0.5\"]",
        },
      ]);
    });

    const result = await handleTrendingMarkets({ period: "24h", category: "crypto", limit: 5 });

    const marketsCall = fetchSpy.mock.calls.find((c) => String(c[0]).includes("/markets?"));
    expect(marketsCall).toBeDefined();
    const marketsUrl = String(marketsCall![0]);
    expect(marketsUrl).toContain("tag_id=21");
    expect(marketsUrl).toContain("related_tags=true");
    expect(result).toContain("Category: crypto");
  });

  it("returns unknown category message when tag lookup fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 404 }));

    const result = await handleTrendingMarkets({ period: "24h", category: "bogus", limit: 5 });

    expect(result).toContain('Unknown category "bogus"');
  });

  it("returns generic error on non-ok markets response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 500 }));

    const result = await handleTrendingMarkets({ period: "24h", limit: 15 });

    expect(result).toContain("Could not fetch trending markets");
  });

  it("returns unreachable message on rejected fetch", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("boom"));

    const result = await handleTrendingMarkets({ period: "24h", limit: 15 });

    expect(result).toContain("Could not reach the Polymarket API");
  });
});
