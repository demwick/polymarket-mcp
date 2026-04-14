import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../../src/utils/license.js", () => ({
  checkLicense: vi.fn().mockResolvedValue(true),
  requirePro: vi.fn((name: string) => `${name} requires Pro`),
}));

vi.mock("../../src/utils/fetch.js", () => ({
  fetchWithRetry: vi.fn(async (url: string) => globalThis.fetch(url)),
}));

import { handleDetectArbitrage } from "../../src/tools/detect-arbitrage.js";

describe("handleDetectArbitrage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders arbitrage opportunities above the spread threshold", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json([
        {
          conditionId: "0xover",
          question: "Overpriced market",
          outcomePrices: "[\"0.60\",\"0.55\"]", // total 1.15 → 15% over
          clobTokenIds: "[\"tok-yes\",\"tok-no\"]",
          outcomes: "[\"Yes\",\"No\"]",
        },
        {
          conditionId: "0xunder",
          question: "Underpriced market",
          outcomePrices: "[\"0.40\",\"0.50\"]", // total 0.90 → 10% under
          clobTokenIds: "[\"tok-y2\",\"tok-n2\"]",
          outcomes: "[\"Yes\",\"No\"]",
        },
      ]),
    );

    const result = await handleDetectArbitrage({ limit: 50, min_spread: 0.02 });

    expect(result).toContain("Arbitrage Scanner");
    expect(result).toContain("Overpriced market");
    expect(result).toContain("Underpriced market");
    expect(result).toContain("overpriced");
    expect(result).toContain("underpriced");
    // Sorted by spread desc → 15% should appear before 10%
    expect(result.indexOf("Overpriced market")).toBeLessThan(result.indexOf("Underpriced market"));
  });

  it("filters out opportunities below the min_spread threshold", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json([
        {
          conditionId: "0xtight",
          question: "Tight market",
          outcomePrices: "[\"0.50\",\"0.51\"]", // total 1.01 → 1% spread
          clobTokenIds: "[\"a\",\"b\"]",
          outcomes: "[\"Yes\",\"No\"]",
        },
        {
          conditionId: "0xloose",
          question: "Loose market",
          outcomePrices: "[\"0.60\",\"0.50\"]", // total 1.10 → 10%
          clobTokenIds: "[\"c\",\"d\"]",
          outcomes: "[\"Yes\",\"No\"]",
        },
      ]),
    );

    const result = await handleDetectArbitrage({ limit: 50, min_spread: 0.05 });

    expect(result).toContain("Loose market");
    expect(result).not.toContain("Tight market");
  });

  it("returns no-opportunities message when nothing qualifies", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([]));

    const result = await handleDetectArbitrage({ limit: 50, min_spread: 0.02 });

    expect(result).toContain("No arbitrage opportunities found");
    expect(result).toContain("top 50");
  });

  it("returns no-opportunities message when API errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 500 }));

    const result = await handleDetectArbitrage({ limit: 25, min_spread: 0.02 });

    expect(result).toContain("No arbitrage opportunities");
  });

  it("forwards limit into the markets URL", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([]));

    await handleDetectArbitrage({ limit: 75, min_spread: 0.03 });

    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("limit=75");
    expect(url).toContain("order=volume");
  });

  it("handles rejected fetch gracefully", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("boom"));

    const result = await handleDetectArbitrage({ limit: 50, min_spread: 0.02 });

    expect(result).toContain("No arbitrage opportunities");
  });
});
