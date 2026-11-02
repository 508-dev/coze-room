import type { ClientFeature } from "./feature";

export const registerSeating: ClientFeature = (state, connection) => {
  const offMove = connection.on("moved", ({ id, seatId }) => {
    state.occupants = state.occupants.map((o) => (o.id === id ? { ...o, seatId } : o));
  });
  const offClick = state.events.on("seatClick", ({ seatId }) => state.takeSeat(seatId));
  return () => {
    offMove();
    offClick();
  };
};
