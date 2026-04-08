import { describe, it, expect } from "vitest";
import { filterNewTrades, type RawActivity } from "../../src/services/wallet-monitor.js";

describe("filterNewTrades", () => {
  const now = Date.now();

  const mockActivities: RawActivity[] = [
    { type: "TRADE", side: "BUY", size: "10", price: "0.45", usdcSize: 4.5, asset: "tok1", timestamp: new Date(now - 60_000).toISOString(), conditionId: "c1", title: "Market A", slug: "market-a", outcome: "Yes", transactionHash: "0x1" },
    { type: "TRADE", side: "SELL", size: "5", price: "0.60", asset: "tok2", timestamp: new Date(now - 120_000).toISOString(), conditionId: "c2", title: "Market B", slug: "market-b", outcome: "No", transactionHash: "0x2" },
    { type: "TRADE", side: "BUY", size: "2", price: "0.30", usdcSize: 0.6, asset: "tok3", timestamp: new Date(now - 60_000).toISOString(), conditionId: "c3", title: "Market C", slug: "market-c", outcome: "Yes", transactionHash: "0x3" },
    { type: "TRADE", side: "BUY", size: "50", price: "0.80", usdcSize: 40, asset: "tok4", timestamp: new Date(now - 400_000).toISOString(), conditionId: "c4", title: "Market D", slug: "market-d", outcome: "Yes", transactionHash: "0x4" },
  ];

  it("filters only BUY trades", () => {
    const result = filterNewTrades(mockActivities, 0, 600);
    expect(result.every((t) => t.side === "BUY")).toBe(true);
  });

  it("filters out trades older than maxAge", () => {
    const result = filterNewTrades(mockActivities, 0, 300);
    expect(result.find((t) => t.conditionId === "c4")).toBeUndefined();
  });

  it("filters by minimum conviction amount", () => {
    const result = filterNewTrades(mockActivities, 3, 600);
    expect(result.find((t) => t.conditionId === "c1")).toBeDefined();
    expect(result.find((t) => t.conditionId === "c3")).toBeUndefined();
  });

  it("handles Unix epoch timestamps (number)", () => {
    const epochActivities: RawActivity[] = [
      { type: "TRADE", side: "BUY", size: 100, price: 0.50, usdcSize: 50, asset: "tok5", timestamp: Math.floor(now / 1000) - 30, conditionId: "c5", title: "Market E", slug: "market-e", outcome: "Yes", transactionHash: "0x5" },
    ];
    const result = filterNewTrades(epochActivities, 0, 300);
    expect(result).toHaveLength(1);
    expect(result[0].size).toBe(100);
    expect(result[0].price).toBe(0.50);
  });
});
