/** Extend this interface by declaration merging in a feature's pack module. */
export interface PackSections {
  [section: string]: unknown;
}

/** v1 schema; use a versioned id/directory when publishing different content. */
export interface PackManifest {
  id: string;
  version: 1;
  room: {
    size: [number, number];
    background: string;
    windowViews?: Record<string, string>;
  };
  /** Feature-owned data. Each feature validates its section before use. */
  sections?: PackSections;
}

export const isPackId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(value);

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Files are pack-relative, never hotlinked or allowed to escape the directory. */
function file(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.split("/").every((part) => /^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(part))
  );
}

export function validateManifest(value: unknown): PackManifest {
  if (!object(value) || !isPackId(value.id) || value.version !== 1 || !object(value.room)) {
    throw new Error("invalid pack id, version or room");
  }
  const { size, background, windowViews } = value.room;
  if (
    !Array.isArray(size) ||
    size.length !== 2 ||
    !size.every((n) => Number.isSafeInteger(n) && n > 0) ||
    !file(background)
  ) {
    throw new Error("invalid room size or background");
  }
  if (
    windowViews !== undefined &&
    (!object(windowViews) || !Object.values(windowViews).every(file))
  ) {
    throw new Error("invalid window views");
  }
  if (value.sections !== undefined && !object(value.sections)) {
    throw new Error("invalid pack sections");
  }
  return value as unknown as PackManifest;
}
