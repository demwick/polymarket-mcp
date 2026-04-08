import { z } from "zod";
import Database from "better-sqlite3";

export const logCycleSchema = z.object({
  agent_name: z.string(),
  strategy: z.string(),
  status: z.enum(["ok", "warning", "risk_alert", "error"]).default("ok"),
  positions_open: z.number().int().default(0),
  positions_closed: z.number().int().default(0),
  realized_pnl: z.number().default(0),
  unrealized_pnl: z.number().default(0),
  win_rate: z.number().default(0),
  budget_used: z.number().default(0),
  budget_limit: z.number().default(0),
  actions_taken: z.string().optional(),
  notes: z.string().optional(),
});

export type LogCycleInput = z.infer<typeof logCycleSchema>;

export function handleLogCycle(db: Database.Database, input: LogCycleInput): string {
  db.prepare(`
    INSERT INTO agent_cycles (agent_name, strategy, status, positions_open, positions_closed, realized_pnl, unrealized_pnl, win_rate, budget_used, budget_limit, actions_taken, notes)
    VALUES (@agent_name, @strategy, @status, @positions_open, @positions_closed, @realized_pnl, @unrealized_pnl, @win_rate, @budget_used, @budget_limit, @actions_taken, @notes)
  `).run(input);

  return `Cycle logged for ${input.agent_name}`;
}
