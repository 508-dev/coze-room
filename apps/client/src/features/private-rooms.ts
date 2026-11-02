import type { PrivateRoomCreated, PublicRoomSummary } from "@dormouse/protocol";
import { apiUrl } from "../net/api-base";

export async function listPublicRooms(): Promise<PublicRoomSummary[]> {
  const response = await fetch(apiUrl("/rooms"));
  if (!response.ok) throw new Error("could not list rooms");
  return (await response.json()) as PublicRoomSummary[];
}

export async function createPrivateRoom(): Promise<PrivateRoomCreated> {
  const response = await fetch(apiUrl("/rooms/private"), { method: "POST" });
  if (!response.ok) throw new Error("could not create a private room");
  return (await response.json()) as PrivateRoomCreated;
}
