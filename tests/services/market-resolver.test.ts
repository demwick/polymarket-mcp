import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../../src/utils/fetch.js", () => ({
  fetchWithRetry: vi.fn(async (url: string) => globalThis.fetch(url)),
}));

import { resolveMarketByConditionId, pickTokenId, pickPrice } from "../../src/services/market-resolver.js";

const clobMarketFixture = {
  condition_id: "cond123",
  market_slug: "test-market",
  question: "Will it happen?",
  minimum_tick_size: 0.01,
  neg_risk: false,
  tokens: [
    { token_id: "tok_yes", outcome: "Yes", price: 0.65 },
    { token_id: "tok_no", outcome: "No", price: 0.35 },
  ],
};

describe("resolveMarketByConditionId", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns market info from CLOB API with yes/no tokens", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(clobMarketFixture));

    const result = await resolveMarketByConditionId("cond123");
    expect(result).not.toBeNull();
    expect(result!.conditionId).toBe("cond123");
    expect(result!.yesTokenId).toBe("tok_yes");
    expect(result!.noTokenId).toBe("tok_no");
    expect(result!.yesPrice).toBe(0.65);
    expect(result!.noPrice).toBe(0.35);
    expect(result!.tokenId).toBe("tok_yes"); // back-compat alias
    expect(result!.slug).toBe("test-market");
    expect(result!.question).toBe("Will it happen?");
    expect(result!.tickSize).toBe("0.01");
    expect(result!.negRisk).toBe(false);
  });

  it("returns null when tokens array is missing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ condition_id: "cond123" }));
    const result = await resolveMarketByConditionId("cond123");
    expect(result).toBeNull();
  });

  it("returns null when a side token is missing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        condition_id: "cond123",
        tokens: [{ token_id: "tok_yes", outcome: "Yes", price: 0.5 }],
      })
    );
    const result = await resolveMarketByConditionId("cond123");
    expect(result).toBeNull();
  });

  it("returns null on non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 404 }));
    const result = await resolveMarketByConditionId("cond_err");
    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));
    const result = await resolveMarketByConditionId("cond_err");
    expect(result).toBeNull();
  });

  it("handles missing optional fields with defaults", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        condition_id: "cond123",
        tokens: [
          { token_id: "tok_yes", outcome: "Yes" },
          { token_id: "tok_no", outcome: "No" },
        ],
      })
    );

    const result = await resolveMarketByConditionId("cond123");
    expect(result).not.toBeNull();
    expect(result!.slug).toBe("");
    expect(result!.tickSize).toBe("0.01");
    expect(result!.negRisk).toBe(false);
    expect(result!.yesPrice).toBe(0);
    expect(result!.noPrice).toBe(0);
  });
});

describe("pickTokenId / pickPrice", () => {
  const info = {
    conditionId: "c",
    slug: "s",
    question: "q",
    tickSize: "0.01",
    negRisk: false,
    yesTokenId: "yes_tok",
    noTokenId: "no_tok",
    yesPrice: 0.6,
    noPrice: 0.4,
    tokenId: "yes_tok",
  };

  it("picks yes token by default", () => {
    expect(pickTokenId(info, "YES")).toBe("yes_tok");
    expect(pickPrice(info, "YES")).toBe(0.6);
  });

  it("picks no token when outcome is NO", () => {
    expect(pickTokenId(info, "NO")).toBe("no_tok");
    expect(pickPrice(info, "NO")).toBe(0.4);
  });
});
