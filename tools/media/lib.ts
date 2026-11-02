import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_GIF_WIDTH = 64;
export const DEFAULT_GIF_FPS = 8;
export const DEFAULT_GIF_DURATION = 12;

export function log(message: string) {
  process.stdout.write(`${message}\n`);
}

export interface CatalogueItem {
  id: string;
  title: string;
  year: number;
  silent: boolean;
  durationSeconds: number;
  sourceUrl: string;
  sourceFile: string;
  licence: string;
  rightsEvidence: string;
  attribution?: string;
  checkedBy: string;
  checkedAt: string;
  previewStartSeconds?: number;
}

export interface Catalogue {
  schemaVersion: 1;
  items: CatalogueItem[];
}

export interface MediaPaths {
  source: string;
  video: string;
  preview: string;
  audio: string;
  report: string;
}

export interface CliOptions {
  all: boolean;
  ids: string[];
  mediaRoot: string;
  gifWidth: number;
  gifFps: number;
  gifDuration: number;
  gifStart?: number;
  source?: string;
}

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const defaultManifestPath = join(repositoryRoot, "catalogue", "manifest.json");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Manifest field ${field} must be a non-empty string`);
  }
  return value;
}

function requirePositiveNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`Manifest field ${field} must be a positive number`);
  }
  return value;
}

export function parseCatalogue(value: unknown): Catalogue {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.items)) {
    throw new Error("Manifest must contain schemaVersion 1 and an items array");
  }

  const ids = new Set<string>();
  const items = value.items.map((raw, index): CatalogueItem => {
    if (!isRecord(raw)) {
      throw new Error(`Manifest item ${index} must be an object`);
    }

    const id = requireString(raw.id, `items[${index}].id`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
      throw new Error(`Invalid catalogue id ${JSON.stringify(id)}; use lower-case kebab-case`);
    }
    if (ids.has(id)) {
      throw new Error(`Duplicate catalogue id ${id}`);
    }
    ids.add(id);

    const year = raw.year;
    if (!Number.isInteger(year) || (year as number) < 0) {
      throw new Error(`Manifest field items[${index}].year must be a non-negative integer`);
    }
    if (typeof raw.silent !== "boolean") {
      throw new Error(`Manifest field items[${index}].silent must be a boolean`);
    }

    const sourceUrl = requireString(raw.sourceUrl, `items[${index}].sourceUrl`);
    let parsedSource: URL;
    try {
      parsedSource = new URL(sourceUrl);
    } catch {
      throw new Error(`Manifest field items[${index}].sourceUrl must be an absolute URL`);
    }
    if (parsedSource.protocol !== "https:") {
      throw new Error(`Manifest field items[${index}].sourceUrl must use HTTPS`);
    }

    const sourceFile = requireString(raw.sourceFile, `items[${index}].sourceFile`);
    if (sourceFile.startsWith("/") || sourceFile.split("/").includes("..")) {
      throw new Error(`Manifest field items[${index}].sourceFile must stay inside the media root`);
    }

    const checkedAt = requireString(raw.checkedAt, `items[${index}].checkedAt`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(checkedAt)) {
      throw new Error(`Manifest field items[${index}].checkedAt must use YYYY-MM-DD`);
    }

    const item: CatalogueItem = {
      id,
      title: requireString(raw.title, `items[${index}].title`),
      year: year as number,
      silent: raw.silent,
      durationSeconds: requirePositiveNumber(
        raw.durationSeconds,
        `items[${index}].durationSeconds`,
      ),
      sourceUrl,
      sourceFile,
      licence: requireString(raw.licence, `items[${index}].licence`),
      rightsEvidence: requireString(raw.rightsEvidence, `items[${index}].rightsEvidence`),
      checkedBy: requireString(raw.checkedBy, `items[${index}].checkedBy`),
      checkedAt,
    };

    if (raw.attribution !== undefined) {
      item.attribution = requireString(raw.attribution, `items[${index}].attribution`);
    }
    if (raw.previewStartSeconds !== undefined) {
      if (
        typeof raw.previewStartSeconds !== "number" ||
        !Number.isFinite(raw.previewStartSeconds) ||
        raw.previewStartSeconds < 0
      ) {
        throw new Error(`Manifest field items[${index}].previewStartSeconds must not be negative`);
      }
      item.previewStartSeconds = raw.previewStartSeconds;
    }
    return item;
  });

  return { schemaVersion: 1, items };
}

export async function loadCatalogue(path = defaultManifestPath): Promise<Catalogue> {
  return parseCatalogue(JSON.parse(await readFile(path, "utf8")));
}

export function selectItems(catalogue: Catalogue, options: Pick<CliOptions, "all" | "ids">) {
  if (options.all) {
    if (options.ids.length > 0) {
      throw new Error("Use --all or catalogue ids, not both");
    }
    return catalogue.items;
  }
  if (options.ids.length === 0) {
    throw new Error("Choose at least one catalogue id, or pass --all");
  }

  return options.ids.map((id) => {
    const item = catalogue.items.find((candidate) => candidate.id === id);
    if (!item) {
      throw new Error(`Unknown catalogue id ${id}`);
    }
    return item;
  });
}

export function getMediaPaths(mediaRoot: string, item: CatalogueItem, source?: string): MediaPaths {
  const renditions = join(mediaRoot, "renditions");
  return {
    source: source ?? join(mediaRoot, item.sourceFile),
    video: join(renditions, `${item.id}.mp4`),
    preview: join(renditions, `${item.id}.gif`),
    audio: join(renditions, `${item.id}.m4a`),
    report: join(renditions, `${item.id}.ingest.json`),
  };
}

function positiveNumber(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive number`);
  }
  return parsed;
}

