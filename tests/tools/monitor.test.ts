import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import Database from "better-sqlite3";
import { initializeDb } from "../../src/db/schema.js";
import { handleStartMonitor } from "../../src/tools/start-monitor.js";
import { handleStopMonitor } from "../../src/tools/stop-monitor.js";
import { BudgetManager } from "../../src/services/budget-manager.js";
import { WalletMonitor } from "../../src/services/wallet-monitor.js";
import { TradeExecutor } from "../../src/services/trade-executor.js";

vi.mock("../../src/utils/license.js", () => ({
  checkLicense: vi.fn().mockResolvedValue(true),
  requirePro: vi.fn((name: string) => `${name} requires Pro`),
  resetLicenseCache: vi.fn(),
}));

import { checkLicense } from "../../src/utils/license.js";
const mockCheckLicense = vi.mocked(checkLicense);

describe("monitor tools", () => {
  let db: Database.Database;
  let monitor: WalletMonitor;

  beforeEach(() => {
    db = new Database(":memory:");
    initializeDb(db);
    const bm = new BudgetManager(db, 20);
    const executor = new TradeExecutor(db, "preview");
    monitor = new WalletMonitor(db, bm, executor, 3);
    mockCheckLicense.mockResolvedValue(true);
  });

  afterEach(() => {
    monitor.stop();
  });

  describe("handleStartMonitor", () => {
    it("requires Pro license", async () => {
      mockCheckLicense.mockResolvedValue(false);
      const result = await handleStartMonitor(db, monitor, { interval_seconds: 30 });
      expect(result).toContain("Pro");
    });

    it("starts the monitor", async () => {
      // Mock fetch to prevent real API calls during tick
      vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([]));

      const result = await handleStartMonitor(db, monitor, { interval_seconds: 60 });
      expect(result).toContain("Monitor started");
      expect(result).toContain("60");
      expect(monitor.getStatus().running).toBe(true);
    });

    it("returns message if already running", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([]));

      await handleStartMonitor(db, monitor, { interval_seconds: 30 });
      const result = await handleStartMonitor(db, monitor, { interval_seconds: 30 });
      expect(result).toContain("already running");
    });

    it("warns when watchlist is empty", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([]));

      const result = await handleStartMonitor(db, monitor, { interval_seconds: 30 });
      expect(result).toContain("Monitor started");
      expect(result).toContain("watchlist is empty");
    });
  });

  describe("handleStopMonitor", () => {
    it("requires Pro license", async () => {
      mockCheckLicense.mockResolvedValue(false);
      const result = await handleStopMonitor(monitor);
      expect(result).toContain("Pro");
    });

    it("stops a running monitor", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([]));

      monitor.start(60_000);
      expect(monitor.getStatus().running).toBe(true);

      const result = await handleStopMonitor(monitor);
      expect(result).toContain("Monitor stopped");
      expect(monitor.getStatus().running).toBe(false);
    });

    it("returns message if not running", async () => {
      const result = await handleStopMonitor(monitor);
      expect(result).toContain("not running");
    });
  });
});
