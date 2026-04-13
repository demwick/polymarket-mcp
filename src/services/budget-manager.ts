import Database from "better-sqlite3";
import { getDailySpent, addDailySpent, getDailyBudgetRemaining, resolveDailyLimit } from "../db/queries.js";

export interface CopyAmountInput {
  originalAmount: number;
  activeTraderCount: number;
}

function getConvictionMultiplier(amount: number): number {
  if (amount < 10) return 0.5;
  if (amount <= 50) return 1.0;
  return 1.5;
}

export class BudgetManager {
  constructor(
    private db: Database.Database,
    private dailyLimit: number
  ) {}

  calculateCopyAmount(input: CopyAmountInput): number {
    const today = new Date().toISOString().split("T")[0];
    const limit = this.getDailyLimit();
    const remaining = getDailyBudgetRemaining(this.db, today, limit);

    if (remaining <= 0) return 0;

    const base = limit / input.activeTraderCount;
    const multiplier = getConvictionMultiplier(input.originalAmount);
    const raw = base * multiplier;
    const cap = limit * 0.25;
    const capped = Math.min(raw, cap);

    return Math.min(capped, remaining);
  }

  recordSpending(date: string, amount: number): void {
    addDailySpent(this.db, date, amount, this.getDailyLimit());
  }

  getRemainingBudget(): number {
    const today = new Date().toISOString().split("T")[0];
    return getDailyBudgetRemaining(this.db, today, this.getDailyLimit());
  }

  getDailyLimit(): number {
    return resolveDailyLimit(this.db, this.dailyLimit);
  }

  setDailyLimit(limit: number): void {
    this.dailyLimit = limit;
  }
}
