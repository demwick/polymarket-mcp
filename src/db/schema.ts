import Database from "better-sqlite3";

export function initializeDb(db: Database.Database): void {
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS watchlist (
      address TEXT PRIMARY KEY,
      alias TEXT,
      roi REAL,
      volume REAL,
      pnl REAL,
      trade_count INTEGER,
      added_at TEXT DEFAULT (datetime('now')),
      last_checked TEXT
    );

    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trader_address TEXT NOT NULL,
      market_slug TEXT,
      condition_id TEXT,
      token_id TEXT,
      side TEXT NOT NULL,
      price REAL NOT NULL,
      amount REAL NOT NULL,
      original_amount REAL,
      mode TEXT NOT NULL CHECK (mode IN ('preview', 'live')),
      status TEXT NOT NULL CHECK (status IN ('simulated', 'executed', 'failed', 'resolved_win', 'resolved_loss')),
      pnl REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      resolved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS daily_budget (
      date TEXT NOT NULL,
      spent REAL DEFAULT 0,
      limit_amount REAL NOT NULL,
      PRIMARY KEY (date)
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}
