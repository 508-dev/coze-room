import { Container } from "pixi.js";
import { describe, expect, it } from "vitest";
import { PLACEHOLDER_SIZE, roomTransform } from "./space";

describe("logical room space", () => {
  it("uses centred integer scaling with letterboxing", () => {
    expect(roomTransform(1400, 900, PLACEHOLDER_SIZE)).toEqual({ scale: 2, x: 60, y: 90 });
    expect(roomTransform(1000, 700, PLACEHOLDER_SIZE)).toEqual({ scale: 1, x: 180, y: 170 });
  });

  it("uses the selected pack's size", () => {
    expect(roomTransform(1400, 900, [320, 180])).toEqual({ scale: 4, x: 60, y: 90 });
  });

  it("fits smaller viewports fractionally without cropping", () => {
    expect(roomTransform(320, 180, PLACEHOLDER_SIZE)).toEqual({ scale: 0.5, x: 0, y: 0 });
    const { scale, x, y } = roomTransform(360, 640, PLACEHOLDER_SIZE);
    expect(scale).toBe(0.5625);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(x + PLACEHOLDER_SIZE[0] * scale).toBeLessThanOrEqual(360);
    expect(y + PLACEHOLDER_SIZE[1] * scale).toBeLessThanOrEqual(640);
  });

  it.each([
    [1400, 900],
    [360, 640],
  ])("maps CSS-pixel pointers back to room space at %ix%i", (width, height) => {
    const root = new Container();
    const { scale, x, y } = roomTransform(width, height, PLACEHOLDER_SIZE);
    root.scale.set(scale);
    root.position.set(x, y);
    const point = root.toLocal({ x: x + 480 * scale, y: y + 250 * scale });
    expect(point.x).toBe(480);
    expect(point.y).toBe(250);
    root.destroy();
  });
});
