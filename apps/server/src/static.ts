import { existsSync, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";

const CLIENT_DIST = resolve(import.meta.dir, "../../client/dist");
const INDEX_FILE = resolve(CLIENT_DIST, "index.html");
const MIME_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

function fileResponse(path: string, immutable = false): Response {
  return new Response(Bun.file(path), {
    headers: {
      "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
      "Content-Type": MIME_TYPES[extname(path)] ?? "application/octet-stream",
    },
  });
}

/** Serve the Vite build in production. Development keeps using Vite directly. */
export function serveStatic(pathname: string): Response {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return new Response("not found", { status: 404 });
  }

  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const path = resolve(CLIENT_DIST, relative);
  if (!path.startsWith(`${CLIENT_DIST}${sep}`)) return new Response("not found", { status: 404 });
  if (existsSync(path) && statSync(path).isFile()) {
    return fileResponse(path, decoded.startsWith("/assets/"));
  }

  // Extensionless paths belong to the SPA; missing asset files stay real 404s.
  if (!extname(relative) && existsSync(INDEX_FILE)) return fileResponse(INDEX_FILE);
  return new Response("not found", { status: 404 });
}
