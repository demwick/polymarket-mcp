import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/utils/license.js", () => ({
  checkLicense: vi.fn().mockResolvedValue(true),
  requirePro: vi.fn((name: string) => `${name} requires Pro`),
  resetLicenseCache: vi.fn(),
}));

vi.mock("../../src/services/backtester.js", () => ({
  backtestTrader: vi.fn(),
}));

import { handleBacktestTrader } from "../../src/tools/backtest-trader.js";
import { checkLicense } from "../../src/utils/license.js";
import { backtestTrader } from "../../src/services/backtester.js";
import type { BacktestResult } from "../../src/services/backtester.js";

const mockLicense = vi.mocked(checkLicense);
const mockBacktest = vi.mocked(backtestTrader);

const VALID_ADDR = "0x1234567890abcdef1234567890abcdef12345678";

function makeResult(overrides: Partial<BacktestResult> = {}): BacktestResult {
  return {
    address: VALID_ADDR,
    period: "Last 4 trades",
    trades: [
      {
        title: "Will BTC hit 100k by EOY?",
        conditionId: "c1",
        side: "BUY",
        entryPrice: 0.4,
        exitPrice: 0.7,
        amount: 100,
        pnl: 7.5,
        status: "won",
        timestamp: "2026-04-01",
      },
      {
        title: "ETH Merge upgrade",
        conditionId: "c2",
        side: "BUY",
        entryPrice: 0.6,
        exitPrice: 0.4,
        amount: 50,
        pnl: -3.33,
        status: "lost",
        timestamp: "2026-04-02",
      },
    ],
    summary: {
      totalTrades: 2,
      wins: 1,
      losses: 1,
      open: 0,
      winRate: 50,
      totalPnl: 4.17,
      avgPnl: 2.085,
      bestTrade: 7.5,
      worstTrade: -3.33,
      simulatedCopyPnl: 4.17,
    },
    ...overrides,
  };
}

describe("handleBacktestTrader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLicense.mockResolvedValue(true);
    mockBacktest.mockResolvedValue(makeResult());
  });

  it("requires Pro license", async () => {
    mockLicense.mockResolvedValue(false);
    const result = await handleBacktestTrader({ address: VALID_ADDR, copy_budget: 5 });
    expect(result).toContain("requires Pro");
    expect(mockBacktest).not.toHaveBeenCalled();
  });

  it("renders summary table with key metrics", async () => {
    const result = await handleBacktestTrader({ address: VALID_ADDR, copy_budget: 5 });
    expect(result).toContain("## Backtest:");
    expect(result).toContain("Last 4 trades");
    expect(result).toContain("Total Trades");
    expect(result).toContain("Win Rate");
    expect(result).toContain("50.0%");
    expect(result).toContain("Simulated P&L");
    expect(result).toContain("$4.17");
  });

  it("forwards copy_budget to the service", async () => {
    await handleBacktestTrader({ address: VALID_ADDR, copy_budget: 25 });
    expect(mockBacktest).toHaveBeenCalledWith(VALID_ADDR, 25);
  });

  it("renders trade details when trades exist", async () => {
    const result = await handleBacktestTrader({ address: VALID_ADDR, copy_budget: 10 });
    expect(result).toContain("### Trade Details");
    expect(result).toContain("Will BTC hit 100k by EOY?");
    expect(result).toContain("+$7.50");
    expect(result).toContain("-$3.33");
    expect(result).toContain("won");
    expect(result).toContain("lost");
  });

  it("formats open trades with 'open' exit price", async () => {
    mockBacktest.mockResolvedValue(makeResult({
      trades: [{
        title: "Open position",
        conditionId: "c3",
        side: "BUY",
        entryPrice: 0.5,
        exitPrice: null,
        amount: 20,
        pnl: 0,
        status: "open",
        timestamp: "2026-04-03",
      }],
      summary: {
        totalTrades: 1, wins: 0, losses: 0, open: 1, winRate: 0,
        totalPnl: 0, avgPnl: 0, bestTrade: 0, worstTrade: 0, simulatedCopyPnl: 0,
      },
    }));
    const result = await handleBacktestTrader({ address: VALID_ADDR, copy_budget: 5 });
    expect(result).toContain("open");
    expect(result).not.toContain("$null");
  });

  it("omits trade detail section when no trades", async () => {
    mockBacktest.mockResolvedValue(makeResult({
      trades: [],
      summary: {
        totalTrades: 0, wins: 0, losses: 0, open: 0, winRate: 0,
        totalPnl: 0, avgPnl: 0, bestTrade: 0, worstTrade: 0, simulatedCopyPnl: 0,
      },
    }));
    const result = await handleBacktestTrader({ address: VALID_ADDR, copy_budget: 5 });
    expect(result).not.toContain("### Trade Details");
    expect(result).toContain("Total Trades | 0");
  });

  it("truncates trade list to 15 with overflow note", async () => {
    const trades = Array.from({ length: 20 }, (_, i) => ({
      title: `Market ${i}`,
      conditionId: `c${i}`,
      side: "BUY",
      entryPrice: 0.5,
      exitPrice: 0.6,
      amount: 10,
      pnl: 1,
      status: "won" as const,
      timestamp: "2026-04-01",
    }));
    mockBacktest.mockResolvedValue(makeResult({
      trades,
      summary: {
        totalTrades: 20, wins: 20, losses: 0, open: 0, winRate: 100,
        totalPnl: 20, avgPnl: 1, bestTrade: 1, worstTrade: 1, simulatedCopyPnl: 20,
      },
    }));
    const result = await handleBacktestTrader({ address: VALID_ADDR, copy_budget: 5 });
    expect(result).toContain("...and 5 more trades");
  });

  it("propagates service errors", async () => {
    mockBacktest.mockRejectedValue(new Error("API down"));
    await expect(handleBacktestTrader({ address: VALID_ADDR, copy_budget: 5 })).rejects.toThrow("API down");
  });
});
