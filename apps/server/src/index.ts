import { type ClientMessage, decode } from "@dormouse/protocol";
import { Room, type RoomSocket } from "./room";
import { findRoom, PUBLIC_ROOMS } from "./rooms";

const PORT = Number(process.env.API_PORT ?? 8820);
const TICK_MS = 15_000;

/** Every public room exists from boot. There is no room creation yet. */
const rooms = new Map<string, Room>(PUBLIC_ROOMS.map((spec) => [spec.id, new Room(spec)]));

setInterval(() => {
  for (const room of rooms.values()) room.tick();
}, TICK_MS);

const server = Bun.serve<{ occupantId: string; roomId: string }, never>({
  port: PORT,

  fetch(request, srv) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true, rooms: rooms.size });
    }

    // A minimal public listing. Occupancy is shown so that choosing a room is
    // part of winding down rather than a loading screen.
    if (url.pathname === "/rooms") {
      return Response.json(
        [...rooms.values()].map((room) => ({
          id: room.spec.id,
          name: room.spec.name,
          occupants: room.occupants.length,
          capacity: room.spec.capacity,
          asleep: room.occupants.filter((o) => o.asleep).length,
        })),
      );
    }

    if (url.pathname === "/ws") {
      const roomId = url.searchParams.get("room") ?? PUBLIC_ROOMS[0]?.id;
      if (!roomId || !findRoom(roomId)) return new Response("no such room", { status: 404 });

      const upgraded = srv.upgrade(request, {
        data: { occupantId: crypto.randomUUID(), roomId },
      });
      return upgraded ? undefined : new Response("expected a websocket", { status: 426 });
    }

    return new Response("not found", { status: 404 });
  },

  websocket: {
    open(ws: RoomSocket) {
      const room = rooms.get(ws.data.roomId);
      if (!room) {
        ws.close(1011, "room vanished");
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

      switch (msg.t) {
        case "join":
          room.join(ws.data.occupantId, msg.name.slice(0, 24), msg.look, ws);
          break;
        case "takeSeat":
          room.takeSeat(ws.data.occupantId, msg.seatId);
          break;
        case "stand":
          room.stand(ws.data.occupantId);
          break;
        case "awake":
          room.touchById(ws.data.occupantId);
          break;
        case "pong":
          break;
      }
    },

    close(ws: RoomSocket) {
      rooms.get(ws.data.roomId)?.disconnect(ws.data.occupantId);
    },
  },
});

console.info(`dormouse server listening on http://127.0.0.1:${server.port}`);
