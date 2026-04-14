import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../../src/utils/license.js", () => ({
  checkLicense: vi.fn().mockResolvedValue(true),
  requirePro: vi.fn((name: string) => `${name} requires Pro`),
}));

vi.mock("../../src/utils/fetch.js", () => ({
  fetchWithRetry: vi.fn(async (url: string) => globalThis.fetch(url)),
}));

import { handleDiscoverMarkets } from "../../src/tools/discover-markets.js";

describe("handleDiscoverMarkets", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders markets table from API", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json([
        { question: "Will BTC hit 100k?", endDate: "2026-04-10T00:00:00Z", volume: "5000", outcomePrices: "0.65,0.35", slug: "btc-100k" },
        { question: "ETH merge success?", endDate: "2026-04-12T00:00:00Z", volume: "3000", outcomePrices: "0.80,0.20", slug: "eth-merge" },
      ])
    );

    const result = await handleDiscoverMarkets({
      ending: "this_week", limit: 20, min_volume: 100,
    });

    expect(result).toContain("Markets (2)");
    expect(result).toContain("Will BTC hit 100k?");
    expect(result).toContain("ETH merge success?");
  });

  it("filters by minimum volume", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json([
        { question: "Low vol market", volume: "50", outcomePrices: "0.50" },
        { question: "High vol market", volume: "5000", outcomePrices: "0.70" },
      ])
    );

    const result = await handleDiscoverMarkets({
      ending: "all", limit: 20, min_volume: 1000,
    });

    expect(result).toContain("Markets (1)");
    expect(result).toContain("High vol market");
    expect(result).not.toContain("Low vol market");
  });

  it("returns message when no markets match", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([]));

    const result = await handleDiscoverMarkets({
      ending: "today", limit: 20, min_volume: 100,
    });

    expect(result).toContain("No markets found");
  });

  it("handles API error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("API down"));

    const result = await handleDiscoverMarkets({
      ending: "today", limit: 20, min_volume: 100,
    });

    expect(result).toContain("Could not reach");
  });

  it("handles non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 500 }));

    const result = await handleDiscoverMarkets({
      ending: "today", limit: 20, min_volume: 100,
    });

    expect(result).toContain("Could not reach");
  });

  it("passes category filter", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([]));

    await handleDiscoverMarkets({
      ending: "all", limit: 10, min_volume: 0, category: "crypto",
    });

    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("tag=crypto");
  });

  it("renders Condition ID column with truncated preview and full value", async () => {
    const fullCid = "0xabcdef0123456789deadbeefcafebabe1234567890abcdef1234567890abcdef";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json([
        {
          question: "Has conditionId?",
          endDate: "2026-04-10T00:00:00Z",
          volume: "5000",
          outcomePrices: "0.6,0.4",
          conditionId: fullCid,
        },
      ])
    );

    const result = await handleDiscoverMarkets({
      ending: "this_week", limit: 20, min_volume: 100,
    });

    expect(result).toContain("Condition ID");
    // Truncated preview: first 12 chars + ellipsis
    expect(result).toContain("`" + fullCid.slice(0, 12) + "…`");
    // Full conditionId in parens for copy/paste
    expect(result).toContain(`(${fullCid})`);
  });

  it("renders gracefully when conditionId is missing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json([
        {
          question: "No cid market",
          endDate: "2026-04-10T00:00:00Z",
          volume: "5000",
          outcomePrices: "0.5,0.5",
          // conditionId intentionally absent
        },
      ])
    );

    const result = await handleDiscoverMarkets({
      ending: "this_week", limit: 20, min_volume: 100,
    });

    // Must not throw, must still include the market row
    expect(result).toContain("No cid market");
    // Missing cid should surface as empty backtick + empty parens, not the
    // string "undefined" (which would be a symptom of the fallback breaking).
    expect(result).not.toContain("undefined");
    expect(result).toContain("`…`");
    expect(result).toContain("()");
  });

  it("data rows have 6 pipe-delimited columns matching the header", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json([
        {
          question: "Aligned row",
          endDate: "2026-04-10T00:00:00Z",
          volume: "5000",
          outcomePrices: "0.6,0.4",
          conditionId: "0xabc123",
        },
      ])
    );

    const result = await handleDiscoverMarkets({
      ending: "this_week", limit: 20, min_volume: 100,
    });

    const lines = result.split("\n").filter((l) => l.startsWith("|"));
    // header + separator + 1 data row
    expect(lines).toHaveLength(3);
    // Each line: 6 columns → 7 pipe characters (leading + 5 interior + trailing)
    for (const line of lines) {
      const pipeCount = (line.match(/\|/g) ?? []).length;
      expect(pipeCount).toBe(7);
    }
  });
});
