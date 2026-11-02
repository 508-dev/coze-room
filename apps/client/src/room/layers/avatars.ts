import type { Occupant } from "@dormouse/protocol";
import { Container, Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import { breathingOffset, motionPhase, observeReducedMotion, occupantLook } from "../art/motion";
import { loadOccupantTextures, type OccupantsSection, occupantsSection } from "../art/occupants";
import type { SceneLayer } from "./layer";
import { seatGeometry } from "./seat-geometry";

export function createAvatarsLayer(): SceneLayer {
  const container = new Container();
  const bodies = new Map<string, Graphics>();
  const positions = new Map<string, { bodyX: number; bodyY: number }>();
  let occupants: Occupant[] = [];
  let selfId = "";
  let section: OccupantsSection | null = null;
  let textures = new Map<string, Texture>();
  let generation = 0;
  let reduced = false;
  let offMotion = () => {};
  const crops: Texture[] = [];
  const moving: { id: string; asleep: boolean; top: Sprite; z: Graphics; head: number[] }[] = [];

  function clear() {
    for (const child of container.removeChildren()) child.destroy({ children: true });
    for (const crop of crops) crop.destroy();
    crops.length = 0;
    moving.length = 0;
    bodies.clear();
  }

  function syncArt() {
    clear();
    if (!section) return;
    for (const occupant of occupants) {
      // v0.1 has no standing art: unseated guests count as present, not piled on the floor.
      if (!occupant.seatId) continue;
      const look = occupantLook(occupant.id, section.looks);
      const entry = Object.entries(section.sprites).find(
        ([, sprite]) =>
          sprite.seat === occupant.seatId &&
          sprite.look === look &&
          sprite.state === (occupant.asleep ? "asleep" : "awake"),
      );
      if (!entry) continue;
      const [file, data] = entry;
      const texture = textures.get(file);
      if (!texture) continue;
      const body = container.addChild(new Container());
      body.zIndex = section.seats[data.seat]?.anchor[1] ?? 0;
      const topTexture = new Texture({
        source: texture.source,
        frame: new Rectangle(0, 0, texture.width, data.breathRow),
      });
      const bottomTexture = new Texture({
        source: texture.source,
        frame: new Rectangle(0, data.breathRow, texture.width, texture.height - data.breathRow),
      });
      crops.push(topTexture, bottomTexture);
      const bottom = body.addChild(new Sprite(bottomTexture));
      bottom.y = data.breathRow;
      const top = body.addChild(new Sprite(topTexture));
      const z = body.addChild(
        new Graphics().rect(0, 0, 3, 1).rect(1, 1, 1, 1).rect(0, 2, 3, 1).fill(0xb9b59b),
      );
      z.visible = occupant.asleep;
      moving.push({ id: occupant.id, asleep: occupant.asleep, top, z, head: data.headBox });
    }
    animate(0);
  }

  function animate(now: number) {
    for (const sitter of moving) {
      sitter.top.y = breathingOffset(now, sitter.id, sitter.asleep, reduced);
      const phase = reduced ? 0.25 : motionPhase(now, sitter.id, 4);
      sitter.z.position.set(
        Math.round((sitter.head[0] ?? 0) + (sitter.head[2] ?? 0) / 2) + 2,
        Math.round((sitter.head[1] ?? 0) - 2 - phase * 6),
      );
      sitter.z.visible = sitter.asleep && (reduced || phase < 0.8);
    }
  }

  function sync() {
    if (section) {
      syncArt();
      return;
    }
    const seen = new Set<string>();
    for (const occupant of occupants) {
      seen.add(occupant.id);
      let body = bodies.get(occupant.id);
      if (!body) {
        body = container.addChild(new Graphics());
        bodies.set(occupant.id, body);
      }
      const tint = occupant.id === selfId ? 0xf0e6ff : 0xa89cc0;
      body
        .clear()
        .circle(0, 0, 9)
        .fill({ color: tint, alpha: occupant.asleep ? 0.45 : 1 });
      const spot = occupant.seatId ? positions.get(occupant.seatId) : undefined;
      body.position.set(spot?.bodyX ?? 60, spot?.bodyY ?? 380);
    }
    for (const [id, body] of bodies) {
      if (seen.has(id)) continue;
      body.destroy();
      bodies.delete(id);
    }
  }

  return {
    slot: "avatars",
    attach({ container: slot }) {
      container.sortableChildren = true;
      slot.addChild(container);
      offMotion = observeReducedMotion((value) => {
        reduced = value;
      });
    },
    onRoomChange(room, pack) {
      const current = ++generation;
      clear();
      section = null;
      textures = new Map();
      positions.clear();
      for (const seat of room.seats) positions.set(seat.id, seatGeometry(seat));
      sync();
      const data =
        pack && occupantsSection(pack.manifest.sections?.occupants, pack.manifest.room.size);
      if (pack && data) {
        void loadOccupantTextures(pack.baseUrl, data, pack.manifest.room.size)
          .then((loaded) => {
            if (generation !== current) return;
            section = data;
            textures = loaded;
            syncArt();
          })
          .catch((error: unknown) => {
            // biome-ignore lint/suspicious/noConsole: missing art must retain visible fallback occupants.
            console.warn("Could not load occupant art; using placeholders.", error);
          });
      }
    },
    onOccupantsChange(value, id) {
      occupants = value;
      selfId = id;
      sync();
    },
    update(_dt, now) {
      animate(now);
    },
    destroy() {
      ++generation;
      offMotion();
      clear();
      positions.clear();
    },
  };
}
