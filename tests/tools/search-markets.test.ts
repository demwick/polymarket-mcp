import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../../src/utils/license.js", () => ({
  checkLicense: vi.fn().mockResolvedValue(true),
  requirePro: vi.fn((name: string) => `${name} requires Pro`),
}));

vi.mock("../../src/utils/fetch.js", () => ({
  fetchWithRetry: vi.fn(async (url: string) => globalThis.fetch(url)),
}));

import { handleSearchMarkets } from "../../src/tools/search-markets.js";

describe("handleSearchMarkets", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders markets table from API events", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        events: [
          {
            markets: [
              {
                question: "Will BTC hit 100k?",
                endDate: "2026-04-10T00:00:00Z",
                volume: "5000",
                conditionId: "0xbtc",
                closed: false,
              },
              {
                question: "Will ETH hit 5k?",
                endDate: "2026-04-12T00:00:00Z",
                volume: "3000",
                conditionId: "0xeth",
                closed: false,
              },
            ],
          },
        ],
      }),
    );

    const result = await handleSearchMarkets({ query: "crypto", limit: 10, active_only: true });

    expect(result).toContain('Markets matching "crypto" (2)');
    expect(result).toContain("Will BTC hit 100k?");
    expect(result).toContain("Will ETH hit 5k?");
    expect(result).toContain("`0xbtc`");
    expect(result).toContain("`0xeth`");
  });

  it("sorts markets by volume descending and respects limit", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        events: [
          {
            markets: [
              { question: "Low vol", volume: "100", conditionId: "0xa", closed: false },
              { question: "High vol", volume: "9000", conditionId: "0xb", closed: false },
              { question: "Mid vol", volume: "500", conditionId: "0xc", closed: false },
            ],
          },
        ],
      }),
    );

    const result = await handleSearchMarkets({ query: "x", limit: 2, active_only: true });

    expect(result).toContain("Markets matching \"x\" (2)");
    expect(result).toContain("High vol");
    expect(result).toContain("Mid vol");
    expect(result).not.toContain("Low vol");
    const highIdx = result.indexOf("High vol");
    const midIdx = result.indexOf("Mid vol");
    expect(highIdx).toBeLessThan(midIdx);
  });

  it("filters out closed markets when active_only is true", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        events: [
          {
            markets: [
              { question: "Open market", volume: "1000", conditionId: "0x1", closed: false },
              { question: "Closed market", volume: "9000", conditionId: "0x2", closed: true },
            ],
          },
        ],
      }),
    );

    const result = await handleSearchMarkets({ query: "x", limit: 10, active_only: true });

    expect(result).toContain("Open market");
    expect(result).not.toContain("Closed market");
  });

  it("returns friendly message when no markets found", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ events: [] }));

    const result = await handleSearchMarkets({ query: "nothing", limit: 10, active_only: true });

    expect(result).toContain('No markets found for "nothing"');
  });

  it("returns unavailable message on non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 500 }));

    const result = await handleSearchMarkets({ query: "x", limit: 10, active_only: true });

    expect(result).toContain("Market search unavailable");
  });

  it("returns unreachable message on rejected fetch", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("boom"));

    const result = await handleSearchMarkets({ query: "x", limit: 10, active_only: true });

    expect(result).toContain("Could not reach the Polymarket API");
  });

  it("encodes query and includes events_status when active_only", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ events: [] }));

    await handleSearchMarkets({ query: "bitcoin halving", limit: 5, active_only: true });

    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("/public-search?q=bitcoin%20halving");
    expect(url).toContain("limit_per_type=5");
    expect(url).toContain("events_status=active");
  });
});
