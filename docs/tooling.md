# Tooling

Bun 1.3.13, pinned in `package.json` via `packageManager`.

## Required checks

Run before calling work complete:

```bash
bun run lint        # biome check .
bun run typecheck   # tsc --noEmit
bun run test        # vitest run
bun run build       # real bundle, not a typecheck
```

Or all four plus the build: `bun run check`.

## Linting and formatting

**Biome** handles both. Config in `biome.json`: 100-column, double quotes,
semicolons, 2-space indent, LF.

Notable rule choices: `noNonNullAssertion` is an **error** (a `!` in a codebase
with `noUncheckedIndexedAccess` is almost always papering over a real case),
`noExplicitAny` and `noConsole` are warnings.

Biome ignores `assets/`, `packs/`, `catalogue/media/`, `*.glsl`, and
`tools/android-release/`. Keep those exclusions in step with the repo layout —
without them Biome tries to lint generated sprite atlases.

## Typechecking

Strict, plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. Both
are unusually strict and both are deliberate: array indexing in a game loop and
optional fields in a wire protocol are exactly where silent `undefined` bugs
live.

## Testing

**Vitest**, node environment, globals on. Tests live next to the code as
`*.test.ts` under `apps/` and `packages/`.

The room protocol and the sync maths are the parts worth testing hard. The
renderer is not meaningfully unit-testable; cover it with the attract-mode
demo, which drives the real room code with a scripted occupant feed.

## Pre-commit

A single local hook runs `bun run format:check` over `apps/`, `packages/`,
`scripts/`, and the root configs. The `files:` regex in
`.pre-commit-config.yaml` must track the workspace layout — if it drifts, the
hook silently stops covering most of the repo.

## Ports

`./scripts/worktree-ports.sh env` prints this worktree's deterministic port
assignment, hashed from the absolute worktree path so parallel checkouts never
collide. `./scripts/docker-compose.sh` injects them into Compose.
