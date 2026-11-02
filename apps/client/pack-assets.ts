import { existsSync } from "node:fs";
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";
import type { Plugin } from "vite";

const CONTENT_TYPES: Record<string, string> = {
  json: "application/json",
  png: "image/png",
  webp: "image/webp",
  svg: "image/svg+xml",
  ogg: "audio/ogg",
};

/** No extra dependency: the same repo-root packs become /packs in dev and dist. */
export function packAssets(directory: string): Plugin {
  const root = resolve(directory);
  return {
    name: "dormouse-pack-assets",
    configureServer(server) {
      server.middlewares.use("/packs", async (request, response) => {
        try {
          const path = decodeURIComponent(new URL(request.url ?? "/", "http://local").pathname);
          const candidate = resolve(root, `.${path}`);
          if (!candidate.startsWith(`${root}${sep}`)) {
            response.statusCode = 403;
            response.end("forbidden");
            return;
          }
          const actual = await realpath(candidate);
          if (!actual.startsWith(`${root}${sep}`) || !(await stat(actual)).isFile()) {
            response.statusCode = 403;
            response.end("forbidden");
            return;
          }
          const extension = actual.split(".").pop() ?? "";
          response.setHeader(
            "Content-Type",
            CONTENT_TYPES[extension] ?? "application/octet-stream",
          );
          response.end(await readFile(actual));
        } catch {
          response.statusCode = 404;
          response.end("pack asset not found");
        }
      });
    },
    async generateBundle() {
      if (!existsSync(root)) return;
      const emit = async (directory: string, prefix: string): Promise<void> => {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
          const path = resolve(directory, entry.name);
          const fileName = `${prefix}/${entry.name}`;
          if (entry.isDirectory()) await emit(path, fileName);
          else if (entry.isFile() && fileName !== "packs/README.md") {
            this.emitFile({ type: "asset", fileName, source: await readFile(path) });
          }
        }
      };
      await emit(root, "packs");
    },
  };
}
