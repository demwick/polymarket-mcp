import Database from "better-sqlite3";
import { PositionTracker } from "../services/position-tracker.js";

export async function handleCheckExits(db: Database.Database): Promise<string> {
  const tracker = new PositionTracker(db);
  const closed = await tracker.checkExits();

  if (closed === 0) {
    return "No positions resolved this cycle.";
  }

  return `${closed} position(s) resolved and P&L updated.`;
}
