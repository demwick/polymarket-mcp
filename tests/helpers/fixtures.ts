/**
 * Shared test fixtures — DB setup, executor factory, sample data builders.
 *
 * Note: vi.mock() calls can NOT be shared from here. Vitest hoists them to the
 * top of each test file, so mocks must stay in the test file that uses them.
 * This module only provides value factories and assertion helpers.
 */
import Database from "better-sqlite3";
import { initializeDb } from "../../src/db/schema.js";
import { TradeExecutor } from "../../src/services/trade-executor.js";
import { recordTrade } from "../../src/db/queries.js";
import type { MarketInfo } from "../../src/services/market-resolver.js";

export function makeTestDb(): Database.Database {
  const db = new Database(":memory:");
  initializeDb(db);
  return db;
}

export function makePreviewExecutor(db: Database.Database): TradeExecutor {
  return new TradeExecutor(db, "preview");
}

export function makeLiveExecutor(db: Database.Database): TradeExecutor {
  return new TradeExecutor(db, "live");
}

export function today(): string {
  return new Date().toISOString().split("T")[0];
}

export type BudgetRow = { date: string; spent: number; limit_amount: number };

export function getBudgetRow(db: Database.Database, date = today()): BudgetRow | undefined {
  return db
    .prepare("SELECT * FROM daily_budget WHERE date = ?")
    .get(date) as BudgetRow | undefined;
}

type SeedOverrides = {
  trader_address?: string;
  market_slug?: string;
  condition_id?: string;
  token_id?: string;
  side?: string;
  price?: number;
  amount?: number;
  original_amount?: number;
  mode?: "preview" | "live";
  status?: string;
};

export function seedPosition(db: Database.Database, overrides: SeedOverrides = {}): number {
  return recordTrade(db, {
    trader_address: "0xabc",
    market_slug: "test-market",
    condition_id: "cond_test",
    token_id: "tok_test",
    side: "BUY",
    price: 0.5,
    amount: 10,
    original_amount: 20,
    mode: "preview",
    status: "simulated",
    ...overrides,
  } as Parameters<typeof recordTrade>[1]);
}

export function makeFakeMarket(overrides: Partial<MarketInfo> = {}): MarketInfo {
  return {
    conditionId: "0xcond",
    slug: "test-market",
    question: "Test question?",
    tickSize: "0.01",
    negRisk: false,
    yesTokenId: "yes-tok",
    yesPrice: 0.5,
    noTokenId: "no-tok",
    noPrice: 0.5,
    tokenId: "yes-tok",
    ...overrides,
  };
}

export type MarketQualityResult = {
  pass: boolean;
  reasons: string[];
  metrics: {
    spread: number;
    midPrice: number;
    bidDepth: number;
    askDepth: number;
    price: number;
  };
};

export function makePassingQuality(midPrice = 0.5): MarketQualityResult {
  return {
    pass: true,
    reasons: [],
    metrics: { spread: 0.02, midPrice, bidDepth: 1000, askDepth: 1000, price: midPrice },
  };
}

export function makeFailingQuality(reasons: string[]): MarketQualityResult {
  return {
    pass: false,
    reasons,
    metrics: { spread: 0.2, midPrice: 0.5, bidDepth: 10, askDepth: 10, price: 0.5 },
  };
}
