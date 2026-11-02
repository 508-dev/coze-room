import { type ClientMessage, decode } from "@dormouse/protocol";
import { RateLimiter } from "./rate-limit";
import type { RoomSocket } from "./room";
import { RoomRegistry } from "./room-registry";
import { serveStatic } from "./static";

const PORT = Number(process.env.API_PORT ?? 8820);
const TICK_MS = 15_000;
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const rooms = new RoomRegistry();
const privateRoomCreation = new RateLimiter(5, 10 * 60 * 1000);
const privateRoomJoins = new RateLimiter(20, 5 * 60 * 1000);

setInterval(() => {
  rooms.tick();
}, TICK_MS);

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(data, { status, headers: { ...CORS_HEADERS, ...headers } });
}

function clientIp(request: Request, directAddress: string | undefined): string {
  if (process.env.TRUST_PROXY === "1") {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded;
  }
  return directAddress ?? "unknown";
}

const server = Bun.serve<{ occupantId: string; roomId: string }, never>({
  hostname: process.env.API_HOST ?? "0.0.0.0",
  port: PORT,

  fetch(request, srv) {
    const url = new URL(request.url);
    const ip = clientIp(request, srv.requestIP(request)?.address);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (url.pathname === "/health") {
      return json({ ok: true, rooms: rooms.size });
    }

    // Only the fixed public specifications are discoverable. Private occupancy
    // and even private-room counts stay out of every listing and health response.
    if (url.pathname === "/rooms") {
      return json(rooms.list());
    }

    if (url.pathname === "/rooms/private" && request.method === "POST") {
      const limit = privateRoomCreation.check(ip);
      if (!limit.allowed) {
        return json({ error: "too many rooms created" }, 429, {
          "Retry-After": String(limit.retryAfterSeconds),
        });
      }
      return json(rooms.createPrivateRoom(), 201);
    }

    if (url.pathname === "/ws") {
      const code = url.searchParams.get("code");
      if (code !== null) {
        const limit = privateRoomJoins.check(ip);
        if (!limit.allowed) {
          return new Response("too many join attempts", {
            status: 429,
            headers: { ...CORS_HEADERS, "Retry-After": String(limit.retryAfterSeconds) },
          });
        }
        const room = rooms.getByCode(code);
        // Complete the upgrade even for a closed room so the browser receives a
        // deliberate close code instead of an opaque failed-handshake error.
        const upgraded = srv.upgrade(request, {
          data: { occupantId: crypto.randomUUID(), roomId: room?.spec.id ?? "" },
        });
        return upgraded ? undefined : new Response("expected a websocket", { status: 426 });
      }

      const roomId = url.searchParams.get("room") ?? rooms.defaultRoomId;
      if (!roomId || !rooms.get(roomId) || rooms.isPrivate(roomId)) {
        return new Response("no such room", { status: 404 });
      }
      const upgraded = srv.upgrade(request, {
        data: { occupantId: crypto.randomUUID(), roomId },
      });
      return upgraded ? undefined : new Response("expected a websocket", { status: 426 });
    }

    return serveStatic(url.pathname);
  },

  websocket: {
    open(ws: RoomSocket) {
      const room = rooms.get(ws.data.roomId);
      if (!room) {
        ws.close(4004, "room closed");
        return;
      }
      if (room.isFull) {
        ws.send(JSON.stringify({ t: "full", occupants: room.occupants }));
        ws.close(1013, "room full");
      }
    },

    message(ws: RoomSocket, raw) {
      const room = rooms.get(ws.data.roomId);
      if (!room) return;

      const msg = decode<ClientMessage>(typeof raw === "string" ? raw : raw.toString());
      if (!msg) return;

      room.handleMessage(ws.data.occupantId, msg, ws);
    },

    close(ws: RoomSocket) {
      rooms.get(ws.data.roomId)?.disconnect(ws.data.occupantId);
    },
  },
});

console.info(`dormouse server listening on http://${server.hostname}:${server.port}`);
