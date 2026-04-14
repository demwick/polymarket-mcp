import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import Database from "better-sqlite3";
import { makeTestDb } from "../helpers/fixtures.js";

vi.mock("../../src/utils/license.js", () => ({
  checkLicense: vi.fn().mockResolvedValue(true),
  requirePro: vi.fn((name: string) => `${name} requires Pro`),
  resetLicenseCache: vi.fn(),
}));

vi.mock("../../src/services/position-tracker.js", () => ({
  PositionTracker: vi.fn(),
}));

import { handleCheckExits } from "../../src/tools/check-exits.js";
import { checkLicense } from "../../src/utils/license.js";
import { PositionTracker } from "../../src/services/position-tracker.js";

const mockLicense = vi.mocked(checkLicense);
const MockedTracker = vi.mocked(PositionTracker);

describe("handleCheckExits", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeTestDb();
    mockLicense.mockResolvedValue(true);
    MockedTracker.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requires Pro license", async () => {
    mockLicense.mockResolvedValue(false);
    const result = await handleCheckExits(db);
    expect(result).toContain("Pro");
    expect(MockedTracker).not.toHaveBeenCalled();
  });

  it("returns 'no positions resolved' when tracker reports zero", async () => {
    MockedTracker.mockImplementation(function (this: any) {
      this.checkExits = vi.fn().mockResolvedValue(0);
    } as any);

    const result = await handleCheckExits(db);
    expect(result).toContain("No positions resolved");
  });

  it("reports closed count when tracker resolves positions", async () => {
    MockedTracker.mockImplementation(function (this: any) {
      this.checkExits = vi.fn().mockResolvedValue(3);
    } as any);

    const result = await handleCheckExits(db);
    expect(result).toContain("3 position(s) resolved");
    expect(result).toContain("P&L updated");
  });

  it("instantiates PositionTracker with the supplied db", async () => {
    const checkExitsFn = vi.fn().mockResolvedValue(1);
    MockedTracker.mockImplementation(function (this: any) {
      this.checkExits = checkExitsFn;
    } as any);

    await handleCheckExits(db);
    expect(MockedTracker).toHaveBeenCalledWith(db);
    expect(checkExitsFn).toHaveBeenCalledOnce();
  });

  it("propagates errors thrown by the tracker", async () => {
    MockedTracker.mockImplementation(function (this: any) {
      this.checkExits = vi.fn().mockRejectedValue(new Error("network down"));
    } as any);

    await expect(handleCheckExits(db)).rejects.toThrow("network down");
  });
});
