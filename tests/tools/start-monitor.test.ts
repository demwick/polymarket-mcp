import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import Database from "better-sqlite3";
import { handleStartMonitor } from "../../src/tools/start-monitor.js";
import { BudgetManager } from "../../src/services/budget-manager.js";
import { WalletMonitor } from "../../src/services/wallet-monitor.js";
import { makeTestDb, makePreviewExecutor } from "../helpers/fixtures.js";
import { addToWatchlist } from "../../src/db/queries.js";

vi.mock("../../src/utils/license.js", () => ({
  checkLicense: vi.fn().mockResolvedValue(true),
  requirePro: vi.fn((name: string) => `${name} requires Pro`),
  resetLicenseCache: vi.fn(),
}));

import { checkLicense } from "../../src/utils/license.js";
const mockCheckLicense = vi.mocked(checkLicense);

describe("handleStartMonitor (complementary)", () => {
  let db: Database.Database;
  let monitor: WalletMonitor;

  beforeEach(() => {
    db = makeTestDb();
    const bm = new BudgetManager(db, 20);
    const executor = makePreviewExecutor(db);
    monitor = new WalletMonitor(db, bm, executor, 3);
    mockCheckLicense.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("converts interval_seconds to milliseconds when calling monitor.start", async () => {
    const getStatusSpy = vi.spyOn(monitor, "getStatus").mockReturnValue({ running: false } as ReturnType<WalletMonitor["getStatus"]>);
    const startSpy = vi.spyOn(monitor, "start").mockImplementation(() => {});

    await handleStartMonitor(db, monitor, { interval_seconds: 45 });

    expect(startSpy).toHaveBeenCalledTimes(1);
    expect(startSpy).toHaveBeenCalledWith(45_000);
    getStatusSpy.mockRestore();
  });

  it("does not warn when watchlist has entries", async () => {
    vi.spyOn(monitor, "getStatus").mockReturnValue({ running: false } as ReturnType<WalletMonitor["getStatus"]>);
    vi.spyOn(monitor, "start").mockImplementation(() => {});

    addToWatchlist(db, {
      address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      alias: "A",
      roi: 0,
      volume: 0,
      pnl: 0,
      trade_count: 0,
    });

    const result = await handleStartMonitor(db, monitor, { interval_seconds: 30 });
    expect(result).toContain("Monitor started");
    expect(result).not.toContain("watchlist is empty");
  });

  it("does not start monitor when Pro gate fails", async () => {
    mockCheckLicense.mockResolvedValue(false);
    const startSpy = vi.spyOn(monitor, "start").mockImplementation(() => {});

    const result = await handleStartMonitor(db, monitor, { interval_seconds: 30 });

    expect(result).toContain("Pro");
    expect(startSpy).not.toHaveBeenCalled();
  });

  it("does not call monitor.start if already running", async () => {
    vi.spyOn(monitor, "getStatus").mockReturnValue({ running: true } as ReturnType<WalletMonitor["getStatus"]>);
    const startSpy = vi.spyOn(monitor, "start").mockImplementation(() => {});

    const result = await handleStartMonitor(db, monitor, { interval_seconds: 30 });

    expect(result).toContain("already running");
    expect(startSpy).not.toHaveBeenCalled();
  });
});
