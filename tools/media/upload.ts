import { S3Client } from "bun";
import {
  contentType,
  getMediaPaths,
  loadCatalogue,
  log,
  parseCliArguments,
  readR2Config,
  requireFiles,
  selectItems,
} from "./lib.ts";

async function main() {
  const options = parseCliArguments(Bun.argv.slice(2));
  const catalogue = await loadCatalogue();
  const items = selectItems(catalogue, options);
  const config = readR2Config();
  const client = new S3Client({
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    bucket: config.bucket,
  });

  for (const item of items) {
    const paths = getMediaPaths(options.mediaRoot, item);
    requireFiles(paths);
    for (const path of [paths.video, paths.preview, paths.audio, paths.report]) {
      const key = path.split("/").at(-1);
      if (!key) {
        throw new Error(`Cannot derive an R2 key for ${path}`);
      }
      log(`Uploading ${item.id}: ${key}`);
      await client.file(key).write(Bun.file(path), { type: contentType(path) });
      log(`${config.publicBaseUrl}/${key}`);
    }
  }
}

if (import.meta.main) {
  await main();
}
