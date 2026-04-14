import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../../src/utils/license.js", () => ({
  checkLicense: vi.fn().mockResolvedValue(true),
  requirePro: vi.fn((name: string) => `${name} requires Pro`),
}));

vi.mock("../../src/utils/fetch.js", () => ({
  fetchWithRetry: vi.fn(async (url: string) => globalThis.fetch(url)),
}));

import { handleGetTopHolders } from "../../src/tools/get-top-holders.js";

describe("handleGetTopHolders", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders top holders table from data API", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json([
        {
          proxyWallet: "0xaaaaaaaaaaaa1111",
          size: "5000",
          avgPrice: "0.45",
          currentValue: "6000",
          outcome: "Yes",
        },
        {
          proxyWallet: "0xbbbbbbbbbbbb2222",
          size: "3000",
          avgPrice: "0.50",
          currentValue: "3500",
          outcome: "No",
        },
      ]),
    );

    const result = await handleGetTopHolders({ condition_id: "0xcond", limit: 10 });

    expect(result).toContain("Top Holders (2)");
    expect(result).toContain("0xaaaaaa..");
    expect(result).toContain("0xbbbbbb..");
    expect(result).toContain("$5000");
    expect(result).toContain("$3000");
    expect(result).toContain("$0.45");
    expect(result).toContain("Yes");
    expect(result).toContain("No");
    // Summary stats
    expect(result).toContain("Total held:");
    expect(result).toContain("$8000");
    expect(result).toContain("Avg entry:");
  });

  it("returns empty message when no holders", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([]));

    const result = await handleGetTopHolders({ condition_id: "0xcond", limit: 10 });

    expect(result).toContain("No position holders found");
  });

  it("returns API unavailable on non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 500 }));

    const result = await handleGetTopHolders({ condition_id: "0xcond", limit: 10 });

    expect(result).toContain("Could not fetch holder data");
  });

  it("returns unreachable message on rejected fetch", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("boom"));

    const result = await handleGetTopHolders({ condition_id: "0xcond", limit: 10 });

    expect(result).toContain("Could not reach the Polymarket API");
  });

  it("forwards condition_id and limit into the URL", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([]));

    await handleGetTopHolders({ condition_id: "0xspecific", limit: 25 });

    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("market=0xspecific");
    expect(url).toContain("limit=25");
    expect(url).toContain("sortBy=CURRENT");
  });

  it("falls back to user field when proxyWallet is missing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json([
        {
          user: "0xfallback00000000",
          size: "1000",
          avgPrice: "0.40",
          currentValue: "1100",
          outcome: "Yes",
        },
      ]),
    );

    const result = await handleGetTopHolders({ condition_id: "0xc", limit: 10 });

    expect(result).toContain("0xfallba..");
  });
});
