import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../../src/utils/fetch.js", () => ({
  fetchWithRetry: vi.fn(async (url: string) => globalThis.fetch(url)),
}));

import { getWtaSchedule, generateSlugs, discoverWtaMarkets } from "../../src/services/wta-discovery.js";

describe("generateSlugs", () => {
  it("generates two slug variants from player names", () => {
    const slugs = generateSlugs("J. Ponchet", "P. Kudermetova", "2026-04-08");
    expect(slugs).toHaveLength(2);
    expect(slugs).toContain("wta-ponchet-kuderme-2026-04-08");
    expect(slugs).toContain("wta-kuderme-ponchet-2026-04-08");
  });

  it("handles single-word names", () => {
    const slugs = generateSlugs("Serena", "Venus", "2026-04-08");
    expect(slugs[0]).toBe("wta-serena-venus-2026-04-08");
  });

  it("normalizes accented characters", () => {
    const slugs = generateSlugs("A. Müller", "B. García", "2026-04-08");
    expect(slugs[0]).toContain("muller");
    expect(slugs[0]).toContain("garcia");
  });
});

describe("getWtaSchedule", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses ESPN WTA response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        events: [
          {
            name: "Madrid Open",
            date: "2026-04-08T14:00:00Z",
            status: { type: { name: "STATUS_SCHEDULED" } },
            competitions: [{
              competitors: [
                { athlete: { shortName: "J. Ponchet", displayName: "Jessika Ponchet" } },
                { athlete: { shortName: "P. Kudermetova", displayName: "Polina Kudermetova" } },
              ],
            }],
          },
        ],
      })
    );

    const matches = await getWtaSchedule();
    expect(matches).toHaveLength(1);
    expect(matches[0].player1).toBe("J. Ponchet");
    expect(matches[0].player2).toBe("P. Kudermetova");
    expect(matches[0].tournament).toBe("Madrid Open");
  });

  it("returns empty on API error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fail"));
    const matches = await getWtaSchedule();
    expect(matches).toHaveLength(0);
  });
});

describe("discoverWtaMarkets", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("discovers WTA markets with stink bid prices", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const parsedUrl = new URL(String(url));

      // ESPN API
      if (parsedUrl.hostname === "espn.com" || parsedUrl.hostname.endsWith(".espn.com")) {
        return Response.json({
          events: [{
            name: "Madrid Open",
            date: "2026-04-08T14:00:00Z",
            status: { type: { name: "STATUS_SCHEDULED" } },
            competitions: [{
              competitors: [
                { athlete: { shortName: "J. Ponchet" } },
                { athlete: { shortName: "P. Kudermetova" } },
              ],
            }],
          }],
        });
      }

      // Gamma events API
      if ((parsedUrl.hostname === "gamma-api.polymarket.com" || parsedUrl.hostname.endsWith(".gamma-api.polymarket.com")) && parsedUrl.searchParams.has("slug")) {
        return Response.json([{
          slug: "wta-ponchet-kuderme-2026-04-08",
          markets: [{
            conditionId: "0xabc123",
            question: "Madrid: Ponchet vs Kudermetova",
          }],
        }]);
      }

      // CLOB markets API
      if (parsedUrl.hostname === "clob.polymarket.com" && parsedUrl.pathname.startsWith("/markets/")) {
        return Response.json({
          condition_id: "0xabc123",
          question: "Madrid: Ponchet vs Kudermetova",
          closed: false,
          minimum_tick_size: 0.001,
          neg_risk: false,
          tokens: [
            { token_id: "tok_fav", outcome: "Kudermetova", price: 0.75 },
            { token_id: "tok_dog", outcome: "Ponchet", price: 0.25 },
          ],
        });
      }

      return Response.json([]);
    });

    const markets = await discoverWtaMarkets(30);
    expect(markets).toHaveLength(1);
    expect(markets[0].favoriteOutcome).toBe("Kudermetova");
    expect(markets[0].favoritePrice).toBe(0.75);
    expect(markets[0].stinkBidPrice).toBeCloseTo(0.525, 2); // 0.75 * 0.7
    expect(markets[0].underdogOutcome).toBe("Ponchet");
  });

  it("returns empty when no ESPN matches", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ events: [] }));
    const markets = await discoverWtaMarkets();
    expect(markets).toHaveLength(0);
  });
});
