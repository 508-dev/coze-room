import type { ClientFeature } from "./feature";

export const registerPresence: ClientFeature = (state, connection) => {
  const off = [
    connection.on("welcome", (message) => {
      state.selfId = message.selfId;
      state.room = message.room;
      state.occupants = message.occupants;
      state.roomFull = false;
      state.connected = true;
    }),
    connection.on("joined", ({ occupant }) => {
      state.occupants = [...state.occupants.filter((o) => o.id !== occupant.id), occupant];
    }),
    connection.on("left", ({ id }) => {
      state.occupants = state.occupants.filter((o) => o.id !== id);
    }),
    connection.on("dozed", ({ id, asleep }) => {
      state.occupants = state.occupants.map((o) => (o.id === id ? { ...o, asleep } : o));
    }),
    connection.on("full", ({ occupants }) => {
      // Deliberately show who is in there rather than an error screen.
      state.occupants = occupants;
      state.roomFull = true;
      state.connected = false;
    }),
  ];
  return () => {
    for (const remove of off) remove();
  };
};
