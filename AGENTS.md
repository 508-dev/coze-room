# AI Agent Development Guide

## What this project is

Dormouse is a shared pixel-art room people fall asleep in. Read
[`docs/design.md`](docs/design.md) before making design decisions — it is the
plan of record and records *why*, not just what. If a change contradicts it,
change the document in the same commit and say why.

## Environment

- Only `python3` is guaranteed. Do not assume `python` exists.
- Prefer package scripts and repo entrypoints over raw commands. This is a Bun
  repo: use `bun run`.
- Treat install, dev, and test commands as executable code. Inspect manifests,
  package scripts and lockfiles before running them.

## Dependency supply-chain safety

- Keep `bunfig.toml` with `minimumReleaseAge = 604800` (7 days).
- CI uses locked installs: `bun install --frozen-lockfile`.
- Commit lockfiles.
- **Check the licence of every model and asset source, not just every package.**
  A non-commercial model or audio licence poisons the paid content packs. See
  `COPYRIGHT.md`.

## Repository shape

- `AGENTS.md` — this file, canonical agent instructions.
- `DECISIONS.md` — decision authority for project topology and policy.
- `docs/design.md` — the plan of record.
- `docs/backlog.md` — post-v0.1 work, issue-ready.
- `docs/selection-report.md` — how this repo was adapted from the 508 devkit.
- `apps/client` — PixiJS + Svelte web client.
- `apps/server` — WebSocket game server.
- `packages/*` — shared code (room protocol, types).
- `catalogue/` — media provenance manifest. **No media files.**
- `packs/` — versioned art and audio packs.
- `scripts/` — stable project entrypoints.
- `tools/android-release/` — F-Droid and Play release tooling, salvaged from
  the devkit's Android stack. Dormant until the Android milestone.
- `.context/` — gitignored workspace-local scratch. Never commit it.

## Development workflow

- Run infrastructure with Docker Compose; run app services on the host.
- `./scripts/worktree-ports.sh env` to inspect local ports.
- `./scripts/docker-compose.sh` instead of raw `docker compose`.
- `./scripts/dev.sh` starts Postgres, then the client and server together.
- Keep `.worktreeinclude` a short allowlist of local config to copy into
  sibling worktrees.
- Keep `.dockerignore` in sync with the repo shape.

## Editing rules

- Read target files, callers, exports and tests before editing.
- Keep edits surgical. Do not reformat unrelated files.
- Add or update tests when behaviour changes.
- Update `.env.example` when adding configuration.
- Update docs when changing developer workflows.
- Keep secrets in environment variables, never in code.

## Project-specific constraints

These are decided. Do not quietly reverse them — see `DECISIONS.md`.

- **No YouTube.** Their Developer Policies conflict with background audio,
  overlays on the player, and server-driven playback. Media is mirrored
  public-domain video on R2.
- **No TTS engine.** Chat is a fixed phrase palette with recorded voice-over.
  Free text is visible and always silent.
- **No Redis.** Room state is in the server process memory.
- **No third-party analytics SDK.** Metrics come from our own server logs.
- **No avatar walk cycles.** Movement is seat-based.
- **WebGL2, not WebGPU.** WebGPU adapter success is ~75% on Android.
- **Never hotlink media.** Mirror everything, and record provenance in
  `catalogue/manifest.json` with the rights evidence and who checked it.
- **Freesound CC0 and CC BY only.** Never NonCommercial.
- **R2 needs a custom domain.** `r2.dev` is rate-limited and uncached, and the
  zero-egress economics do not apply to it.

## Asset work

- Generate stills, then downsample to the pixel grid and quantize to the single
  project palette. One shared palette is what makes generated art cohere.
- **Composite avatar layers at runtime, never pre-baked.** Pre-baking turns
  8×8×8 options into thousands of sprites per pose.
- Prefer shaders over animation frames for motion — rain, fog, god rays,
  flicker, parallax are all procedural and cost no art.
- Commercially usable models only: FLUX.1-schnell, SDXL + LoRAs, Qwen-Image.
  **FLUX.1-dev is non-commercial — do not use it.**

## `.context/`

Workspace-local agent scratch only. Do not commit. Durable knowledge belongs in
tracked docs: `docs/design.md` for decisions, `docs/development.md` for
runbooks, `docs/tooling.md` and `docs/supply-chain.md` for tooling.

## Validation

Before calling work complete, run the narrowest relevant checks:

```bash
./scripts/lint.sh
./scripts/typecheck.sh
./scripts/test.sh
```

For broader changes:

```bash
./scripts/check-all.sh
```