export function parseCliArguments(
  arguments_: string[],
  defaultMediaRoot = join(homedir(), "dormouse-media"),
): CliOptions {
  const options: CliOptions = {
    all: false,
    ids: [],
    mediaRoot: defaultMediaRoot,
    gifWidth: DEFAULT_GIF_WIDTH,
    gifFps: DEFAULT_GIF_FPS,
    gifDuration: DEFAULT_GIF_DURATION,
  };

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === undefined) {
      continue;
    }
    if (argument === "--all") {
      options.all = true;
      continue;
    }
    if (argument.startsWith("--")) {
      const value = arguments_[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`${argument} needs a value`);
      }
      index += 1;
      switch (argument) {
        case "--media-root":
          options.mediaRoot = resolve(value);
          break;
        case "--gif-width":
          options.gifWidth = positiveNumber(value, argument);
          if (!Number.isInteger(options.gifWidth)) {
            throw new Error("--gif-width must be an integer");
          }
          break;
        case "--gif-fps":
          options.gifFps = positiveNumber(value, argument);
          break;
        case "--gif-duration":
          options.gifDuration = positiveNumber(value, argument);
          break;
        case "--gif-start":
          if (!Number.isFinite(Number(value)) || Number(value) < 0) {
            throw new Error("--gif-start must be zero or a positive number");
          }
          options.gifStart = Number(value);
          break;
        case "--source":
          options.source = resolve(value);
          break;
        default:
          throw new Error(`Unknown option ${argument}`);
      }
      continue;
    }
    options.ids.push(argument);
  }

  if (options.source && options.ids.length !== 1) {
    throw new Error("--source requires exactly one catalogue id");
  }
  return options;
}

export interface ProbeResult {
  durationSeconds: number;
  hasAudio: boolean;
  width?: number;
  height?: number;
}

export async function probe(path: string): Promise<ProbeResult> {
  const process = Bun.spawnSync({
    cmd: [
      "ffprobe",
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=codec_type,width,height",
      "-of",
      "json",
      path,
    ],
    stdout: "pipe",
    stderr: "pipe",
  });
  if (process.exitCode !== 0) {
    throw new Error(`ffprobe failed for ${path}: ${process.stderr.toString().trim()}`);
  }

  const result = JSON.parse(process.stdout.toString()) as {
    format?: { duration?: string };
    streams?: { codec_type?: string; width?: number; height?: number }[];
  };
  const durationSeconds = Number(result.format?.duration);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error(`ffprobe returned no usable duration for ${path}`);
  }
  const video = result.streams?.find((stream) => stream.codec_type === "video");
  return {
    durationSeconds,
    hasAudio: result.streams?.some((stream) => stream.codec_type === "audio") ?? false,
    ...(video?.width === undefined ? {} : { width: video.width }),
    ...(video?.height === undefined ? {} : { height: video.height }),
  };
}

export async function runFfmpeg(arguments_: string[]) {
  const process = Bun.spawnSync({
    cmd: ["ffmpeg", "-hide_banner", "-y", ...arguments_],
    stdout: "inherit",
    stderr: "inherit",
  });
  if (process.exitCode !== 0) {
    throw new Error(`ffmpeg failed with exit code ${process.exitCode}`);
  }
}

export async function outputDetails(path: string) {
  const [metadata, file] = await Promise.all([probe(path), stat(path)]);
  return {
    file: path.split("/").at(-1) ?? path,
    durationSeconds: Math.round(metadata.durationSeconds * 1000) / 1000,
    bytes: file.size,
  };
}

export function requireFiles(paths: MediaPaths, includeSource = false) {
  const required = includeSource
    ? [paths.source, paths.video, paths.preview, paths.audio, paths.report]
    : [paths.video, paths.preview, paths.audio, paths.report];
  const missing = required.filter((path) => !existsSync(path));
  if (missing.length > 0) {
    throw new Error(`Missing media file${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}`);
  }
}

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
}

export function readR2Config(environment: NodeJS.ProcessEnv = process.env): R2Config {
  const names = [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
    "R2_PUBLIC_BASE_URL",
  ] as const;
  const missing = names.filter((name) => !environment[name]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `R2 upload is not configured. Set ${missing.join(", ")} in .env or the environment. ` +
        "No bucket was created or changed.",
    );
  }

  const publicBaseUrl = environment.R2_PUBLIC_BASE_URL as string;
  let parsed: URL;
  try {
    parsed = new URL(publicBaseUrl);
  } catch {
    throw new Error("R2_PUBLIC_BASE_URL must be an absolute HTTPS custom-domain URL");
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname === "r2.dev" ||
    parsed.hostname.endsWith(".r2.dev")
  ) {
    throw new Error("R2_PUBLIC_BASE_URL must be an HTTPS custom domain, not an r2.dev URL");
  }

  return {
    accountId: environment.R2_ACCOUNT_ID as string,
    accessKeyId: environment.R2_ACCESS_KEY_ID as string,
    secretAccessKey: environment.R2_SECRET_ACCESS_KEY as string,
    bucket: environment.R2_BUCKET as string,
    publicBaseUrl: publicBaseUrl.replace(/\/$/, ""),
  };
}

export function contentType(path: string): string {
  switch (extname(path)) {
    case ".mp4":
      return "video/mp4";
    case ".m4a":
      return "audio/mp4";
    case ".gif":
      return "image/gif";
    case ".json":
      return "application/json";
    default:
      throw new Error(`No content type configured for ${path}`);
  }
}
