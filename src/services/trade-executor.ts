import Database from "better-sqlite3";
import { ClobClient, Side, OrderType } from "@polymarket/clob-client";
import { Wallet } from "@ethersproject/wallet";
import { recordTrade, recordTradeWithBudget, resolveDailyLimit } from "../db/queries.js";
import { getConfig, getSigningKey, hasLiveCredentials } from "../utils/config.js";
import { log } from "../utils/logger.js";

/** Redact private keys and hex secrets from error messages to prevent leaks in logs. */
function sanitizeError(msg: string): string {
  // Remove anything that looks like a private key or hex secret (32+ hex chars)
  return msg.replace(/0x[a-fA-F0-9]{32,}/g, "0x[REDACTED]")
            .replace(/[a-fA-F0-9]{64,}/g, "[REDACTED]");
}

export interface TradeOrder {
  traderAddress: string;
  marketSlug: string | null;
  conditionId: string;
  tokenId: string;
  price: number;
  amount: number;
  originalAmount: number;
  tickSize: string;
  negRisk: boolean;
  orderSide?: "BUY" | "SELL";
  orderType?: "GTC" | "GTD";
  /** Optional budget info for atomic trade+budget recording (preview mode) */
  budget?: { date: string; spendAmount: number; dailyLimit: number };
}

export interface TradeResult {
  tradeId: number;
  mode: "preview" | "live";
  status: "simulated" | "executed" | "failed";
  message: string;
}

export class TradeExecutor {
  private clobClient: ClobClient | null = null;

  constructor(
    private db: Database.Database,
    private mode: "preview" | "live"
  ) {}

  async execute(order: TradeOrder): Promise<TradeResult> {
    if (this.mode === "preview") {
      return this.simulateTrade(order);
    }
    return this.executeLiveTrade(order);
  }

  private simulateTrade(order: TradeOrder): TradeResult {
    const tradeData = {
      trader_address: order.traderAddress,
      market_slug: order.marketSlug,
      condition_id: order.conditionId,
      token_id: order.tokenId,
      side: "BUY",
      price: order.price,
      amount: order.amount,
      original_amount: order.originalAmount,
      mode: "preview" as const,
      status: "simulated" as const,
    };

    // BUY spends — amount in USDC is what leaves the budget. Auto-populate
    // budget info when the caller (e.g. direct `buy` tool) didn't supply it so
    // that `daily_budget.spent` stays accurate across every preview BUY path.
    const budget = order.budget ?? {
      date: new Date().toISOString().split("T")[0],
      spendAmount: order.amount,
      dailyLimit: resolveDailyLimit(this.db, getConfig().DAILY_BUDGET),
    };

    const tradeId = recordTradeWithBudget(
      this.db,
      tradeData,
      budget.date,
      budget.spendAmount,
      budget.dailyLimit
    );

    log("trade", `[PREVIEW] Simulated BUY $${order.amount} @ ${order.price} on ${order.marketSlug}`, {
      trader: order.traderAddress,
      tradeId,
    });

    return { tradeId, mode: "preview", status: "simulated", message: `Simulated: BUY $${order.amount} @ ${order.price}` };
  }

