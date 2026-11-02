import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { byteRange, devMedia, localMediaHandler } from "./dev-media";

describe("local media byte ranges", () => {
  it.each([
    ["bytes=0-3", [0, 3]],
    ["bytes=4-", [4, 9]],
    ["bytes=-3", [7, 9]],
    ["bytes=0-99", [0, 9]],
    ["bytes=10-", null],
    ["bytes=4-2", null],
    ["bytes=-0", null],
    ["bytes=-", null],
    ["bytes=0-1,4-5", null],
  ])("parses %s", (header, expected) => {
    expect(byteRange(header as string, 10)).toEqual(expected);
  });
});

describe("dev-only rendition server", () => {
  let directory: string;
  let server: Server;
  let base: string;
  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), "dormouse-media-test-"));
    await writeFile(join(directory, "test.mp4"), "0123456789");
    await writeFile(join(directory, "test.m4a"), "audio");
    await symlink(join(directory, "missing.mp4"), join(directory, "missing-link.mp4"));
    await symlink("/etc/hosts", join(directory, "outside.mp4"));
    server = createServer(localMediaHandler(directory));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no test address");
    base = `http://127.0.0.1:${address.port}`;
  });
  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(directory, { recursive: true, force: true });
  });
  it("streams native video Range and HEAD requests with byte-accurate headers", async () => {
    const response = await fetch(`${base}/test.mp4`, { headers: { Range: "bytes=2-5" } });
    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 2-5/10");
    expect(response.headers.get("content-length")).toBe("4");
    expect(response.headers.get("content-type")).toBe("video/mp4");
    expect(await response.text()).toBe("2345");
    const head = await fetch(`${base}/test.m4a`, { method: "HEAD" });
    expect(head.headers.get("accept-ranges")).toBe("bytes");
    expect(head.headers.get("content-type")).toBe("audio/mp4");
    expect(await head.text()).toBe("");
  });
  it("rejects unsatisfiable ranges and non-read methods", async () => {
    const response = await fetch(`${base}/test.mp4`, { headers: { Range: "bytes=99-" } });
    expect(response.status).toBe(416);
    expect(response.headers.get("content-range")).toBe("bytes */10");
    expect((await fetch(`${base}/test.mp4`, { method: "POST" })).status).toBe(405);
  });
  it.each([
    "/sources/..%2ftest.mp4",
    "/%2e%2e%2ftest.mp4",
    "/test.ingest.json",
    "/outside.mp4",
    "/missing-link.mp4",
    "/sources/test.mp4",
    "//test.mp4",
    "/test.mp4%00",
    "/.hidden.mp4",
  ])("never exposes arbitrary files: %s", async (path) => {
    expect((await fetch(`${base}${path}`)).status).toBe(404);
  });
  it("has no build, preview or bundle hooks", () => {
    const plugin = devMedia();
    expect(plugin.apply).toBe("serve");
    expect(plugin.configurePreviewServer).toBeUndefined();
    expect(plugin.generateBundle).toBeUndefined();
  });
});
