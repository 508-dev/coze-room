import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import type { RequestListener } from "node:http";
import { resolve, sep } from "node:path";
import { loadEnv, type Plugin } from "vite";

/** One byte range, including suffix/open-ended requests from native media elements. */
export function byteRange(header: string, size: number): [number, number] | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2]) || size <= 0) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size)
    return null;
  return [start, end];
}

/** Only generated rendition filenames, never originals, reports, arbitrary files or symlinks out. */
export function localMediaHandler(directory: string): RequestListener {
  const root = resolve(directory);
  return async (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }
    const path = (request.url ?? "").split("?")[0] ?? "";
    const match = /^\/([a-z0-9]+(?:-[a-z0-9]+)*)\.(mp4|m4a|gif)$/.exec(path);
    if (!match) {
      response.writeHead(404).end();
      return;
    }
    try {
      const canonicalRoot = await realpath(root);
      const file = await realpath(resolve(root, path.slice(1)));
      if (!file.startsWith(`${canonicalRoot}${sep}`)) {
        response.writeHead(404).end();
        return;
      }
      const metadata = await stat(file);
      if (!metadata.isFile()) {
        response.writeHead(404).end();
        return;
      }
      const range = request.headers.range
        ? byteRange(request.headers.range, metadata.size)
        : undefined;
      if (range === null) {
        response.writeHead(416, { "Content-Range": `bytes */${metadata.size}` }).end();
        return;
      }
      const [start, end] = range ?? [0, metadata.size - 1];
      response.setHeader("Accept-Ranges", "bytes");
      response.setHeader(
        "Content-Type",
        match[2] === "gif" ? "image/gif" : match[2] === "m4a" ? "audio/mp4" : "video/mp4",
      );
      response.setHeader("Content-Length", end - start + 1);
      response.setHeader("Cache-Control", "no-cache");
      if (range) response.setHeader("Content-Range", `bytes ${start}-${end}/${metadata.size}`);
      response.statusCode = range ? 206 : 200;
      if (request.method === "HEAD" || metadata.size === 0) {
        response.end();
        return;
      }
      const stream = createReadStream(file, { start, end });
      stream.on("error", () => response.destroy());
      response.on("close", () => stream.destroy());
      stream.pipe(response);
    } catch {
      response.writeHead(404).end();
    }
  };
}

/** configureServer only: not emitted, served by preview, or available in production. */
export function devMedia(): Plugin {
  return {
    name: "dormouse-dev-media",
    apply: "serve",
    configureServer(server) {
      const directory =
        process.env.DORMOUSE_MEDIA_DIR ??
        loadEnv(server.config.mode, server.config.envDir, "DORMOUSE_MEDIA_DIR").DORMOUSE_MEDIA_DIR;
      if (directory) server.middlewares.use("/__media", localMediaHandler(directory));
    },
  };
}
