import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/utils/license.js", () => ({
  checkLicense: vi.fn().mockResolvedValue(true),
  requirePro: vi.fn((name: string) => `${name} requires Pro — upgrade message`),
  resetLicenseCache: vi.fn(),
}));

vi.mock("../../src/services/conviction-scorer.js", () => ({
  scoreTrader: vi.fn(),
}));

import { handleScoreTrader } from "../../src/tools/score-trader.js";
import { checkLicense } from "../../src/utils/license.js";
import { scoreTrader } from "../../src/services/conviction-scorer.js";

const mockLicense = vi.mocked(checkLicense);
const mockScore = vi.mocked(scoreTrader);

const VALID_ADDR = "0x1234567890abcdef1234567890abcdef12345678";

function makeScore(overrides: Partial<{
  score: number;
  level: "low" | "medium" | "high";
  recommendation: string;
  breakdown: { winRate: number; tradeVolume: number; consistency: number; experience: number; diversity: number };
}> = {}) {
  return {
    score: 78,
    level: "high" as const,
    recommendation: "Strong copy candidate. Use full budget allocation.",
    breakdown: {
      winRate: 30,
      tradeVolume: 20,
      consistency: 15,
      experience: 8,
      diversity: 5,
    },
    ...overrides,
  };
}

describe("handleScoreTrader", () => {
  beforeEach(() => {
    mockLicense.mockResolvedValue(true);
    mockScore.mockResolvedValue(makeScore());
  });

  it("returns Pro upgrade message for free tier", async () => {
    mockLicense.mockResolvedValue(false);
    const result = await handleScoreTrader({ address: VALID_ADDR });
    expect(result).toContain("Pro");
    expect(mockScore).not.toHaveBeenCalled();
  });

  it("renders conviction score header with truncated address", async () => {
    const result = await handleScoreTrader({ address: VALID_ADDR });
    expect(result).toContain("Conviction Score");
    expect(result).toContain(VALID_ADDR.slice(0, 8));
    expect(result).toContain(VALID_ADDR.slice(-4));
  });

  it("renders score, level, and recommendation for HIGH", async () => {
    mockScore.mockResolvedValue(makeScore({ score: 78, level: "high" }));
    const result = await handleScoreTrader({ address: VALID_ADDR });
    expect(result).toContain("78/100");
    expect(result).toContain("HIGH");
    expect(result).toContain("Strong copy candidate");
  });

  it("renders MEDIUM level correctly", async () => {
    mockScore.mockResolvedValue(makeScore({
      score: 50,
      level: "medium",
      recommendation: "Moderate confidence. Use reduced allocation (50-75%).",
    }));
    const result = await handleScoreTrader({ address: VALID_ADDR });
    expect(result).toContain("50/100");
    expect(result).toContain("MEDIUM");
    expect(result).toContain("Moderate confidence");
  });

  it("renders LOW level correctly", async () => {
    mockScore.mockResolvedValue(makeScore({
      score: 18,
      level: "low",
      recommendation: "Low confidence. Monitor only, or use minimal allocation.",
    }));
    const result = await handleScoreTrader({ address: VALID_ADDR });
    expect(result).toContain("18/100");
    expect(result).toContain("LOW");
    expect(result).toContain("Low confidence");
  });

  it("renders breakdown table with all five factors", async () => {
    const result = await handleScoreTrader({ address: VALID_ADDR });
    expect(result).toContain("Breakdown");
    expect(result).toContain("Win Rate");
    expect(result).toContain("30/30");
    expect(result).toContain("Trade Volume");
    expect(result).toContain("20/20");
    expect(result).toContain("Consistency");
    expect(result).toContain("15/20");
    expect(result).toContain("Experience");
    expect(result).toContain("8/15");
    expect(result).toContain("Diversity");
    expect(result).toContain("5/15");
  });

  it("uses filled and empty bar characters proportional to score", async () => {
    mockScore.mockResolvedValue(makeScore({
      breakdown: { winRate: 30, tradeVolume: 0, consistency: 10, experience: 0, diversity: 0 },
    }));
    const result = await handleScoreTrader({ address: VALID_ADDR });
    // Win Rate 30/30 → 10 filled blocks
    expect(result).toContain("█".repeat(10));
    // Trade Volume 0/20 → 10 empty blocks
    expect(result).toContain("░".repeat(10));
  });

  it("propagates the address to scoreTrader unchanged", async () => {
    await handleScoreTrader({ address: VALID_ADDR });
    expect(mockScore).toHaveBeenCalledWith(VALID_ADDR);
  });
});
