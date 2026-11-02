import { Container, Texture } from "pixi.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PUBLIC_ROOMS } from "../../../server/src/rooms";
import { RoomEvents } from "./events";
import type { LoadedPack } from "./packs/loader";
import { Scene } from "./scene";

const mocks = vi.hoisted(() => ({
  loadPack: vi.fn<(id: string) => Promise<LoadedPack | null>>(),
  attach: vi.fn(),
  room: vi.fn(),
  occupants: vi.fn(),
  update: vi.fn(),
  destroy: vi.fn(),
  addTicker: vi.fn<(callback: (ticker: { elapsedMS: number }) => void) => void>(),
  disconnect: vi.fn(),
}));

vi.mock("./packs/loader", () => ({ loadPack: mocks.loadPack }));
vi.mock("./layers/registry", () => ({
  sceneLayers: [
    () => ({
      slot: "avatars",
      attach: mocks.attach,
      onRoomChange: mocks.room,
      onOccupantsChange: mocks.occupants,
      update: mocks.update,
      destroy: mocks.destroy,
    }),
  ],
}));
vi.mock("pixi.js", async (importOriginal) => {
  const pixi = await importOriginal<typeof import("pixi.js")>();
  return {
    ...pixi,
    Application: class {
      stage = new pixi.Container();
      canvas = {};
      init = vi.fn(async () => {});
      renderer = { resize: vi.fn() };
      ticker = {
        add: mocks.addTicker,
        remove: vi.fn(),
        maxFPS: 0,
        start: vi.fn(),
        stop: vi.fn(),
      };
      destroy = vi.fn();
    },
  };
});

const publicRoom = PUBLIC_ROOMS[0];
if (!publicRoom) throw new Error("no public room");
// Orchestration tests explicitly use a room without a selected pack.
const { packId: _packId, ...room } = publicRoom;

async function init() {
  const scene = new Scene();
  await scene.init(
    { clientWidth: 1400, clientHeight: 900, appendChild: vi.fn() } as unknown as HTMLElement,
    new RoomEvents(),
  );
  return scene;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadPack.mockReset();
  vi.stubGlobal("window", { devicePixelRatio: 1 });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect = mocks.disconnect;
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("Scene orchestration", () => {
  it.each([
    [0, 1],
    [1, 1],
    [1.5, 1.5],
    [3, 2],
  ])(
    "renders DPR %s at resolution %s without changing CSS pointer coordinates",
    async (dpr, resolution) => {
      vi.stubGlobal("window", { devicePixelRatio: dpr });
      const scene = await init();
      expect(scene.app.init).toHaveBeenCalledWith(
        expect.objectContaining({ resolution, autoDensity: true, antialias: false }),
      );
      scene.drawRoom(room);
      expect(scene.toRoomPoint({ x: 1020, y: 590 })).toMatchObject({ x: 480, y: 250 });
      scene.destroy();
    },
  );

  it("attaches to named slots and forwards room, occupant and clock hooks", async () => {
    const scene = await init();
    const context = mocks.attach.mock.calls[0]?.[0];
    expect(context.container).toBeInstanceOf(Container);
    scene.drawRoom(room);
    scene.syncOccupants([], "a");
    mocks.addTicker.mock.calls[0]?.[0]({ elapsedMS: 200 });
    expect(mocks.room).toHaveBeenCalledWith(room, null);
    expect(mocks.occupants).toHaveBeenCalledWith([], "a");
    expect(mocks.update).toHaveBeenCalledWith(0.2, expect.any(Number));
    expect(scene.toRoomPoint({ x: 1020, y: 590 })).toMatchObject({ x: 480, y: 250 });
    scene.driftOff(true);
    expect(scene.app.ticker.maxFPS).toBe(5);
    scene.driftOff(false);
    expect(scene.app.ticker.maxFPS).toBe(0);
    scene.setPaused(true);
    expect(scene.app.ticker.stop).toHaveBeenCalledOnce();
    scene.setPaused(false);
    expect(scene.app.ticker.start).toHaveBeenCalledOnce();
    scene.destroy();
    expect(mocks.destroy).toHaveBeenCalledOnce();
    expect(mocks.disconnect).toHaveBeenCalledOnce();
  });

  it("keeps placeholders visible when pack loading fails", async () => {
    mocks.loadPack.mockResolvedValue(null);
    const scene = await init();
    const selected = { ...room, packId: "missing" };
    scene.drawRoom(selected);
    expect(mocks.room).toHaveBeenLastCalledWith(selected, null);
    await Promise.resolve();
    expect(mocks.room).toHaveBeenLastCalledWith(selected, null);
    scene.destroy();
  });

  it("notifies layers and recalculates the integer transform from the loaded pack size", async () => {
    const pack: LoadedPack = {
      manifest: {
        id: "small-v1",
        version: 1,
        room: { size: [320, 180], background: "room.png" },
      },
      baseUrl: "/packs/small-v1/",
      background: Texture.EMPTY,
      windowViews: {},
    };
    mocks.loadPack.mockResolvedValue(pack);
    const scene = await init();
    const selected = { ...room, packId: "small-v1" };
    scene.drawRoom(selected);
    expect(mocks.room).toHaveBeenLastCalledWith(selected, null);
    await Promise.resolve();
    expect(mocks.room).toHaveBeenLastCalledWith(selected, pack);
    expect(scene.toRoomPoint({ x: 460, y: 490 })).toMatchObject({ x: 100, y: 100 });
    scene.destroy();
  });

  it("ignores late pack loads after a different room is selected or the scene is destroyed", async () => {
    let resolve: (pack: LoadedPack | null) => void = () => {};
    mocks.loadPack.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const scene = await init();
    scene.drawRoom({ ...room, packId: "slow-pack" });
    scene.drawRoom(room);
    mocks.room.mockClear();
    resolve(null);
    await Promise.resolve();
    expect(mocks.room).not.toHaveBeenCalled();
    scene.drawRoom({ ...room, packId: "another-pack" });
    scene.destroy();
    mocks.room.mockClear();
    resolve(null);
    await Promise.resolve();
    expect(mocks.room).not.toHaveBeenCalled();
  });
});
