import { log } from "../utils/logger.js";
import { fetchWithRetry } from "../utils/fetch.js";

const ESPN_WTA_URL = "https://site.api.espn.com/apis/site/v2/sports/tennis/wta/scoreboard";
const GAMMA_EVENTS_URL = "https://gamma-api.polymarket.com/events";
const CLOB_MARKETS_URL = "https://clob.polymarket.com/markets";

export interface WtaMatch {
  player1: string;
  player2: string;
  tournament: string;
  status: string; // STATUS_SCHEDULED, STATUS_IN_PROGRESS, STATUS_FINAL
  startTime: string;
}

export interface WtaMarket {
  conditionId: string;
  question: string;
  slug: string;
  favoriteOutcome: string;
  favoritePrice: number;
  favoriteTokenId: string;
  underdogOutcome: string;
  underdogPrice: number;
  underdogTokenId: string;
  stinkBidPrice: number; // 30% below favorite
  tickSize: string;
  negRisk: boolean;
  closed: boolean;
}

/** Fetch today's WTA matches from ESPN */
export async function getWtaSchedule(): Promise<WtaMatch[]> {
  try {
    const res = await fetchWithRetry(ESPN_WTA_URL);
    if (!res.ok) return [];
    const data = await res.json();

    const matches: WtaMatch[] = [];
    for (const event of data.events ?? []) {
      const competition = event.competitions?.[0];
      if (!competition) continue;

      const competitors = competition.competitors ?? [];
      const players = competitors.map((c: any) => {
        const athlete = c.athlete ?? {};
        return athlete.shortName || athlete.displayName || "";
      }).filter(Boolean);

      if (players.length < 2) continue;

      matches.push({
        player1: players[0],
        player2: players[1],
        tournament: event.name ?? "",
        status: event.status?.type?.name ?? "UNKNOWN",
        startTime: event.date ?? "",
      });
    }

    log("info", `ESPN WTA: ${matches.length} matches found`);
    return matches;
  } catch (err) {
    log("error", `ESPN WTA API error: ${err}`);
    return [];
  }
}

/** Generate Polymarket slug candidates from player names */
export function generateSlugs(player1: string, player2: string, date: string): string[] {
  const normalize = (name: string): string => {
    // Take last name, lowercase, remove accents, truncate to 6-8 chars
    const parts = name.split(/[\s.]+/);
    const lastName = parts[parts.length - 1]
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z]/g, "");
    return lastName.slice(0, 7);
  };

  const p1 = normalize(player1);
  const p2 = normalize(player2);

  // Polymarket uses both orderings
  return [
    `wta-${p1}-${p2}-${date}`,
    `wta-${p2}-${p1}-${date}`,
  ];
}

/** Lookup a WTA event on Polymarket by slug */
async function lookupEvent(slug: string): Promise<any | null> {
  try {
    const url = `${GAMMA_EVENTS_URL}?slug=${slug}`;
    const res = await fetchWithRetry(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    return data[0];
  } catch {
    return null;
  }
}

/** Get detailed market info from CLOB API */
async function getClobMarket(conditionId: string): Promise<any | null> {
  try {
    const url = `${CLOB_MARKETS_URL}/${conditionId}`;
    const res = await fetchWithRetry(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Discover WTA markets on Polymarket for today's matches */
export async function discoverWtaMarkets(discountPct: number = 30): Promise<WtaMarket[]> {
  const schedule = await getWtaSchedule();
  if (schedule.length === 0) {
    log("info", "No WTA matches scheduled today");
    return [];
  }

  const today = new Date().toISOString().split("T")[0];
  const markets: WtaMarket[] = [];

  for (const match of schedule) {
    const slugs = generateSlugs(match.player1, match.player2, today);

    let event: any = null;
    for (const slug of slugs) {
      event = await lookupEvent(slug);
      if (event) break;
    }

    if (!event) {
      log("info", `No Polymarket event found for ${match.player1} vs ${match.player2}`);
      continue;
    }

    // Find the moneyline market (main match winner, not O/U or spreads)
    const eventMarkets = event.markets ?? [];
    const moneyline = eventMarkets.find((m: any) => {
      const q = (m.question ?? "").toLowerCase();
      // Moneyline is typically just "Player A vs Player B" without O/U or spread
      return !q.includes("o/u") && !q.includes("over") && !q.includes("under") && !q.includes("spread");
    });

    if (!moneyline) {
      log("info", `No moneyline market for ${match.player1} vs ${match.player2}`);
      continue;
    }

    // Get detailed info from CLOB API
    const clobMarket = await getClobMarket(moneyline.conditionId);
    if (!clobMarket || clobMarket.closed) continue;

    const tokens = clobMarket.tokens ?? [];
    if (tokens.length < 2) continue;

    // Determine favorite (higher price) and underdog
    const sorted = [...tokens].sort((a: any, b: any) => (b.price ?? 0) - (a.price ?? 0));
    const favorite = sorted[0];
    const underdog = sorted[1];

    const favPrice = parseFloat(favorite.price ?? "0");
    const stinkPrice = Math.round(favPrice * (1 - discountPct / 100) * 1000) / 1000;

    markets.push({
      conditionId: moneyline.conditionId,
      question: moneyline.question ?? clobMarket.question ?? "",
      slug: event.slug ?? "",
      favoriteOutcome: favorite.outcome ?? "",
      favoritePrice: favPrice,
      favoriteTokenId: favorite.token_id ?? "",
      underdogOutcome: underdog.outcome ?? "",
      underdogPrice: parseFloat(underdog.price ?? "0"),
      underdogTokenId: underdog.token_id ?? "",
      stinkBidPrice: stinkPrice,
      tickSize: clobMarket.minimum_tick_size?.toString() ?? "0.01",
      negRisk: clobMarket.neg_risk ?? false,
      closed: false,
    });

    log("info", `WTA market: ${moneyline.question} | Fav: ${favorite.outcome} @ ${favPrice} | Stink: ${stinkPrice}`);
  }

  log("info", `WTA discovery complete: ${markets.length} markets`);
  return markets;
}
