function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Eight choices per avatar layer; reject rather than clamp untrusted indices. */
function look(value: unknown): boolean {
  return (
    object(value) &&
    ["tone", "head", "top", "accessory"].every((field) => {
      const index = value[field];
      return typeof index === "number" && Number.isInteger(index) && index >= 0 && index < 8;
    })
  );
}

/** decode() is only an envelope parser. Each feature validates its own payloads. */
export function isValidCoreClientMessage(message: unknown): boolean {
  if (!object(message) || typeof message.t !== "string") return false;
  switch (message.t) {
    case "join":
      return typeof message.name === "string" && look(message.look);
    case "takeSeat":
      return typeof message.seatId === "string";
    default:
      // stand/awake/pong have no fields. Unknown tags belong to feature validators.
      return true;
  }
}
