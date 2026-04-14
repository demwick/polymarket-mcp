import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/utils/license.js", () => ({
  checkLicense: vi.fn().mockResolvedValue(true),
  requirePro: vi.fn((name: string) => `${name} requires Pro`),
  resetLicenseCache: vi.fn(),
}));

vi.mock("../../src/services/smart-flow.js", () => ({
  discoverSmartFlow: vi.fn(),
}));

import { handleDiscoverFlow } from "../../src/tools/discover-flow.js";
import { checkLicense } from "../../src/utils/license.js";
import { discoverSmartFlow } from "../../src/services/smart-flow.js";
import type { FlowSignal } from "../../src/services/smart-flow.js";

const mockLicense = vi.mocked(checkLicense);
const mockDiscover = vi.mocked(discoverSmartFlow);

function makeSignal(overrides: Partial<FlowSignal> = {}): FlowSignal {
  return {
    conditionId: "hot_market",
    title: "Will BTC hit 100k?",
    side: "BUY",
    traders: [
      { address: "0xA", name: "Whale", amount: 500, price: 0.65, rank: 1 },
      { address: "0xB", name: "Shark", amount: 300, price: 0.63, rank: 2 },
    ],
    totalAmount: 800,
    avgPrice: 0.64,
    strength: "weak",
    ...overrides,
  };
}

describe("handleDiscoverFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLicense.mockResolvedValue(true);
    mockDiscover.mockResolvedValue([makeSignal()]);
  });

  it("requires Pro license", async () => {
    mockLicense.mockResolvedValue(false);
    const result = await handleDiscoverFlow({ top_traders: 30, max_age_minutes: 60, min_traders: 2 });
    expect(result).toContain("requires Pro");
    expect(mockDiscover).not.toHaveBeenCalled();
  });

  it("forwards parameters to the service", async () => {
    await handleDiscoverFlow({ top_traders: 50, max_age_minutes: 120, min_traders: 3 });
    expect(mockDiscover).toHaveBeenCalledWith({
      topN: 50,
      maxAgeMinutes: 120,
      minSignalTraders: 3,
    });
  });

  it("returns no-signals message when service yields empty array", async () => {
    mockDiscover.mockResolvedValue([]);
    const result = await handleDiscoverFlow({ top_traders: 30, max_age_minutes: 45, min_traders: 2 });
    expect(result).toContain("No smart money signals");
    expect(result).toContain("45 minutes");
    expect(result).toContain("top 30");
  });

  it("renders signal header with counts", async () => {
    mockDiscover.mockResolvedValue([makeSignal(), makeSignal({ conditionId: "m2", title: "Other" })]);
    const result = await handleDiscoverFlow({ top_traders: 25, max_age_minutes: 60, min_traders: 2 });
    expect(result).toContain("## Smart Money Flow");
    expect(result).toContain("25");
    expect(result).toContain("**2** signals");
  });

  it("renders trader table per signal with key fields", async () => {
    const result = await handleDiscoverFlow({ top_traders: 30, max_age_minutes: 60, min_traders: 2 });
    expect(result).toContain("Will BTC hit 100k?");
    expect(result).toContain("Whale");
    expect(result).toContain("Shark");
    expect(result).toContain("#1");
    expect(result).toContain("#2");
    expect(result).toContain("$800");
    expect(result).toContain("$0.64");
    expect(result).toContain("WEAK");
  });

  it("formats strong signals with triple-asterisk emphasis", async () => {
    mockDiscover.mockResolvedValue([
      makeSignal({
        strength: "strong",
        traders: Array.from({ length: 5 }, (_, i) => ({
          address: `0x${i}`, name: `T${i}`, amount: 100, price: 0.5, rank: i + 1,
        })),
        totalAmount: 500,
      }),
    ]);
    const result = await handleDiscoverFlow({ top_traders: 30, max_age_minutes: 60, min_traders: 2 });
    expect(result).toContain("***STRONG***");
  });

  it("formats moderate signals with double-asterisk emphasis", async () => {
    mockDiscover.mockResolvedValue([makeSignal({ strength: "moderate" })]);
    const result = await handleDiscoverFlow({ top_traders: 30, max_age_minutes: 60, min_traders: 2 });
    expect(result).toContain("**MODERATE**");
  });

  it("propagates service errors", async () => {
    mockDiscover.mockRejectedValue(new Error("leaderboard failed"));
    await expect(
      handleDiscoverFlow({ top_traders: 30, max_age_minutes: 60, min_traders: 2 })
    ).rejects.toThrow("leaderboard failed");
  });
});
