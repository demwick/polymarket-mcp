import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../../src/utils/license.js", () => ({
  checkLicense: vi.fn().mockResolvedValue(true),
  requirePro: vi.fn((name: string) => `${name} requires Pro`),
}));

vi.mock("../../src/utils/fetch.js", () => ({
  fetchWithRetry: vi.fn(async (url: string) => globalThis.fetch(url)),
}));

import { handleFindRelated } from "../../src/tools/find-related.js";

describe("handleFindRelated", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders related markets table from query", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json([
        {
          question: "Will BTC hit 100k?",
          volume: "5000",
          endDate: "2026-04-10T00:00:00Z",
          conditionId: "0xaaa1234567890",
        },
        {
          question: "Will ETH hit 5k?",
          volume: "3000",
          endDate: "2026-04-12T00:00:00Z",
          conditionId: "0xbbb1234567890",
        },
      ]),
    );

    const result = await handleFindRelated({ query: "crypto", limit: 10 });

    expect(result).toContain('Related Markets: "crypto" (2)');
    expect(result).toContain("Will BTC hit 100k?");
    expect(result).toContain("Will ETH hit 5k?");
    expect(result).toContain("$5000");
  });

  it("requires either condition_id or query", async () => {
    const result = await handleFindRelated({ limit: 10 });
    expect(result).toContain("Provide a `condition_id` or `query`");
  });

  it("looks up tag from condition_id then searches", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("condition_id=0xsource")) {
        return Response.json([
          { tags: ["politics"], slug: "election-2026", question: "Election market", conditionId: "0xsource" },
        ]);
      }
      // Search call
      return Response.json([
        { question: "Other politics market", volume: "1000", endDate: "2026-05-01T00:00:00Z", conditionId: "0xother" },
      ]);
    });

    const result = await handleFindRelated({ condition_id: "0xsource", limit: 5 });

    const searchUrl = String(
      fetchSpy.mock.calls.find((c) => String(c[0]).includes("_q="))?.[0] ?? "",
    );
    expect(searchUrl).toContain("_q=politics");
    expect(searchUrl).toContain("limit=5");
    expect(result).toContain("Other politics market");
  });

  it("filters out the source condition_id from results", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("condition_id=0xself")) {
        return Response.json([
          { tags: ["btc"], slug: "self-market", question: "Self", conditionId: "0xself" },
        ]);
      }
      return Response.json([
        { question: "Self", volume: "100", conditionId: "0xself" },
        { question: "Other", volume: "500", conditionId: "0xother" },
      ]);
    });

    const result = await handleFindRelated({ condition_id: "0xself", limit: 10 });

    expect(result).toContain("Other");
    expect(result).toContain("Related Markets");
    // The "Self" row should be filtered out — only "Other" remains
    expect(result).toContain("(1)");
  });

  it("returns friendly message when no markets match", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([]));

    const result = await handleFindRelated({ query: "nothing", limit: 10 });

    expect(result).toContain('No related markets found for "nothing"');
  });

  it("returns API error message on non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 500 }));

    const result = await handleFindRelated({ query: "x", limit: 10 });

    expect(result).toContain("Could not reach the Polymarket API");
  });

  it("returns API error message on rejected fetch", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("boom"));

    const result = await handleFindRelated({ query: "x", limit: 10 });

    expect(result).toContain("Could not reach the Polymarket API");
  });

  it("encodes query into URL", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([]));

    await handleFindRelated({ query: "bitcoin halving", limit: 7 });

    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("_q=bitcoin%20halving");
    expect(url).toContain("limit=7");
    expect(url).toContain("closed=false");
  });
});
