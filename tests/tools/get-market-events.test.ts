import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../../src/utils/license.js", () => ({
  checkLicense: vi.fn().mockResolvedValue(true),
  requirePro: vi.fn((name: string) => `${name} requires Pro`),
}));

vi.mock("../../src/utils/fetch.js", () => ({
  fetchWithRetry: vi.fn(async (url: string) => globalThis.fetch(url)),
}));

import { handleGetMarketEvents } from "../../src/tools/get-market-events.js";

describe("handleGetMarketEvents", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requires slug or query", async () => {
    const result = await handleGetMarketEvents({ limit: 10 });
    expect(result).toContain("Provide an event `slug` or `query`");
  });

  it("renders events with nested markets from query", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json([
        {
          title: "US Election 2026",
          slug: "us-election-2026",
          markets: [
            {
              question: "Will Dem win?",
              volume: "10000",
              conditionId: "0xdem1234567890",
              outcomePrices: "[\"0.55\",\"0.45\"]",
            },
            {
              question: "Will Rep win?",
              volume: "9000",
              conditionId: "0xrep1234567890",
              outcomePrices: "[\"0.45\",\"0.55\"]",
            },
          ],
        },
      ]),
    );

    const result = await handleGetMarketEvents({ query: "election", limit: 10 });

    expect(result).toContain("Events (1)");
    expect(result).toContain("### US Election 2026");
    expect(result).toContain("Will Dem win?");
    expect(result).toContain("Will Rep win?");
    expect(result).toContain("$0.55");
    expect(result).toContain("$10000");
  });

  it("renders 'no markets' note for events with empty market list", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json([
        { title: "Empty event", slug: "empty", markets: [] },
      ]),
    );

    const result = await handleGetMarketEvents({ query: "x", limit: 10 });

    expect(result).toContain("### Empty event");
    expect(result).toContain("No markets in this event");
  });

  it("returns friendly message when no events found", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([]));

    const result = await handleGetMarketEvents({ query: "nothing", limit: 10 });

    expect(result).toContain('No events found for "nothing"');
  });

  it("returns API error message on non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 500 }));

    const result = await handleGetMarketEvents({ query: "x", limit: 10 });

    expect(result).toContain("Could not fetch events");
  });

  it("returns unreachable message on rejected fetch", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("boom"));

    const result = await handleGetMarketEvents({ query: "x", limit: 10 });

    expect(result).toContain("Could not reach the Polymarket API");
  });

  it("uses slug endpoint when slug is provided", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([]));

    await handleGetMarketEvents({ slug: "us-election-2026", limit: 10 });

    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("/events?slug=us-election-2026");
  });

  it("encodes query into URL when query is provided", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([]));

    await handleGetMarketEvents({ query: "trump 2028", limit: 5 });

    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("_q=trump%202028");
    expect(url).toContain("limit=5");
    expect(url).toContain("closed=false");
  });
});
