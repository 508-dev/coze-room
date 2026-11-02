/** Features extend this interface in their own module via declaration merging. */
export interface SceneEvents {
  seatClick: { seatId: string };
  /** Emitted by the Scene whenever the room transform changes (resize/room load). */
  roomTransform: RoomTransform;
  /** Per-seat head anchors in room coordinates, or null when using placeholder art. */
  heads: Record<string, { x: number; y: number }> | null;
}

export interface RoomTransform {
  /** Integer room scale for large viewports, fractional fit for small ones. */
  scale: number;
  /** Screen offset of the room's top-left, in CSS pixels. */
  x: number;
  y: number;
  /** The canvas host size, in CSS pixels, for viewport clamping. */
  width: number;
  height: number;
}

/** Typed, per-app canvas/DOM bridge. It stays live while Pixi is throttled. */
export class RoomEvents {
  private handlers = new Map<keyof SceneEvents, Set<(payload: unknown) => void>>();

  on<K extends keyof SceneEvents>(type: K, handler: (payload: SceneEvents[K]) => void): () => void {
    const wrapped = (payload: unknown) => handler(payload as SceneEvents[K]);
    let handlers = this.handlers.get(type);
    if (!handlers) {
      handlers = new Set();
      this.handlers.set(type, handlers);
    }
    handlers.add(wrapped);
    return () => {
      if (handlers.delete(wrapped) && handlers.size === 0) this.handlers.delete(type);
    };
  }

  emit<K extends keyof SceneEvents>(type: K, payload: SceneEvents[K]): void {
    for (const handler of this.handlers.get(type) ?? []) handler(payload);
  }
}