  private async executeLiveTrade(order: TradeOrder): Promise<TradeResult> {
    if (!hasLiveCredentials()) {
      return {
        tradeId: -1,
        mode: "live",
        status: "failed",
        message: "Live credentials not configured",
      };
    }

    try {
      const client = await this.getClobClient();
      const side = order.orderSide === "SELL" ? Side.SELL : Side.BUY;
      const resp = await client.createAndPostOrder(
        {
          tokenID: order.tokenId,
          price: order.price,
          side,
          size: order.amount,
        },
        { tickSize: order.tickSize as "0.1" | "0.01" | "0.001" | "0.0001", negRisk: order.negRisk },
        order.orderType === "GTD" ? OrderType.GTD : OrderType.GTC
      );

      // Validate CLOB response
      if (!resp || resp.success === false || resp.errorMsg) {
        const reason = resp?.errorMsg ?? "Order rejected by CLOB";
        log("error", `[LIVE] Order rejected: ${reason}`, { order: order.marketSlug, response: resp });
        return this.recordFailedTrade(order, reason);
      }

      const tradeId = recordTrade(this.db, {
        trader_address: order.traderAddress,
        market_slug: order.marketSlug,
        condition_id: order.conditionId,
        token_id: order.tokenId,
        side: order.orderSide ?? "BUY",
        price: order.price,
        amount: order.amount,
        original_amount: order.originalAmount,
        mode: "live",
        status: "executed",
      });

      log("trade", `[LIVE] Executed ${order.orderSide ?? "BUY"} $${order.amount} @ ${order.price} on ${order.marketSlug}`, {
        trader: order.traderAddress,
        tradeId,
        orderID: resp.orderID ?? resp.orderIds,
      });

      return { tradeId, mode: "live", status: "executed", message: `Executed: ${order.orderSide ?? "BUY"} $${order.amount} @ ${order.price}` };
    } catch (err: any) {
      const rawMessage = err?.message ?? String(err);
      const message = sanitizeError(rawMessage);
      log("error", `[LIVE] Failed ${order.orderSide ?? "BUY"} on ${order.marketSlug}: ${message}`);
      return this.recordFailedTrade(order, message);
    }
  }

  private async getClobClient(): Promise<ClobClient> {
    if (this.clobClient) return this.clobClient;

    const config = getConfig();
    // SECURITY: Signing key is retrieved from the in-memory config singleton
    // solely to locally construct EIP-712 CLOB order payloads. The key is
    // never logged, persisted, or transmitted except as part of a signed
    // order body sent to clob.polymarket.com over HTTPS.
    const signer = new Wallet(getSigningKey());
    const host = "https://clob.polymarket.com";

    const creds = await new ClobClient(host, config.CHAIN_ID, signer).createOrDeriveApiKey();

    this.clobClient = new ClobClient(
      host,
      config.CHAIN_ID,
      signer,
      creds,
      1,
      config.POLY_FUNDER_ADDRESS
    );

    return this.clobClient;
  }

  async executeSell(order: TradeOrder): Promise<TradeResult> {
    const sellOrder = { ...order, orderSide: "SELL" as const };
    if (this.mode === "preview") {
      const tradeId = recordTrade(this.db, {
        trader_address: order.traderAddress,
        market_slug: order.marketSlug,
        condition_id: order.conditionId,
        token_id: order.tokenId,
        side: "SELL",
        price: order.price,
        amount: order.amount,
        original_amount: order.originalAmount,
        mode: "preview",
        status: "simulated",
      });
      log("trade", `[PREVIEW] Simulated SELL $${order.amount} @ ${order.price} on ${order.marketSlug}`);
      return { tradeId, mode: "preview", status: "simulated", message: `Simulated: SELL $${order.amount} @ ${order.price}` };
    }

    return this.executeLiveTrade(sellOrder);
  }

  private recordFailedTrade(order: TradeOrder, reason: string): TradeResult {
    const tradeId = recordTrade(this.db, {
      trader_address: order.traderAddress,
      market_slug: order.marketSlug,
      condition_id: order.conditionId,
      token_id: order.tokenId,
      side: order.orderSide ?? "BUY",
      price: order.price,
      amount: order.amount,
      original_amount: order.originalAmount,
      mode: "live",
      status: "failed",
    });
    return { tradeId, mode: "live", status: "failed", message: `Failed: ${reason}` };
  }

  async cancelAllOrders(): Promise<{ cancelled: number }> {
    const client = await this.getClobClient();
    const openOrders = await client.getOpenOrders();
    if (!openOrders || openOrders.length === 0) return { cancelled: 0 };
    await client.cancelAll();
    return { cancelled: openOrders.length };
  }

  setMode(mode: "preview" | "live"): void {
    this.mode = mode;
    this.clobClient = null;
  }

  getMode(): string {
    return this.mode;
  }
}
