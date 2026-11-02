import type { Connection } from "../net/connection";
import type { RoomState } from "../state/room.svelte";

/** Register typed Connection.on handlers; return their cleanup. */
export type ClientFeature = (state: RoomState, connection: Connection) => () => void;
