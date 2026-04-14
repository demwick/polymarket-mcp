import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../../src/utils/license.js", () => ({
  checkLicense: vi.fn().mockResolvedValue(true),
  requirePro: vi.fn((name: string) => `${name} requires Pro`),
}));

vi.mock("../../src/utils/fetch.js", () => ({
  fetchWithRetry: vi.fn(async (url: string) => globalThis.fetch(url)),
}));

import { handleGetPriceHistory } from "../../src/tools/get-price-history.js";
import { checkLicense } from "../../src/utils/license.js";

describe("handleGetPriceHistory", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(checkLicense).mockResolvedValue(true);
  });

  it("gates behind Pro license", async () => {
    vi.mocked(checkLicense).mockResolvedValueOnce(false);

    const result = await handleGetPriceHistory({ token_id: "tok1", interval: "1d" });

    expect(result).toContain("requires Pro");
  });

  it("renders price history table from CLOB API", async () => {
    const now = Math.floor(Date.now() / 1000);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        history: [
          { t: now - 7200, p: "0.50" },
          { t: now - 3600, p: "0.55" },
          { t: now, p: "0.60" },
        ],
      }),
    );

    const result = await handleGetPriceHistory({ token_id: "tok1", interval: "1d" });

    expect(result).toContain("Price History (1d)");
    expect(result).toContain("$0.5000");
    expect(result).toContain("$0.6000");
    expect(result).toContain("Open");
    expect(result).toContain("Close");
    expect(result).toContain("High");
    expect(result).toContain("Low");
    expect(result).toContain("Change");
    expect(result).toContain("Data Points");
    expect(result).toContain("Recent Prices");
    expect(result).toContain("Trend:");
  });

  it("formats positive change with + arrow", async () => {
    const now = Math.floor(Date.now() / 1000);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        history: [
          { t: now - 3600, p: "0.40" },
          { t: now, p: "0.50" },
        ],
      }),
    );

    const result = await handleGetPriceHistory({ token_id: "tok1", interval: "1h" });

    expect(result).toContain("+$0.1000");
    expect(result).toContain("+25.0%");
  });

  it("returns no-history message when API returns empty", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ history: [] }));

    const result = await handleGetPriceHistory({ token_id: "tok1", interval: "6h" });

    expect(result).toContain("No price history available");
    expect(result).toContain("6h");
  });

  it("returns no-history message on non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 500 }));

    const result = await handleGetPriceHistory({ token_id: "tok1", interval: "1d" });

    expect(result).toContain("No price history available");
  });

  it("returns no-history message on rejected fetch", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("boom"));

    const result = await handleGetPriceHistory({ token_id: "tok1", interval: "1d" });

    expect(result).toContain("No price history available");
  });

  it("forwards token_id into the URL", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ history: [] }),
    );

    await handleGetPriceHistory({ token_id: "specific-token-id", interval: "1w" });

    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("market=specific-token-id");
    expect(url).toContain("startTs=");
    expect(url).toContain("fidelity=");
  });
});
