import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { EventEmitter } from "events";

vi.mock("ws", async () => {
  const { EventEmitter: EE } = await import("events");
  class FakeWebSocket extends EE {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    readyState = 0;
    sentMessages: string[] = [];
    pingCalls = 0;
    url: string;

    constructor(url: string) {
      super();
      this.url = url;
      (globalThis as unknown as { __lastFakeWs?: FakeWebSocket }).__lastFakeWs = this;
    }

    send(data: string) {
      this.sentMessages.push(data);
    }
    close() {
      this.readyState = 3;
      this.emit("close");
    }
    ping() {
      this.pingCalls++;
    }
  }
  return { default: FakeWebSocket };
});

import { PriceStream } from "../../src/services/price-stream.js";

type FakeWs = EventEmitter & {
  readyState: number;
  sentMessages: string[];
  pingCalls: number;
  url: string;
  send(data: string): void;
  close(): void;
  ping(): void;
};

function getFakeWs(): FakeWs {
  const ws = (globalThis as unknown as { __lastFakeWs?: FakeWs }).__lastFakeWs;
  if (!ws) throw new Error("No FakeWebSocket instance yet — call stream.connect() first");
  return ws;
}

function openConnection(stream: PriceStream): FakeWs {
  stream.connect();
  const ws = getFakeWs();
  ws.readyState = 1;
  ws.emit("open");
  return ws;
}

function deliverMessage(ws: FakeWs, payload: Record<string, unknown>): void {
  ws.emit("message", Buffer.from(JSON.stringify(payload)));
}

