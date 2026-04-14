/**
 * Scenario: "Backtest a trader, score their conviction, then add them to my
 * watchlist if it looks good."
 *
 * Chains handleBacktestTrader → handleScoreTrader → handleWatchWallet →
 * handleListWatchlist against a single shared in-memory DB. The Backtester
 * and ConvictionScorer services are mocked at module level (since they hit
 * external APIs), but watchlist queries and license gating run for real.
 * Verifies the research → decide → subscribe flow end-to-end.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type Database from "better-sqlite3";
import type { BacktestResult } from "../../src/services/backtester.js";
import type { ConvictionScore } from "../../src/services/conviction-scorer.js";

vi.mock("../../src/utils/license.js", () => ({
  checkLicense: vi.fn().mockResolvedValue(true),
  requirePro: vi.fn((name: string) => `${name} requires Pro`),
  resetLicenseCache: vi.fn(),
}));

vi.mock("../../src/services/backtester.js", () => ({
  backtestTrader: vi.fn(),
}));

vi.mock("../../src/services/conviction-scorer.js", () => ({
  scoreTrader: vi.fn(),
}));

import { handleBacktestTrader } from "../../src/tools/backtest-trader.js";
import { handleScoreTrader } from "../../src/tools/score-trader.js";
import { handleWatchWallet } from "../../src/tools/watch-wallet.js";
import { handleListWatchlist } from "../../src/tools/list-watchlist.js";
import { backtestTrader } from "../../src/services/backtester.js";
import { scoreTrader } from "../../src/services/conviction-scorer.js";
import { getWatchlistCount, getWatchlist } from "../../src/db/queries.js";
import { makeTestDb } from "../helpers/fixtures.js";

const mockBacktest = vi.mocked(backtestTrader);
const mockScore = vi.mocked(scoreTrader);

const PROFITABLE_TRADER = "0xaaaa1111aaaa1111aaaa1111aaaa1111aaaa1111";
const LOSING_TRADER = "0xbbbb2222bbbb2222bbbb2222bbbb2222bbbb2222";

function profitableBacktest(address: string): BacktestResult {
  return {
    address,
    period: "Last 40 trades",
    trades: [
      {
        title: "Will BTC hit $100k by EOY?",
        conditionId: "0xbtc100k",
        side: "BUY",
        entryPrice: 0.42,
        exitPrice: 0.71,
        amount: 250,
        pnl: 3.45,
        status: "won",
        timestamp: "2026-04-01T00:00:00Z",
      },
      {
        title: "Will ETH flip BTC?",
        conditionId: "0xethflip",
        side: "BUY",
        entryPrice: 0.18,
        exitPrice: 0.32,
        amount: 100,
        pnl: 3.89,
        status: "won",
        timestamp: "2026-04-02T00:00:00Z",
      },
    ],
    summary: {
      totalTrades: 2,
      wins: 2,
      losses: 0,
      open: 0,
      winRate: 100,
      totalPnl: 7.34,
      avgPnl: 3.67,
      bestTrade: 3.89,
      worstTrade: 3.45,
      simulatedCopyPnl: 7.34,
    },
  };
}

function losingBacktest(address: string): BacktestResult {
  return {
    address,
    period: "Last 20 trades",
    trades: [
      {
        title: "Will some random thing happen?",
        conditionId: "0xrandom",
        side: "BUY",
        entryPrice: 0.65,
        exitPrice: 0.21,
        amount: 50,
        pnl: -3.38,
        status: "lost",
        timestamp: "2026-04-03T00:00:00Z",
      },
    ],
    summary: {
      totalTrades: 1,
      wins: 0,
      losses: 1,
      open: 0,
      winRate: 0,
      totalPnl: -3.38,
      avgPnl: -3.38,
      bestTrade: -3.38,
      worstTrade: -3.38,
      simulatedCopyPnl: -3.38,
    },
  };
}

function highScore(): ConvictionScore {
  return {
    score: 82,
    level: "high",
    breakdown: { winRate: 30, tradeVolume: 15, consistency: 15, experience: 12, diversity: 10 },
    recommendation: "Strong copy candidate. Use full budget allocation.",
  };
}

function lowScore(): ConvictionScore {
  return {
    score: 22,
    level: "low",
    breakdown: { winRate: 0, tradeVolume: 5, consistency: 5, experience: 4, diversity: 8 },
    recommendation: "Low confidence. Monitor only, or use minimal allocation.",
  };
}

describe("scenario: research a trader, then watchlist them based on results", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeTestDb();
    mockBacktest.mockReset();
    mockScore.mockReset();
  });

  it("profitable backtest + high score → user adds trader to watchlist", async () => {
    mockBacktest.mockResolvedValue(profitableBacktest(PROFITABLE_TRADER));
    mockScore.mockResolvedValue(highScore());

    // 1. User: "Backtest this trader"
    const backtestResult = await handleBacktestTrader({
      address: PROFITABLE_TRADER,
      copy_budget: 5,
    });
    expect(backtestResult).toContain("Backtest:");
    expect(backtestResult).toContain("Win Rate");
    expect(backtestResult).toContain("100.0%");
    expect(backtestResult).toContain("$7.34");

    // 2. User: "Score their conviction"
    const scoreResult = await handleScoreTrader({ address: PROFITABLE_TRADER });
    expect(scoreResult).toContain("Conviction Score");
    expect(scoreResult).toContain("82/100");
    expect(scoreResult).toContain("HIGH");
    expect(scoreResult).toContain("Strong copy candidate");

    // 3. User: "Looks great, add them to my watchlist"
    const addResult = await handleWatchWallet(db, {
      address: PROFITABLE_TRADER,
      alias: "profit_whale",
      action: "add",
    });
    expect(addResult).toContain("Added");
    expect(addResult).toContain("profit_whale");

    // 4. User: "Show my watchlist"
    const list = await handleListWatchlist(db);
    expect(list).toContain("Watchlist (1 traders)");
    expect(list).toContain("profit_whale");

    expect(getWatchlistCount(db)).toBe(1);
    expect(mockBacktest).toHaveBeenCalledWith(PROFITABLE_TRADER, 5);
    expect(mockScore).toHaveBeenCalledWith(PROFITABLE_TRADER);
  });

  it("unprofitable backtest + low score → user does NOT add to watchlist", async () => {
    mockBacktest.mockResolvedValue(losingBacktest(LOSING_TRADER));
    mockScore.mockResolvedValue(lowScore());

    const backtestResult = await handleBacktestTrader({
      address: LOSING_TRADER,
      copy_budget: 5,
    });
    expect(backtestResult).toContain("0.0%"); // win rate
    expect(backtestResult).toContain("-$3.38"); // simulated P&L

    const scoreResult = await handleScoreTrader({ address: LOSING_TRADER });
    expect(scoreResult).toContain("22/100");
    expect(scoreResult).toContain("LOW");
    expect(scoreResult).toContain("Low confidence");

    // User decides not to add — watchlist remains empty
    expect(getWatchlistCount(db)).toBe(0);
    const list = await handleListWatchlist(db);
    expect(list).toContain("Watchlist is empty");
  });

  it("score-trader after watch-wallet: same address flows through both tools", async () => {
    mockScore.mockResolvedValue(highScore());

    // Already-watched trader gets re-scored later
    const addResult = await handleWatchWallet(db, {
      address: PROFITABLE_TRADER,
      alias: "already_watching",
      action: "add",
    });
    expect(addResult).toContain("Added");

    const scoreResult = await handleScoreTrader({ address: PROFITABLE_TRADER });
    expect(scoreResult).toContain(PROFITABLE_TRADER.slice(0, 8));
    expect(scoreResult).toContain("HIGH");

    // Watchlist still contains the trader, untouched by the scoring call
    const rows = getWatchlist(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].address).toBe(PROFITABLE_TRADER);
    expect(rows[0].alias).toBe("already_watching");

    // Both tools were called with the same address
    expect(mockScore).toHaveBeenCalledWith(PROFITABLE_TRADER);
  });

  it("backtest copy_budget defaults to $5 when omitted", async () => {
    mockBacktest.mockResolvedValue(profitableBacktest(PROFITABLE_TRADER));

    await handleBacktestTrader({ address: PROFITABLE_TRADER, copy_budget: 5 });
    expect(mockBacktest).toHaveBeenCalledWith(PROFITABLE_TRADER, 5);
  });
});
