export type SeatingClientMessage = { t: "takeSeat"; seatId: string } | { t: "stand" };

export type SeatingServerMessage = { t: "moved"; id: string; seatId: string | null };
