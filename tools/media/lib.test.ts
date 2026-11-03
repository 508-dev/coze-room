import { describe, expect, mock, test } from "bun:test";
import {
  contentType,
  getMediaPaths,
  loadCatalogue,
  MEDIA_CACHE_CONTROL,
  parseCatalogue,
  parseCliArguments,
  readR2Config,
  selectItems,
  uploadR2File,
} from "./lib.ts";

const item = {
  id: "quiet-film",
  title: "Quiet Film",
  year: 1920,
  silent: true,
  durationSeconds: 60,
  sourceUrl: "https://example.com/film.mp4",
  sourceFile: "sources/quiet-film.mp4",
  licence: "Public domain (US)",
  rightsEvidence: "Published in the US in 1920.",
  checkedBy: "Test research; Test reviewer (rights sign-off)",
  checkedAt: "2026-11-03",
};

describe("catalogue validation", () => {
  test("accepts a valid item and derives deterministic rendition names", () => {
    const catalogue = parseCatalogue({ schemaVersion: 1, items: [item] });
    const entry = catalogue.items[0];
    if (!entry) {
      throw new Error("Expected one catalogue item");
    }
    const paths = getMediaPaths("/media", entry);
    expect(paths.video).toBe("/media/renditions/quiet-film.mp4");
    expect(paths.preview).toBe("/media/renditions/quiet-film.gif");
    expect(paths.audio).toBe("/media/renditions/quiet-film.m4a");
    expect(paths.report).toBe("/media/renditions/quiet-film.ingest.json");
  });

  test("rejects duplicate ids and paths outside the media root", () => {
    expect(() => parseCatalogue({ schemaVersion: 1, items: [item, item] })).toThrow(
      "Duplicate catalogue id",
    );
    expect(() =>
      parseCatalogue({
        schemaVersion: 1,
        items: [{ ...item, sourceFile: "../film.mp4" }],
      }),
    ).toThrow("inside the media root");
  });

  test("the committed catalogue has five cleared titles and at least one with sound", async () => {
    const catalogue = await loadCatalogue();
    expect(catalogue.items).toHaveLength(5);
    expect(catalogue.items.some((entry) => !entry.silent)).toBe(true);
    for (const entry of catalogue.items) {
      expect(entry.checkedBy).toContain("Kimi K3.1 Pro (research)");
      expect(entry.checkedBy).toContain("DeepSeek V4 Pro (verification review)");
      expect(entry.checkedBy).toContain("Caleb Rogers (rights sign-off)");
      expect(entry.checkedAt).toBe("2026-11-03");
      expect(entry.rightsEvidence.length).toBeGreaterThan(30);
    }
  });
});

describe("command-line parsing and selection", () => {
  test("uses a small GIF and an external media directory by default", () => {
    const options = parseCliArguments(["--all"], "/media");
    expect(options.gifWidth).toBe(64);
    expect(options.mediaRoot).toBe("/media");
    expect(options.all).toBe(true);
  });

  test("accepts rendition overrides and selects in the requested order", () => {
    const options = parseCliArguments(
      ["quiet-film", "--gif-width", "48", "--gif-start", "2.5"],
      "/media",
    );
    expect(options.gifWidth).toBe(48);
    expect(options.gifStart).toBe(2.5);
    expect(selectItems(parseCatalogue({ schemaVersion: 1, items: [item] }), options)).toHaveLength(
      1,
    );
  });

  test("rejects missing values and ambiguous source overrides", () => {
    expect(() => parseCliArguments(["--gif-width"], "/media")).toThrow("needs a value");
    expect(() => parseCliArguments(["--all", "--source", "film.mp4"], "/media")).toThrow(
      "exactly one",
    );
  });
});

describe("R2 upload configuration", () => {
  const environment = {
    R2_ACCOUNT_ID: "account",
    R2_ACCESS_KEY_ID: "access",
    R2_SECRET_ACCESS_KEY: "secret",
    R2_BUCKET: "bucket",
    R2_PUBLIC_BASE_URL: "https://media.example.com",
  };

  test("fails before creating a client when credentials are absent", () => {
    expect(() => readR2Config({})).toThrow("R2 upload is not configured");
  });

  test("requires a custom domain", () => {
    expect(() =>
      readR2Config({ ...environment, R2_PUBLIC_BASE_URL: "https://bucket.r2.dev" }),
    ).toThrow("custom domain");
  });

  test("uses the configured bucket without creating it", () => {
    expect(readR2Config(environment).bucket).toBe("bucket");
    expect(contentType("film.m4a")).toBe("audio/mp4");
  });

  test("uploads through a presigned PUT with a moderate cache lifetime", async () => {
    const originalFetch = globalThis.fetch;
    const presign = mock(() => "https://upload.example/signed");
    const request = mock(async (_url: string | URL | Request, _init?: RequestInit) =>
      Promise.resolve(new Response(null, { status: 200 })),
    );
    globalThis.fetch = request as unknown as typeof fetch;
    try {
      const file = { presign } as unknown as Parameters<typeof uploadR2File>[0];
      await uploadR2File(file, "/media/renditions/quiet-film.mp4");
      expect(presign).toHaveBeenCalledWith({ method: "PUT", expiresIn: 300 });
      expect(request).toHaveBeenCalledTimes(1);
      const [url, init] = request.mock.calls[0] ?? [];
      expect(url).toBe("https://upload.example/signed");
      expect(init?.method).toBe("PUT");
      expect(init?.headers).toEqual({
        "Cache-Control": MEDIA_CACHE_CONTROL,
        "Content-Type": "video/mp4",
      });
      expect(MEDIA_CACHE_CONTROL).toBe("public, max-age=3600");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
