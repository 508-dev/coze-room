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

  it("never uses fractional scaling, even below the minimum room size", () => {
    expect(roomTransform(320, 180, PLACEHOLDER_SIZE)).toEqual({ scale: 1, x: -160, y: -90 });
  });

  it("maps a transformed Pixi pointer back to room coordinates", () => {
    const root = new Container();
    const { scale, x, y } = roomTransform(1400, 900, PLACEHOLDER_SIZE);
    root.scale.set(scale);
    root.position.set(x, y);
    const point = root.toLocal({ x: 60 + 480 * 2, y: 90 + 250 * 2 });
    expect(point.x).toBe(480);
    expect(point.y).toBe(250);
    root.destroy();
  });
});
