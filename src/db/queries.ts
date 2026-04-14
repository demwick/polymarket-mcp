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
  current_price?: number | null;
  exit_reason?: string | null;
  sl_price?: number | null;
  tp_price?: number | null;
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

/** Atomically record a trade and update daily budget in a single transaction */
export function recordTradeWithBudget(
  db: Database.Database,
  trade: Omit<TradeRecord, "id" | "pnl" | "created_at" | "resolved_at">,
  date: string,
  spendAmount: number,
  dailyLimit: number
): number {
  const txn = db.transaction(() => {
    const tradeId = recordTrade(db, trade);
    addDailySpent(db, date, spendAmount, dailyLimit);
    return tradeId;
  });
  return txn();
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

/**
 * Resolve today's effective daily budget limit. The dashboard can override the
 * caller's default by writing a positive `daily_budget.limit_amount` row for
 * today; otherwise the supplied fallback (env default or constructor value)
 * wins. Single source of truth for both BudgetManager and TradeExecutor so
 * every preview spend path records against the same limit.
 */
export function resolveDailyLimit(db: Database.Database, fallback: number): number {
  const today = new Date().toISOString().split("T")[0];
  const row = db
    .prepare("SELECT limit_amount FROM daily_budget WHERE date = ?")
    .get(today) as { limit_amount: number } | undefined;
  if (row && typeof row.limit_amount === "number" && row.limit_amount > 0) {
    return row.limit_amount;
  }
  return fallback;
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

export function getOpenPositions(db: Database.Database): TradeRecord[] {
  return db.prepare(
    "SELECT * FROM trades WHERE status IN ('simulated', 'executed') ORDER BY created_at DESC"
  ).all() as TradeRecord[];
}

export function updateTradeExit(
  db: Database.Database,
  tradeId: number,
  currentPrice: number,
  exitReason: string,
  pnl: number
): void {
  const status = pnl >= 0 ? "resolved_win" : "resolved_loss";
  db.prepare(
    "UPDATE trades SET current_price = ?, exit_reason = ?, pnl = ?, status = ?, resolved_at = datetime('now') WHERE id = ?"
  ).run(currentPrice, exitReason, pnl, status, tradeId);
}

export function getPositionsByStatus(
  db: Database.Database,
  status: "open" | "closed" | "all"
): TradeRecord[] {
  if (status === "open") {
    return db.prepare("SELECT * FROM trades WHERE status IN ('simulated', 'executed') ORDER BY created_at DESC").all() as TradeRecord[];
  }
  if (status === "closed") {
    return db.prepare("SELECT * FROM trades WHERE status IN ('resolved_win', 'resolved_loss', 'failed') ORDER BY resolved_at DESC").all() as TradeRecord[];
  }
  return db.prepare("SELECT * FROM trades ORDER BY created_at DESC").all() as TradeRecord[];
}

export function setExitRules(db: Database.Database, tradeId: number, slPrice: number | null, tpPrice: number | null): boolean {
  const result = db.prepare(
    "UPDATE trades SET sl_price = ?, tp_price = ? WHERE id = ? AND status IN ('simulated', 'executed')"
  ).run(slPrice, tpPrice, tradeId);
  return result.changes > 0;
}

export function getPositionsWithExitRules(db: Database.Database): TradeRecord[] {
  return db.prepare(
    "SELECT * FROM trades WHERE status IN ('simulated', 'executed') AND (sl_price IS NOT NULL OR tp_price IS NOT NULL) ORDER BY created_at DESC"
  ).all() as TradeRecord[];
}

export interface WalletPortfolio {
  address: string;
  alias: string | null;
  openPositions: number;
  closedPositions: number;
  totalInvested: number;
  realizedPnl: number;
  winRate: number;
}

export function getPortfolioByWallet(db: Database.Database): WalletPortfolio[] {
  const wallets = db.prepare("SELECT address, alias FROM watchlist").all() as { address: string; alias: string | null }[];

  return wallets.map((w) => {
    const trades = db.prepare("SELECT status, amount, pnl FROM trades WHERE trader_address = ?").all(w.address) as { status: string; amount: number; pnl: number }[];
    const open = trades.filter((t) => t.status === "simulated" || t.status === "executed");
    const wins = trades.filter((t) => t.status === "resolved_win").length;
    const losses = trades.filter((t) => t.status === "resolved_loss").length;
    const resolved = wins + losses;

    return {
      address: w.address,
      alias: w.alias,
      openPositions: open.length,
      closedPositions: resolved,
      totalInvested: open.reduce((sum, t) => sum + t.amount, 0),
      realizedPnl: trades.reduce((sum, t) => sum + (t.pnl ?? 0), 0),
      winRate: resolved > 0 ? (wins / resolved) * 100 : 0,
    };
  });
}

// ---- Market Watchlist ----

export interface MarketWatch {
  condition_id: string;
  token_id: string | null;
  title: string | null;
  slug: string | null;
  alert_below: number | null;
  alert_above: number | null;
  last_price: number | null;
  added_at?: string;
}

export function addMarketWatch(db: Database.Database, entry: Omit<MarketWatch, "added_at">): void {
  db.prepare(`
    INSERT OR REPLACE INTO market_watchlist (condition_id, token_id, title, slug, alert_below, alert_above, last_price)
    VALUES (@condition_id, @token_id, @title, @slug, @alert_below, @alert_above, @last_price)
  `).run(entry);
}

export function removeMarketWatch(db: Database.Database, conditionId: string): void {
  db.prepare("DELETE FROM market_watchlist WHERE condition_id = ?").run(conditionId);
}

export function getMarketWatchlist(db: Database.Database): MarketWatch[] {
  return db.prepare("SELECT * FROM market_watchlist ORDER BY added_at DESC").all() as MarketWatch[];
}

export function updateMarketWatchPrice(db: Database.Database, conditionId: string, price: number): void {
  db.prepare("UPDATE market_watchlist SET last_price = ? WHERE condition_id = ?").run(price, conditionId);
}

/** Daily P&L history for charting — returns cumulative running total */
export function getDailyPnlHistory(db: Database.Database): { date: string; pnl: number; cumulative: number }[] {
  const rows = db.prepare(`
    SELECT date(resolved_at) as date, SUM(pnl) as pnl
    FROM trades
    WHERE pnl IS NOT NULL AND resolved_at IS NOT NULL
    GROUP BY date(resolved_at)
    ORDER BY date ASC
  `).all() as { date: string; pnl: number }[];

  let cumulative = 0;
  return rows.map((r) => {
    cumulative += r.pnl;
    return { date: r.date, pnl: r.pnl, cumulative };
  });
}
