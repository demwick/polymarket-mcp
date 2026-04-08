import Database from "better-sqlite3";

export interface WatchlistEntry {
  address: string;
  alias: string | null;
  roi: number;
  volume: number;
  pnl: number;
  trade_count: number;
  added_at?: string;
  last_checked?: string | null;
}

export interface TradeRecord {
  id?: number;
  trader_address: string;
  market_slug: string | null;
  condition_id: string | null;
  token_id: string | null;
  side: string;
  price: number;
  amount: number;
  original_amount: number | null;
  mode: "preview" | "live";
  status: "simulated" | "executed" | "failed" | "resolved_win" | "resolved_loss";
  pnl?: number;
  created_at?: string;
  resolved_at?: string | null;
}

export function addToWatchlist(db: Database.Database, entry: Omit<WatchlistEntry, "added_at" | "last_checked">): void {
  db.prepare(`
    INSERT OR REPLACE INTO watchlist (address, alias, roi, volume, pnl, trade_count)
    VALUES (@address, @alias, @roi, @volume, @pnl, @trade_count)
  `).run(entry);
}

export function removeFromWatchlist(db: Database.Database, address: string): void {
  db.prepare("DELETE FROM watchlist WHERE address = ?").run(address);
}

export function getWatchlist(db: Database.Database): WatchlistEntry[] {
  return db.prepare("SELECT * FROM watchlist ORDER BY roi DESC").all() as WatchlistEntry[];
}

export function getWatchlistCount(db: Database.Database): number {
  const row = db.prepare("SELECT COUNT(*) as count FROM watchlist").get() as { count: number };
  return row.count;
}

export function updateLastChecked(db: Database.Database, address: string): void {
  db.prepare("UPDATE watchlist SET last_checked = datetime('now') WHERE address = ?").run(address);
}

export function recordTrade(db: Database.Database, trade: Omit<TradeRecord, "id" | "pnl" | "created_at" | "resolved_at">): number {
  const result = db.prepare(`
    INSERT INTO trades (trader_address, market_slug, condition_id, token_id, side, price, amount, original_amount, mode, status)
    VALUES (@trader_address, @market_slug, @condition_id, @token_id, @side, @price, @amount, @original_amount, @mode, @status)
  `).run(trade);
  return Number(result.lastInsertRowid);
}

export function getTradeHistory(db: Database.Database, opts: { limit?: number; trader?: string; status?: string }): TradeRecord[] {
  let sql = "SELECT * FROM trades WHERE 1=1";
  const params: Record<string, unknown> = {};

  if (opts.trader) {
    sql += " AND trader_address = @trader";
    params.trader = opts.trader;
  }
  if (opts.status) {
    sql += " AND status = @status";
    params.status = opts.status;
  }
  sql += " ORDER BY created_at DESC LIMIT @limit";
  params.limit = opts.limit ?? 50;

  return db.prepare(sql).all(params) as TradeRecord[];
}

export function hasExistingPosition(db: Database.Database, conditionId: string): boolean {
  const row = db.prepare(
    "SELECT 1 FROM trades WHERE condition_id = ? AND status IN ('simulated', 'executed') LIMIT 1"
  ).get(conditionId);
  return !!row;
}

export function getDailySpent(db: Database.Database, date: string): number {
  const row = db.prepare("SELECT spent FROM daily_budget WHERE date = ?").get(date) as { spent: number } | undefined;
  return row?.spent ?? 0;
}

export function addDailySpent(db: Database.Database, date: string, amount: number, limitAmount: number): void {
  const existing = db.prepare("SELECT spent FROM daily_budget WHERE date = ?").get(date) as { spent: number } | undefined;
  if (existing) {
    db.prepare("UPDATE daily_budget SET spent = spent + ? WHERE date = ?").run(amount, date);
  } else {
    db.prepare("INSERT INTO daily_budget (date, spent, limit_amount) VALUES (?, ?, ?)").run(date, amount, limitAmount);
  }
}

export function getDailyBudgetRemaining(db: Database.Database, date: string, dailyLimit: number): number {
  const spent = getDailySpent(db, date);
  return Math.max(0, dailyLimit - spent);
}

export function getTradeStats(db: Database.Database): { total: number; wins: number; losses: number; totalPnl: number; winRate: number } {
  const rows = db.prepare("SELECT status, pnl FROM trades").all() as { status: string; pnl: number }[];
  const total = rows.length;
  const wins = rows.filter((r) => r.status === "resolved_win").length;
  const losses = rows.filter((r) => r.status === "resolved_loss").length;
  const totalPnl = rows.reduce((sum, r) => sum + (r.pnl ?? 0), 0);
  const resolved = wins + losses;
  const winRate = resolved > 0 ? (wins / resolved) * 100 : 0;
  return { total, wins, losses, totalPnl, winRate };
}

export function getConfig(db: Database.Database, key: string): string | null {
  const row = db.prepare("SELECT value FROM config WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setConfig(db: Database.Database, key: string, value: string): void {
  db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)").run(key, value);
}
