import { describe, it, expect } from "vitest";
import { filterTraders, type RawLeaderboardEntry } from "../../src/services/leaderboard.js";

describe("filterTraders", () => {
  const mockTraders: RawLeaderboardEntry[] = [
    { proxyWallet: "0xaaa", userName: "Alpha", pnl: 15000, vol: 50000, rank: 1 },
    { proxyWallet: "0xbbb", userName: "Beta", pnl: -500, vol: 2000, rank: 2 },
    { proxyWallet: "0xccc", userName: "Gamma", pnl: 200, vol: 300, rank: 3 },
    { proxyWallet: "0xddd", userName: "Delta", pnl: 8000, vol: 25000, rank: 4 },
  ];

  it("filters by minimum volume", () => {
    const result = filterTraders(mockTraders, { minVolume: 10000, minPnl: 0 });
    expect(result.every((t) => t.vol >= 10000)).toBe(true);
    expect(result).toHaveLength(2);
  });

  it("filters out negative PnL", () => {
    const result = filterTraders(mockTraders, { minVolume: 0, minPnl: 0 });
    expect(result.every((t) => t.pnl >= 0)).toBe(true);
    expect(result.find((t) => t.proxyWallet === "0xbbb")).toBeUndefined();
  });

  it("returns empty array when no traders match", () => {
    const result = filterTraders(mockTraders, { minVolume: 999999, minPnl: 0 });
    expect(result).toHaveLength(0);
  });
});
