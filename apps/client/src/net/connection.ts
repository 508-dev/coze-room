import type { AvatarLook, ClientMessage, ServerMessage } from "@dormouse/protocol";
import { decode, encode } from "@dormouse/protocol";

export type Handler = (message: ServerMessage) => void;

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8820";

/**
 * A thin WebSocket wrapper. Reconnects with backoff, because this app is
 * expected to survive a phone dropping wifi at 3am -- the server holds the
 * seat for two minutes, so a quiet reconnect should look like nothing
 * happened.
 */
export class Connection {
  private socket: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private retry = 0;
  private closed = false;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly roomId: string,
    private readonly identity: { name: string; look: AvatarLook },
  ) {}

  connect(): void {
    if (this.closed) return;
    const url = new URL("/ws", API_BASE);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.searchParams.set("room", this.roomId);

    const socket = new WebSocket(url);
    this.socket = socket;

    socket.addEventListener("open", () => {
      this.retry = 0;
      this.send({ t: "join", name: this.identity.name, look: this.identity.look });
    });

    socket.addEventListener("message", (event) => {
      const message = decode<ServerMessage>(String(event.data));
      if (message) for (const handler of this.handlers) handler(message);
    });

    socket.addEventListener("close", () => {
      if (this.closed) return;
      // Backoff caps at 10s. There is no hurry; nobody is watching.
      const delay = Math.min(10_000, 500 * 2 ** this.retry++);
      this.retryTimer = setTimeout(() => this.connect(), delay);
    });
  }

  on<T extends ServerMessage["t"]>(
    type: T,
    handler: (message: Extract<ServerMessage, { t: T }>) => void,
  ): () => void {
    const wrapped: Handler = (message) => {
      if (message.t === type) handler(message as Extract<ServerMessage, { t: T }>);
    };
    this.handlers.add(wrapped);
    return () => this.handlers.delete(wrapped);
  }

  send(message: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(encode(message));
  }

  dispose(): void {
    this.closed = true;
    clearTimeout(this.retryTimer);
    this.handlers.clear();
    this.socket?.close();
  }
}
