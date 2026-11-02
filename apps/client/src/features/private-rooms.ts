import type { PrivateRoomCreated, PublicRoomSummary } from "@dormouse/protocol";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8820";

export async function listPublicRooms(): Promise<PublicRoomSummary[]> {
  const response = await fetch(new URL("/rooms", API_BASE));
  if (!response.ok) throw new Error("could not list rooms");
  return (await response.json()) as PublicRoomSummary[];
}

export async function createPrivateRoom(): Promise<PrivateRoomCreated> {
  const response = await fetch(new URL("/rooms/private", API_BASE), { method: "POST" });
  if (!response.ok) throw new Error("could not create a private room");
  return (await response.json()) as PrivateRoomCreated;
}
