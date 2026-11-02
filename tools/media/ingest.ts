import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CatalogueItem } from "./lib.ts";
import {
  getMediaPaths,
  loadCatalogue,
  log,
  outputDetails,
  parseCliArguments,
  probe,
  requireFiles,
  runFfmpeg,
  selectItems,
} from "./lib.ts";

const palettePath = fileURLToPath(new URL("../art/palette.hex", import.meta.url));

async function makeGifPalette(destination: string) {
  const colours = (await Bun.file(palettePath).text())
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (colours.length === 0 || colours.length > 256) {
    throw new Error("The GIF palette must contain between 1 and 256 colours");
  }

  const pixels = Buffer.alloc(16 * 16 * 3);
  for (let index = 0; index < 256; index += 1) {
    const colour = colours[index % colours.length];
    if (!/^[\da-fA-F]{6}$/.test(colour ?? "")) {
      throw new Error(`Invalid colour ${colour} in ${palettePath}`);
    }
    pixels[index * 3] = Number.parseInt((colour as string).slice(0, 2), 16);
    pixels[index * 3 + 1] = Number.parseInt((colour as string).slice(2, 4), 16);
    pixels[index * 3 + 2] = Number.parseInt((colour as string).slice(4, 6), 16);
  }
  await writeFile(destination, Buffer.concat([Buffer.from("P6\n16 16\n255\n"), pixels]));
}

async function ingest(item: CatalogueItem, options: ReturnType<typeof parseCliArguments>) {
  const paths = getMediaPaths(options.mediaRoot, item, options.source);
  if (!(await Bun.file(paths.source).exists())) {
    throw new Error(
      `Source for ${item.id} is missing at ${paths.source}. Mirror ${item.sourceUrl} there first.`,
    );
  }
  await mkdir(dirname(paths.video), { recursive: true });

  log(`\n[${item.id}] probing ${paths.source}`);
  const source = await probe(paths.source);
  log(`[${item.id}] encoding 480p H.264/AAC MP4`);
  const videoArguments = ["-i", paths.source];
  if (!source.hasAudio) {
    videoArguments.push("-f", "lavfi", "-i", "anullsrc=channel_layout=mono:sample_rate=48000");
  }
  videoArguments.push(
    "-map",
    "0:v:0",
    "-map",
    source.hasAudio ? "0:a:0" : "1:a:0",
    "-vf",
    "scale=-2:480:flags=lanczos,setsar=1",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "96k",
    "-ac",
    "2",
    "-ar",
    "48000",
    "-map_metadata",
    "-1",
    "-movflags",
    "+faststart",
    "-shortest",
    paths.video,
  );
  await runFfmpeg(videoArguments);

  log(`[${item.id}] encoding 64 kbps mono AAC audio`);
  await runFfmpeg([
    "-i",
    paths.video,
    "-map",
    "0:a:0",
    "-vn",
    "-c:a",
    "aac",
    "-b:a",
    "64k",
    "-ac",
    "1",
    "-ar",
    "48000",
    "-map_metadata",
    "-1",
    "-movflags",
    "+faststart",
    paths.audio,
  ]);

  const temporaryDirectory = await mkdtemp(join(tmpdir(), "dormouse-media-"));
  try {
    const gifPalette = join(temporaryDirectory, "palette.ppm");
    await makeGifPalette(gifPalette);
    const gifStart = options.gifStart ?? item.previewStartSeconds ?? 0;
    log(
      `[${item.id}] encoding ${options.gifWidth}px Atropoeia GIF from ${gifStart}s (no dithering)`,
    );
    await runFfmpeg([
      "-ss",
      String(gifStart),
      "-t",
      String(options.gifDuration),
      "-i",
      paths.source,
      "-i",
      gifPalette,
      "-filter_complex",
      `[0:v]fps=${options.gifFps},scale=${options.gifWidth}:-2:flags=neighbor,setsar=1[small];[small][1:v]paletteuse=dither=none[out]`,
      "-map",
      "[out]",
      "-map_metadata",
      "-1",
      "-loop",
      "0",
      "-f",
      "gif",
      paths.preview,
    ]);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }

  const report = {
    id: item.id,
    sourceDurationSeconds: Math.round(source.durationSeconds * 1000) / 1000,
    outputs: {
      video: await outputDetails(paths.video),
      preview: await outputDetails(paths.preview),
      audio: await outputDetails(paths.audio),
    },
    preview: {
      width: options.gifWidth,
      fps: options.gifFps,
      startSeconds: options.gifStart ?? item.previewStartSeconds ?? 0,
      palette: "Atropoeia (48 colours), no dithering",
    },
  };
  await Bun.write(paths.report, `${JSON.stringify(report, null, 2)}\n`);
  requireFiles(paths, true);
  log(`[${item.id}] wrote ${paths.report}`);
}

async function main() {
  const options = parseCliArguments(Bun.argv.slice(2));
  const catalogue = await loadCatalogue();
  const items = selectItems(catalogue, options);
  for (const item of items) {
    await ingest(item, options);
  }
}

if (import.meta.main) {
  await main();
}
