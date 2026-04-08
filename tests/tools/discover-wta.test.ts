import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/utils/license.js", () => ({
  checkLicense: vi.fn().mockResolvedValue(true),
  requirePro: vi.fn((name: string) => `${name} requires Pro`),
}));

vi.mock("../../src/services/wta-discovery.js", () => ({
  discoverWtaMarkets: vi.fn().mockResolvedValue([]),
}));

import { handleDiscoverWta } from "../../src/tools/discover-wta.js";
import { discoverWtaMarkets } from "../../src/services/wta-discovery.js";
const mockDiscover = vi.mocked(discoverWtaMarkets);

describe("handleDiscoverWta", () => {
  it("returns message when no markets found", async () => {
    mockDiscover.mockResolvedValue([]);
    const result = await handleDiscoverWta({ discount_pct: 30 });
    expect(result).toContain("No WTA markets found");
  });

  it("renders stink bid table", async () => {
    mockDiscover.mockResolvedValue([
      {
        conditionId: "0xabc",
        question: "Madrid: Ponchet vs Kudermetova",
        slug: "wta-ponchet-kuderme-2026-04-08",
        favoriteOutcome: "Kudermetova",
        favoritePrice: 0.75,
        favoriteTokenId: "tok_fav",
        underdogOutcome: "Ponchet",
        underdogPrice: 0.25,
        underdogTokenId: "tok_dog",
        stinkBidPrice: 0.525,
        tickSize: "0.001",
        negRisk: false,
        closed: false,
      },
    ]);

    const result = await handleDiscoverWta({ discount_pct: 30 });
    expect(result).toContain("WTA Markets (1)");
    expect(result).toContain("Kudermetova");
    expect(result).toContain("$0.750");
    expect(result).toContain("$0.525");
    expect(result).toContain("place_stink_bid");
  });
});
