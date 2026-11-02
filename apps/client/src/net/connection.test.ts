import type { ServerMessage } from "@dormouse/protocol";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Connection } from "./connection";

class FakeSocket extends EventTarget {
  static OPEN = 1;
  static instances: FakeSocket[] = [];
  readyState = 0;
  send = vi.fn();

  constructor(readonly url: URL) {
    super();
    FakeSocket.instances.push(this);
  }

  open() {
    this.readyState = FakeSocket.OPEN;
    this.dispatchEvent(new Event("open"));
  }

  receive(message: ServerMessage) {
    this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(message) }));
  }

  close(code = 1000) {
    this.readyState = 3;
    const event = new Event("close");
    Object.defineProperty(event, "code", { value: code });
    this.dispatchEvent(event);
  }
}

function socket(): FakeSocket {
  const current = FakeSocket.instances.at(-1);
  if (!current) throw new Error("no socket");
  return current;
}

function connect() {
  const connection = new Connection(
    { roomId: "the-back-room" },
    {
      name: "guest",
      look: { tone: 0, head: 0, top: 0, accessory: 0 },
    },
  );
  connection.connect();
  return connection;
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeSocket);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Connection feature handlers", () => {
  it("retains the join wire format and room selection", () => {
    const connection = connect();
    expect(socket().url.searchParams.get("room")).toBe("the-back-room");
    socket().open();
    expect(JSON.parse(socket().send.mock.calls[0]?.[0])).toEqual({
      t: "join",
      name: "guest",
      look: { tone: 0, head: 0, top: 0, accessory: 0 },
    });
    connection.dispose();
  });

  it("joins private rooms by code instead of exposing a room id", () => {
    const connection = new Connection(
      { code: "amber-apple-arch" },
      { name: "guest", look: { tone: 0, head: 0, top: 0, accessory: 0 } },
    );
    connection.connect();

    expect(socket().url.searchParams.get("code")).toBe("amber-apple-arch");
    expect(socket().url.searchParams.has("room")).toBe(false);
    connection.dispose();
  });

  it("stops reconnecting and reports a deliberately closed private room", () => {
    const onRoomClosed = vi.fn();
    const connection = new Connection(
      { code: "amber-apple-arch" },
      { name: "guest", look: { tone: 0, head: 0, top: 0, accessory: 0 } },
      onRoomClosed,
    );
    connection.connect();
    socket().close(4004);
    vi.advanceTimersByTime(30_000);

    expect(onRoomClosed).toHaveBeenCalledOnce();
    expect(FakeSocket.instances).toHaveLength(1);
    connection.dispose();
  });

  it("stops reconnecting after a full-room snapshot", () => {
    const connection = connect();
    socket().close(1013);
    vi.advanceTimersByTime(30_000);

    expect(FakeSocket.instances).toHaveLength(1);
    connection.dispose();
  });

  it("delivers only matching message types to all subscribing features", () => {
    const connection = connect();
    const first = vi.fn();
    const second = vi.fn();
    const unrelated = vi.fn();
    connection.on("moved", first);
    connection.on("moved", second);
    connection.on("left", unrelated);
    const message = { t: "moved", id: "a", seatId: "hammock" } as const;
    socket().receive(message);
    expect(first).toHaveBeenCalledExactlyOnceWith(message);
    expect(second).toHaveBeenCalledExactlyOnceWith(message);
    expect(unrelated).not.toHaveBeenCalled();
    connection.dispose();
  });

  it("unsubscribes a feature without removing another feature's handler", () => {
    const connection = connect();
    const first = vi.fn();
    const second = vi.fn();
    const remove = connection.on("left", first);
    connection.on("left", second);
    remove();
    socket().receive({ t: "left", id: "a" });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
    connection.dispose();
  });

  it("keeps feature subscriptions across reconnects", () => {
    const connection = connect();
    const handler = vi.fn();
    connection.on("ping", handler);
    socket().close();
    vi.advanceTimersByTime(500);
    expect(FakeSocket.instances).toHaveLength(2);
    socket().receive({ t: "ping" });
    expect(handler).toHaveBeenCalledOnce();
    connection.dispose();
  });

  it("does not reconnect or deliver feature events after disposal", () => {
    const connection = connect();
    const handler = vi.fn();
    connection.on("ping", handler);
    socket().close();
    connection.dispose();
    vi.advanceTimersByTime(30_000);
    connection.connect();
    expect(FakeSocket.instances).toHaveLength(1);
    socket().receive({ t: "ping" });
    expect(handler).not.toHaveBeenCalled();
  });
});
