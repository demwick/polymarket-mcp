import { log } from "../utils/logger.js";

const DATA_API_BASE = "https://data-api.polymarket.com";

export interface RawLeaderboardEntry {
  proxyWallet: string;
  userName: string;
  pnl: number;
  vol: number;
  rank: number;
}

export interface TraderProfile {
  address: string;
  name: string;
  pnl: number;
  volume: number;
  rank: number;
  period: string;
}

export interface DiscoverOptions {
  pages?: number;
  period?: "ALL" | "WEEK";
  minVolume?: number;
  minPnl?: number;
}

export function filterTraders(
  traders: RawLeaderboardEntry[],
  opts: { minVolume: number; minPnl: number }
): RawLeaderboardEntry[] {
  return traders.filter((t) => t.vol >= opts.minVolume && t.pnl >= opts.minPnl);
}

export async function fetchLeaderboardPage(
  period: "ALL" | "WEEK",
  offset: number,
  limit: number
): Promise<RawLeaderboardEntry[]> {
  const timePeriod = period === "WEEK" ? "WEEK" : "ALL";
  const url = `${DATA_API_BASE}/v1/leaderboard?timePeriod=${timePeriod}&orderBy=PNL&limit=${limit}&offset=${offset}`;

  log("info", `Fetching leaderboard: period=${timePeriod}, offset=${offset}, limit=${limit}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Leaderboard API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data as RawLeaderboardEntry[];
}

export async function discoverTraders(opts: DiscoverOptions = {}): Promise<TraderProfile[]> {
  const pages = opts.pages ?? 3;
  const period = opts.period ?? "ALL";
  const minVolume = opts.minVolume ?? 1000;
  const minPnl = opts.minPnl ?? 0;
  const limit = 25;

  const allTraders: RawLeaderboardEntry[] = [];

  for (let page = 0; page < pages; page++) {
    try {
      const entries = await fetchLeaderboardPage(period, page * limit, limit);
      allTraders.push(...entries);
    } catch (err) {
      log("error", `Failed to fetch leaderboard page ${page + 1}`, { error: String(err) });
    }
  }

  const filtered = filterTraders(allTraders, { minVolume, minPnl });

  log("info", `Discovered ${filtered.length} traders from ${allTraders.length} total (period=${period})`);

  return filtered.map((t) => ({
    address: t.proxyWallet,
    name: t.userName || `Trader-${t.rank}`,
    pnl: t.pnl,
    volume: t.vol,
    rank: t.rank,
    period,
  }));
}
