import Database from "better-sqlite3";
import { getWatchlist } from "../db/queries.js";
import { checkLicense, requirePro } from "../utils/license.js";

export async function handleListWatchlist(db: Database.Database): Promise<string> {
  const isPro = await checkLicense(); if (!isPro) return requirePro("list_watchlist");
  const list = getWatchlist(db);

  if (list.length === 0) {
    return "Watchlist is empty. Use `discover_traders` to find traders or `watch_wallet` to add one.";
  }

  const header = `## Watchlist (${list.length} traders)\n\n`;
  const tableHeader = "| Alias | Address | ROI | Volume | PnL | Added |\n|-------|---------|-----|--------|-----|-------|\n";
  const rows = list.map((w) =>
    `| ${w.alias ?? "-"} | ${w.address.slice(0, 6)}...${w.address.slice(-4)} | ${w.roi?.toFixed(1) ?? "?"}% | $${w.volume?.toLocaleString() ?? "?"} | $${w.pnl?.toLocaleString() ?? "?"} | ${w.added_at?.split("T")[0] ?? "-"} |`
  ).join("\n");

  return header + tableHeader + rows;
}
