import { describe, expect, it, vi } from "vitest";
import { resolveBedSources, selectBedSource } from "./sources";

function pack(audio?: unknown): Parameters<typeof resolveBedSources>[0] {
  return {
    baseUrl: "/packs/custom-v1/",
    manifest: {
      id: "custom-v1",
      version: 1 as const,
      room: { size: [640, 360] as [number, number], background: "room.png" },
      ...(audio === undefined ? {} : { sections: { audio } }),
    },
  } as Parameters<typeof resolveBedSources>[0];
}

describe("ambient bed source selection", () => {
  it("uses validated paths from the active pack", () => {
    const sources = resolveBedSources(
      pack({ beds: { rain: { ogg: "audio/rain.ogg", m4a: "audio/rain.m4a" } } }),
      "rain",
    );
    expect(sources).toEqual({
      ogg: "/packs/custom-v1/audio/rain.ogg",
      m4a: "/packs/custom-v1/audio/rain.m4a",
    });
  });

  it.each([
    undefined,
    null,
    { beds: null },
    { beds: { rain: { ogg: "../rain.ogg", m4a: "rain.m4a" } } },
    { beds: { rain: { ogg: "https://example.com/rain.ogg", m4a: "rain.m4a" } } },
    { beds: { clearNight: { ogg: "clear.ogg", m4a: "clear.m4a" } } },
  ])("falls back to conventional v0.1 paths for absent/invalid sections: %j", (audio) => {
    expect(resolveBedSources(pack(audio), "clear-night", "/assets/")).toEqual({
      ogg: "/assets/dormouse-v0/audio/clear-night.ogg",
      m4a: "/assets/dormouse-v0/audio/clear-night.m4a",
    });
  });

  it("falls back when no pack is active", () => {
    expect(resolveBedSources(null, "rain")).toEqual({
      ogg: "/packs/dormouse-v0/audio/rain.ogg",
      m4a: "/packs/dormouse-v0/audio/rain.m4a",
    });
  });

  it("selects Opus by capability and AAC as the fallback", () => {
    const sources = { ogg: "rain.ogg", m4a: "rain.m4a" };
    const opus = vi.fn(() => "probably");
    expect(selectBedSource(sources, opus)).toBe("rain.ogg");
    expect(opus).toHaveBeenCalledExactlyOnceWith('audio/ogg; codecs="opus"');
    expect(selectBedSource(sources, () => "")).toBe("rain.m4a");
  });
});
