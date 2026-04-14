import { describe, it, expect, beforeEach, vi } from "vitest";
import { handleWatchPrice } from "../../src/tools/watch-price.js";
import type { PriceStream } from "../../src/services/price-stream.js";

type PriceStreamMock = {
  isConnected: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  unsubscribe: ReturnType<typeof vi.fn>;
  getLastPrice: ReturnType<typeof vi.fn>;
  getSubscriptionCount: ReturnType<typeof vi.fn>;
};

function makeStream(overrides: Partial<PriceStreamMock> = {}): PriceStreamMock {
  return {
    isConnected: vi.fn().mockReturnValue(true),
    connect: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    getLastPrice: vi.fn().mockReturnValue(undefined),
    getSubscriptionCount: vi.fn().mockReturnValue(0),
    ...overrides,
  };
}

describe("handleWatchPrice", () => {
  let stream: PriceStreamMock;

  beforeEach(() => {
    stream = makeStream();
  });

  it("returns status table with connection info", () => {
    stream.getSubscriptionCount.mockReturnValue(3);
    stream.isConnected.mockReturnValue(true);

    const result = handleWatchPrice(stream as unknown as PriceStream, { action: "status" });

    expect(result).toContain("Price Stream Status");
    expect(result).toContain("Connected");
    expect(result).toContain("Yes");
    expect(result).toContain("| 3 |");
  });

  it("shows No when disconnected", () => {
    stream.isConnected.mockReturnValue(false);
    stream.getSubscriptionCount.mockReturnValue(0);

    const result = handleWatchPrice(stream as unknown as PriceStream, { action: "status" });

    expect(result).toContain("| No |");
    expect(result).toContain("| 0 |");
  });

  it("requires token_id for subscribe", () => {
    const result = handleWatchPrice(stream as unknown as PriceStream, { action: "subscribe" });
    expect(result).toContain("token_id");
    expect(stream.subscribe).not.toHaveBeenCalled();
  });

  it("requires token_id for unsubscribe", () => {
    const result = handleWatchPrice(stream as unknown as PriceStream, { action: "unsubscribe" });
    expect(result).toContain("token_id");
    expect(stream.unsubscribe).not.toHaveBeenCalled();
  });

  it("subscribes and connects first when not connected", () => {
    stream.isConnected.mockReturnValue(false);
    const tokenId = "0xdeadbeefcafe1234567890";

    const result = handleWatchPrice(stream as unknown as PriceStream, {
      action: "subscribe",
      token_id: tokenId,
    });

    expect(stream.connect).toHaveBeenCalledTimes(1);
    expect(stream.subscribe).toHaveBeenCalledTimes(1);
    expect(stream.subscribe.mock.calls[0][0]).toBe(tokenId);
    expect(result).toContain("Subscribed");
    expect(result).toContain(tokenId.slice(0, 12));
  });

  it("does not reconnect when already connected, and shows last price", () => {
    stream.isConnected.mockReturnValue(true);
    stream.getLastPrice.mockReturnValue({ tokenId: "abc", price: 0.6123, timestamp: 1 });

    const result = handleWatchPrice(stream as unknown as PriceStream, {
      action: "subscribe",
      token_id: "abcdefghijklmnop",
    });

    expect(stream.connect).not.toHaveBeenCalled();
    expect(stream.subscribe).toHaveBeenCalledTimes(1);
    expect(result).toContain("Last price: $0.6123");
  });

  it("unsubscribes the given token", () => {
    const tokenId = "tok_1234567890abcdef";

    const result = handleWatchPrice(stream as unknown as PriceStream, {
      action: "unsubscribe",
      token_id: tokenId,
    });

    expect(stream.unsubscribe).toHaveBeenCalledWith(tokenId);
    expect(result).toContain("Unsubscribed");
    expect(result).toContain(tokenId.slice(0, 12));
  });
});
