import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { handleLogCycle } from "../../src/tools/log-cycle.js";
import { makeTestDb } from "../helpers/fixtures.js";

type CycleRow = {
  id: number;
  agent_name: string;
  strategy: string;
  status: string;
  positions_open: number;
  positions_closed: number;
  realized_pnl: number;
  unrealized_pnl: number;
  win_rate: number;
  budget_used: number;
  budget_limit: number;
  actions_taken: string | null;
  notes: string | null;
  created_at: string;
};

function fullInput(overrides: Partial<Parameters<typeof handleLogCycle>[1]> = {}): Parameters<typeof handleLogCycle>[1] {
  return {
    agent_name: "agent-1",
    strategy: "copy_top_traders",
    status: "ok",
    positions_open: 0,
    positions_closed: 0,
    realized_pnl: 0,
    unrealized_pnl: 0,
    win_rate: 0,
    budget_used: 0,
    budget_limit: 0,
    actions_taken: undefined,
    notes: undefined,
    ...overrides,
  };
}

describe("handleLogCycle", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeTestDb();
  });

  it("inserts a cycle row and returns confirmation", () => {
    const result = handleLogCycle(
      db,
      fullInput({
        agent_name: "alpha",
        strategy: "stink_bids",
        positions_open: 2,
        realized_pnl: 1.5,
      }),
    );

    expect(result).toContain("Cycle logged");
    expect(result).toContain("alpha");

    const rows = db.prepare("SELECT * FROM agent_cycles").all() as CycleRow[];
    expect(rows).toHaveLength(1);
    expect(rows[0].agent_name).toBe("alpha");
    expect(rows[0].strategy).toBe("stink_bids");
    expect(rows[0].positions_open).toBe(2);
    expect(rows[0].realized_pnl).toBe(1.5);
    expect(rows[0].status).toBe("ok");
  });

  it("persists numeric and free-text fields verbatim", () => {
    handleLogCycle(
      db,
      fullInput({
        status: "warning",
        unrealized_pnl: -2.25,
        win_rate: 0.42,
        budget_used: 7.5,
        budget_limit: 20,
        actions_taken: "bought YES on Bitcoin market",
        notes: "spread was tight",
      }),
    );

    const row = db.prepare("SELECT * FROM agent_cycles").get() as CycleRow;
    expect(row.status).toBe("warning");
    expect(row.unrealized_pnl).toBe(-2.25);
    expect(row.win_rate).toBe(0.42);
    expect(row.budget_used).toBe(7.5);
    expect(row.budget_limit).toBe(20);
    expect(row.actions_taken).toBe("bought YES on Bitcoin market");
    expect(row.notes).toBe("spread was tight");
  });

  it("stores undefined optional fields as NULL", () => {
    handleLogCycle(db, fullInput({ agent_name: "no-notes" }));

    const row = db.prepare("SELECT * FROM agent_cycles").get() as CycleRow;
    expect(row.actions_taken).toBeNull();
    expect(row.notes).toBeNull();
  });

  it("appends rows on repeated calls", () => {
    handleLogCycle(db, fullInput({ agent_name: "a1" }));
    handleLogCycle(db, fullInput({ agent_name: "a2" }));
    handleLogCycle(db, fullInput({ agent_name: "a3", status: "error" }));

    const rows = db.prepare("SELECT agent_name, status FROM agent_cycles ORDER BY id").all() as Pick<CycleRow, "agent_name" | "status">[];
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.agent_name)).toEqual(["a1", "a2", "a3"]);
    expect(rows[2].status).toBe("error");
  });

  it("accepts all four status values allowed by the schema", () => {
    for (const status of ["ok", "warning", "risk_alert", "error"] as const) {
      handleLogCycle(db, fullInput({ agent_name: `a-${status}`, status }));
    }
    const rows = db.prepare("SELECT status FROM agent_cycles ORDER BY id").all() as { status: string }[];
    expect(rows.map((r) => r.status)).toEqual(["ok", "warning", "risk_alert", "error"]);
  });
});
