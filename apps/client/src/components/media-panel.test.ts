import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./MediaPanel.svelte", import.meta.url), "utf8");

describe("cross-origin media elements", () => {
  it.each(["video", "audio"] as const)("requests anonymous CORS on %s", (tag) => {
    const element = source.match(new RegExp(`<${tag}\\b[\\s\\S]*?>`))?.[0];
    expect(element).toContain('crossorigin="anonymous"');
  });

  it("hides a failed player behind the unavailable state", () => {
    const video = source.match(/<video\b[\s\S]*?>/)?.[0];
    expect(video).toContain("hidden={unavailable}");
    expect(source).toContain("The TV is resting. Please try again later.");
  });
});
