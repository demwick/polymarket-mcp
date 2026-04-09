import Database from "better-sqlite3";

export function initializeDb(db: Database.Database): void {
  db.pragma("journal_mode = WAL");

  const ddl = [
    `CREATE TABLE IF NOT EXISTS watchlist (
      address TEXT PRIMARY KEY,
      alias TEXT,
      roi REAL,
      volume REAL,
      pnl REAL,
      trade_count INTEGER,
      added_at TEXT DEFAULT (datetime('now')),
      last_checked TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS trades (
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
      resolved_at TEXT,
      current_price REAL,
      exit_reason TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS daily_budget (
      date TEXT NOT NULL,
      spent REAL DEFAULT 0,
      limit_amount REAL NOT NULL,
      PRIMARY KEY (date)
    )`,
    `CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS agent_cycles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_name TEXT NOT NULL,
      strategy TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ok',
      positions_open INTEGER DEFAULT 0,
      positions_closed INTEGER DEFAULT 0,
      realized_pnl REAL DEFAULT 0,
      unrealized_pnl REAL DEFAULT 0,
      win_rate REAL DEFAULT 0,
      budget_used REAL DEFAULT 0,
      budget_limit REAL DEFAULT 0,
      actions_taken TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS market_watchlist (
      condition_id TEXT PRIMARY KEY,
      token_id TEXT,
      title TEXT,
      slug TEXT,
      alert_below REAL,
      alert_above REAL,
      last_price REAL,
      added_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_trades_condition_id ON trades(condition_id)`,
    `CREATE INDEX IF NOT EXISTS idx_trades_trader_address ON trades(trader_address)`,
    `CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status)`,
    `CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_daily_budget_date ON daily_budget(date)`,
  ];

  for (const sql of ddl) {
    db.prepare(sql).run();
  }

  // Migrations — add columns safely
  const cols = db.prepare("PRAGMA table_info(trades)").all() as { name: string }[];
  const colNames = new Set(cols.map((c) => c.name));
  if (!colNames.has("sl_price")) db.prepare("ALTER TABLE trades ADD COLUMN sl_price REAL").run();
  if (!colNames.has("tp_price")) db.prepare("ALTER TABLE trades ADD COLUMN tp_price REAL").run();
}