describe("PriceStream", () => {
  let stream: PriceStream;

  beforeEach(() => {
    vi.useFakeTimers();
    (globalThis as unknown as { __lastFakeWs?: FakeWs }).__lastFakeWs = undefined;
    stream = new PriceStream();
  });

  afterEach(() => {
    stream.disconnect();
    vi.useRealTimers();
  });

  describe("connection lifecycle", () => {
    it("opens a WebSocket to the public price feed on connect()", () => {
      stream.connect();
      const ws = getFakeWs();
      expect(ws.url).toContain("ws-subscriptions-clob.polymarket.com");
    });

    it("isConnected reflects the underlying socket state", () => {
      expect(stream.isConnected()).toBe(false);
      openConnection(stream);
      expect(stream.isConnected()).toBe(true);
    });

    it("connect() is a no-op when already open", () => {
      openConnection(stream);
      const first = getFakeWs();
      stream.connect();
      expect(getFakeWs()).toBe(first);
    });

    it("disconnect() clears subscriptions and closes the socket", () => {
      stream.subscribe("tok1", vi.fn());
      stream.subscribe("tok2", vi.fn());
      const ws = openConnection(stream);
      stream.disconnect();
      expect(stream.getSubscriptionCount()).toBe(0);
      expect(ws.readyState).toBe(3);
      expect(stream.isConnected()).toBe(false);
    });
  });

  describe("subscribe / unsubscribe", () => {
    it("queues subscriptions before the socket opens", () => {
      const cb = vi.fn();
      stream.subscribe("tok1", cb);
      expect(stream.getSubscriptionCount()).toBe(1);
      expect(cb).not.toHaveBeenCalled();
    });

    it("sends subscribe message once the socket is open", () => {
      const ws = openConnection(stream);
      stream.subscribe("tok1", vi.fn());
      expect(ws.sentMessages).toHaveLength(1);
      const parsed = JSON.parse(ws.sentMessages[0]);
      expect(parsed).toEqual({ type: "subscribe", channel: "market", assets_id: "tok1" });
    });

    it("resubscribes all pending subscriptions when the socket opens", () => {
      stream.subscribe("tok1", vi.fn());
      stream.subscribe("tok2", vi.fn());
      const ws = openConnection(stream);
      expect(ws.sentMessages).toHaveLength(2);
      const tokens = ws.sentMessages.map((m) => JSON.parse(m).assets_id).sort();
      expect(tokens).toEqual(["tok1", "tok2"]);
    });

    it("unsubscribe with callback removes only that listener", () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      stream.subscribe("tok1", cb1);
      stream.subscribe("tok1", cb2);
      stream.unsubscribe("tok1", cb1);
      expect(stream.getSubscriptionCount()).toBe(1);

      const ws = openConnection(stream);
      deliverMessage(ws, { asset_id: "tok1", price: "0.5" });
      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).toHaveBeenCalledTimes(1);
    });

    it("unsubscribe without callback removes all listeners for that token", () => {
      stream.subscribe("tok1", vi.fn());
      stream.subscribe("tok1", vi.fn());
      stream.unsubscribe("tok1");
      expect(stream.getSubscriptionCount()).toBe(0);
    });

    it("new subscriber receives the last known price immediately", () => {
      stream.subscribe("tok1", vi.fn());
      const ws = openConnection(stream);
      deliverMessage(ws, { asset_id: "tok1", price: "0.42" });

      const secondCb = vi.fn();
      stream.subscribe("tok1", secondCb);
      expect(secondCb).toHaveBeenCalledWith(
        expect.objectContaining({ tokenId: "tok1", price: 0.42 })
      );
    });
  });

  describe("message handling", () => {
    it("dispatches updates using asset_id + price fields", () => {
      const cb = vi.fn();
      stream.subscribe("tok1", cb);
      const ws = openConnection(stream);
      deliverMessage(ws, { asset_id: "tok1", price: "0.58" });
      expect(cb).toHaveBeenCalledWith(
        expect.objectContaining({ tokenId: "tok1", price: 0.58 })
      );
    });

    it("accepts market and last_price aliases", () => {
      const cb = vi.fn();
      stream.subscribe("tokX", cb);
      const ws = openConnection(stream);
      deliverMessage(ws, { market: "tokX", last_price: "0.31" });
      expect(cb).toHaveBeenCalledWith(
        expect.objectContaining({ tokenId: "tokX", price: 0.31 })
      );
    });

    it("accepts token_id alias", () => {
      const cb = vi.fn();
      stream.subscribe("tokY", cb);
      const ws = openConnection(stream);
      deliverMessage(ws, { token_id: "tokY", price: "0.77" });
      expect(cb).toHaveBeenCalledWith(
        expect.objectContaining({ tokenId: "tokY", price: 0.77 })
      );
    });

    it("ignores messages with missing tokenId", () => {
      const cb = vi.fn();
      stream.subscribe("tok1", cb);
      const ws = openConnection(stream);
      deliverMessage(ws, { price: "0.5" });
      expect(cb).not.toHaveBeenCalled();
    });

    it("ignores non-positive prices", () => {
      const cb = vi.fn();
      stream.subscribe("tok1", cb);
      const ws = openConnection(stream);
      deliverMessage(ws, { asset_id: "tok1", price: "0" });
      deliverMessage(ws, { asset_id: "tok1", price: "-1" });
      expect(cb).not.toHaveBeenCalled();
    });

    it("swallows malformed JSON without crashing", () => {
      const cb = vi.fn();
      stream.subscribe("tok1", cb);
      const ws = openConnection(stream);
      expect(() => ws.emit("message", Buffer.from("not-json"))).not.toThrow();
      expect(cb).not.toHaveBeenCalled();
    });

    it("getLastPrice returns the most recent update per token", () => {
      stream.subscribe("tok1", vi.fn());
      const ws = openConnection(stream);
      deliverMessage(ws, { asset_id: "tok1", price: "0.45" });
      deliverMessage(ws, { asset_id: "tok1", price: "0.51" });
      expect(stream.getLastPrice("tok1")?.price).toBe(0.51);
      expect(stream.getLastPrice("nonexistent")).toBeUndefined();
    });

    it("callback errors do not break sibling subscribers", () => {
      const throwing = vi.fn(() => {
        throw new Error("boom");
      });
      const healthy = vi.fn();
      stream.subscribe("tok1", throwing);
      stream.subscribe("tok1", healthy);
      const ws = openConnection(stream);
      deliverMessage(ws, { asset_id: "tok1", price: "0.4" });
      expect(throwing).toHaveBeenCalled();
      expect(healthy).toHaveBeenCalled();
    });
  });
});
