/**
 * Scenario: "I want to copy-trade a top trader. Add them to my watchlist,
 * verify they're there, then later remove them."
 *
 * Chains handleWatchWallet (add) → handleListWatchlist → handleWatchWallet
 * (remove) → handleListWatchlist against a single shared in-memory DB. The
 * license check is mocked but watchlist queries run for real, so the scenario
 * verifies the full add/list/remove lifecycle wiring including idempotency
 * and the free-tier wallet count cap.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type Database from "better-sqlite3";

vi.mock("../../src/utils/license.js", () => ({
  checkLicense: vi.fn().mockResolvedValue(true),
  requirePro: vi.fn((name: string) => `${name} requires Pro`),
  resetLicenseCache: vi.fn(),
}));

import { handleWatchWallet } from "../../src/tools/watch-wallet.js";
import { handleListWatchlist } from "../../src/tools/list-watchlist.js";
import { getWatchlist, getWatchlistCount } from "../../src/db/queries.js";
import { checkLicense } from "../../src/utils/license.js";
import { makeTestDb } from "../helpers/fixtures.js";

const mockedCheckLicense = vi.mocked(checkLicense);

const WHALE = "0x1111111111111111111111111111111111111111";
const SHARK = "0x2222222222222222222222222222222222222222";
const FISH = "0x3333333333333333333333333333333333333333";
const NEWBIE = "0x4444444444444444444444444444444444444444";

describe("scenario: copy-trading watchlist setup lifecycle", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeTestDb();
    mockedCheckLicense.mockResolvedValue(true);
  });

  it("completes the full add → list → remove → list flow", async () => {
    // 1. User: "Add this whale to my watchlist"
    const addResult = await handleWatchWallet(db, {
      address: WHALE,
      alias: "whale_trader_1",
      action: "add",
    });
    expect(addResult).toContain("Added");
    expect(addResult).toContain("whale_trader_1");

    // Row exists in DB
    expect(getWatchlistCount(db)).toBe(1);

    // 2. User: "Show me my watchlist"
    const listed = await handleListWatchlist(db);
    expect(listed).toContain("Watchlist (1 traders)");
    expect(listed).toContain("whale_trader_1");
    // Address is rendered as 0x1111...1111 (first 6 + last 4)
    expect(listed).toContain(`${WHALE.slice(0, 6)}...${WHALE.slice(-4)}`);

    // 3. User: "Remove that wallet"
    const removeResult = await handleWatchWallet(db, {
      address: WHALE,
      action: "remove",
    });
    expect(removeResult).toContain("Removed");
    expect(removeResult).toContain(WHALE);

    // 4. User: "Show me my watchlist" — should be empty now
    const emptyList = await handleListWatchlist(db);
    expect(emptyList).toContain("Watchlist is empty");
    expect(getWatchlistCount(db)).toBe(0);
  });

  it("adding the same wallet twice is idempotent (INSERT OR REPLACE)", async () => {
    await handleWatchWallet(db, {
      address: WHALE,
      alias: "first_alias",
      action: "add",
    });
    expect(getWatchlistCount(db)).toBe(1);

    // Second add with a different alias should overwrite, not duplicate
    const second = await handleWatchWallet(db, {
      address: WHALE,
      alias: "updated_alias",
      action: "add",
    });
    expect(second).toContain("Added");
    expect(getWatchlistCount(db)).toBe(1);

    const rows = getWatchlist(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].alias).toBe("updated_alias");
  });

  it("free-tier users are capped at 3 wallets", async () => {
    // Switch the license mock to free tier for this test
    mockedCheckLicense.mockResolvedValue(false);

    const a = await handleWatchWallet(db, { address: WHALE, action: "add" });
    expect(a).toContain("Added");
    expect(a).toContain("1/3");

    const b = await handleWatchWallet(db, { address: SHARK, action: "add" });
    expect(b).toContain("2/3");

    const c = await handleWatchWallet(db, { address: FISH, action: "add" });
    expect(c).toContain("3/3");

    // Fourth add must be blocked
    const blocked = await handleWatchWallet(db, { address: NEWBIE, action: "add" });
    expect(blocked).toContain("Free tier is limited to 3 wallets");
    expect(blocked).toContain("requires Pro");

    // Watchlist still has only 3 rows
    expect(getWatchlistCount(db)).toBe(3);
  });

  it("removing a wallet that was never added is a safe no-op", async () => {
    expect(getWatchlistCount(db)).toBe(0);

    const removeResult = await handleWatchWallet(db, {
      address: WHALE,
      action: "remove",
    });
    expect(removeResult).toContain("Removed");
    expect(getWatchlistCount(db)).toBe(0);
  });

  it("free-tier list_watchlist is gated even when the watchlist exists", async () => {
    // First, add a wallet while Pro
    await handleWatchWallet(db, { address: WHALE, alias: "whale", action: "add" });

    // Now downgrade — list_watchlist requires Pro
    mockedCheckLicense.mockResolvedValue(false);
    const result = await handleListWatchlist(db);
    expect(result).toContain("requires Pro");
    expect(result).not.toContain("Watchlist (");
  });
});
