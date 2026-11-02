import { realpathSync, statSync } from "node:fs";
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

function realFile(path: string): string | null {
  try {
    const realDist = realpathSync(CLIENT_DIST);
    const realPath = realpathSync(path);
    if (!realPath.startsWith(`${realDist}${sep}`) || !statSync(realPath).isFile()) return null;
    return realPath;
  } catch {
    return null;
  }
}

/** Serve the Vite build in production. Development keeps using Vite directly. */
export function serveStatic(pathname: string): Response {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return new Response("not found", { status: 404 });
  }

  if (decoded.includes("\0")) return new Response("not found", { status: 404 });

  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const path = resolve(CLIENT_DIST, relative);
  if (!path.startsWith(`${CLIENT_DIST}${sep}`)) return new Response("not found", { status: 404 });
  const file = realFile(path);
  if (file) return fileResponse(file, decoded.startsWith("/assets/"));

  // Extensionless paths belong to the SPA; missing asset files stay real 404s.
  const index = extname(relative) ? null : realFile(INDEX_FILE);
  if (index) return fileResponse(index);
  return new Response("not found", { status: 404 });
}
