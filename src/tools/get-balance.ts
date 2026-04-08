import { z } from "zod";
import Database from "better-sqlite3";
import { getTradeStats, getOpenPositions, getDailySpent } from "../db/queries.js";
import { BudgetManager } from "../services/budget-manager.js";

export async function handleGetBalance(db: Database.Database, budgetManager: BudgetManager): Promise<string> {
  const stats = getTradeStats(db);
  const openPositions = getOpenPositions(db);
  const today = new Date().toISOString().split("T")[0];
  const dailySpent = getDailySpent(db, today);
  const dailyLimit = budgetManager.getDailyLimit();
  const remaining = budgetManager.getRemainingBudget();

  const totalInvested = openPositions.reduce((sum, p) => sum + p.amount, 0);

  let output = "## Account Balance\n\n";
  output += "| Metric | Value |\n|--------|-------|\n";
  output += `| Daily Budget | $${dailyLimit.toFixed(2)} |\n`;
  output += `| Spent Today | $${dailySpent.toFixed(2)} |\n`;
  output += `| Remaining Today | $${remaining.toFixed(2)} |\n`;
  output += `| Open Positions | ${openPositions.length} ($${totalInvested.toFixed(2)} invested) |\n`;
  output += `| Realized P&L | $${stats.totalPnl.toFixed(2)} |\n`;
  output += `| Win Rate | ${stats.winRate.toFixed(1)}% (${stats.wins}W / ${stats.losses}L) |\n`;
  output += `| Total Trades | ${stats.total} |\n`;

  return output;
}
