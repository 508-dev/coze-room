# Selection report — 508 devkit → Dormouse

Required by `MANIFEST.md`: one row per top-level path in the devkit and the
target repo, with a decision and one concrete reason. Produced before feature
work, per `README.md`: *"Never copy the whole repository into a target project."*

- **Target:** Dormouse — a cosy pixel-art sleepy room. Web (PixiJS v8 + Svelte 5)
  and Android (Capacitor). Single WebSocket server, Postgres, media on R2.
- **Date:** 2026-10-29
- **Decisions:** `adopt` (keep as-is) · `adapt` (keep, rewrite) · `skip` (leave
  unused) · `delete` (remove) · `defer` (decide later)
- **Name/clearance:** app id `dev.co508.dormouse`, repo `508-dev/dormouse`,
  pending final trademark and domain clearance.

## Root documentation

| Path | Source | Decision | Reason |
|---|---|---|---|
| `AGENTS.md` | devkit | adapt | Canonical agent instructions, but ~60% is devkit-stack trivia (uv cooldowns, Bundler, Drizzle, Kotlin F-Droid). Rewrite for a PixiJS/Svelte/Capacitor repo. |
| `CLAUDE.md` | devkit | adopt | 14-line pointer to `AGENTS.md`; still correct. |
| `README.md` | devkit | adapt | Entirely about the devkit. Full rewrite for the project. |
| `CONTRIBUTING.md` | devkit | adapt | Generic skeleton is fine; the body is devkit-specific ("Put language conventions in `stacks/`") and `stacks/` is being deleted. |
| `SECURITY.md` | devkit | adapt | Line 7 is an explicit placeholder for a real reporting address. Must be filled — Apple and Play both require published contact for UGC apps. |
| `DECISIONS.md` | devkit | adapt | Content is the devkit's constitution, not ours. Keep the Decision/Why/Deviate-when **format**, replace all ten entries with project decisions. `MANIFEST.md:34` says to do exactly this. |
| `LICENSE` | devkit | adapt | Currently MIT, "Copyright (c) 2026 508.dev LLC". Replace with **GPL-3.0** for the client. Server lives under AGPL-3.0 — see new paths below. |
| `MANIFEST.md` | devkit | delete | Pure template machinery. Its job ends with this report. |
| `llms.txt` | devkit | delete | Indexes devkit-only docs (`pattern-report.md`, `template-proposal.md`) that are themselves being deleted. |
| `.cursor/rules/repo-conventions.mdc` | devkit | adopt | Nine lines pointing at `AGENTS.md`; survives the rewrite unchanged. |

## Root configuration

| Path | Source | Decision | Reason |
|---|---|---|---|
| `package.json` | devkit | adapt | Rename `508-devkit` → `dormouse`. Replace `workspaces: ["stacks/typescript"]` with the real app/server workspaces. **Drop the `db:*` drizzle-kit scripts** unless Drizzle is chosen. |
| `bun.lock` | devkit | delete | Locks devkit dependencies we are not keeping. Regenerate from the real dependency set. |
| `bunfig.toml` | devkit | adopt | `minimumReleaseAge = 604800` and `linker = "isolated"` are good supply-chain defaults worth keeping. |
| `biome.json` | devkit | adapt | Keep the formatter/linter config. **Must add asset-directory exclusions** — it currently lints `"**"` with only four exclusions, which would lint generated sprite atlases and audio manifests. |
| `pnpm-workspace.example.yaml` | devkit | delete | Bun is chosen; the pnpm alternative is dead weight. |
| `renovate.json` | devkit | adopt | 7-day `minimumReleaseAge`, sane PR limits. Fine as-is. |
| `compose.yml` | devkit | adapt | **Keep Postgres, drop Redis.** At nine concurrent rooms with state in memory, Redis buys nothing. Revisit only if we outgrow one process. |
| `docker-compose.yml` | devkit | adopt | Four-line `include:` compat wrapper. Harmless. |
| `.env.example` | devkit | adapt | **Strip the OpenAI and Langfuse blocks** (irrelevant, and `docs/github-template.md` says to). Strip Redis. Add R2 credentials, bucket, custom domain, and the session secret. |
| `.gitignore` | devkit | adopt | Covers `.env`, `.context/`, `node_modules/`, `dist/`. Correct as-is. |
| `.dockerignore` | devkit | adapt | Keep the shape; update the `apps/web/dist` path once the real layout exists. |
| `.editorconfig` | devkit | adopt | utf-8, lf, 2-space. No reason to change. |
| `.worktreeinclude` | devkit | adopt | Five lines naming env files to carry into worktrees. Still correct. |
| `.pre-commit-config.yaml` | devkit | adapt | The `files:` regex is hardcoded to `^(stacks/typescript/\|stacks/.*/package\.json$\|...)`. **Deleting `stacks/` silently reduces this hook to near-nothing.** Rewrite the regex for the real paths. |
| `.sops.yaml.example` | devkit | skip | No encrypted files in Git are planned. Leave the example in place; adopt only if that changes. |

## `scripts/`

| Path | Source | Decision | Reason |
|---|---|---|---|
| `scripts/worktree-ports.sh` | devkit | adapt | 348 lines of genuinely reusable, language-neutral port allocation — the best thing in the devkit. But it hardcodes six port names and synthesises `POSTGRES_URL`/`DATABASE_URL`/`REDIS_URL`. Edit `calculate_ports()`, `validate_unique_ports()`, `print_env()` and `export_env()` for our ports; remove Redis. |
| `scripts/dev.sh` | devkit | adapt | The port-reclaim logic is valuable. The body is not: it literally runs `bun run --cwd stacks/typescript dev` and can only start **one** process. We need client + server, so this needs a small multiplexer. |
| `scripts/docker-compose.sh` | devkit | adopt | Layered `--env-file` wrapper. Correct and useful unchanged. |
| `scripts/lint.sh` · `format.sh` · `typecheck.sh` · `test.sh` | devkit | adopt | Thin `bun run <x>` wrappers over a stable interface. Keep the interface, change what it points at. |
| `scripts/check-all.sh` | devkit | adapt | Ends with `bun run build`, which currently means `tsc --noEmit`. Once `build` is a real bundle this becomes correct; until then it is misleading. |

## `docs/`

| Path | Source | Decision | Reason |
|---|---|---|---|
| `docs/pattern-report.md` | devkit | delete | A 2026-06-02 scan of 32 repos under someone else's home directory, with real repo names. Tagged `devkit-only` in `MANIFEST.md:58-69`. |
| `docs/template-proposal.md` | devkit | delete | Design rationale for the template itself. Tagged `devkit-only`. |
| `docs/agent-walkthrough.md` | devkit | delete | "Expected agent behaviour when applying this devkit." Tagged `devkit-only`. |
| `docs/github-template.md` | devkit | delete | The generated-repo cleanup checklist. Its job ends with this report. Tagged `devkit-only`. |
| `docs/interfaces.md` | devkit | delete | Repo-template-vs-skill meta-discussion; devkit-only in practice despite not being tagged. |
| `docs/development.md` | devkit | adapt | The most substantive reusable doc — worktree ports, port reclaim, `.worktreeinclude`. Update for a two-process repo. |
| `docs/supply-chain.md` | devkit | adapt | Cut the uv/Bundler/Gradle sections; keep Bun. |
| `docs/tooling.md` | devkit | adapt | Same: keep the TypeScript section, drop the rest. |
| `docs/github-workflows.md` | devkit | adopt | Least-privilege, SHA-pinning, `ci-passed` aggregate, paths-filter guidance. All still correct. |
| `docs/frontend.md` | devkit | adapt | Framework-neutral policy plus the public-env-name mapping table. Narrow to Vite. |
| `docs/secrets.md` | devkit | adopt | SOPS-optional, gitleaks-opt-in. Correct. |
| `docs/observability.md` | devkit | adopt | "Env names exist, don't add SDKs until there's a destination" — exactly our no-analytics position. |
| `docs/deployment.md` | devkit | adapt | Blank decision record plus a platform comparison. Fill in: single VPS, R2, self-hosted F-Droid. Delete the Android section (see `stacks/android`). |

## `stacks/`

| Path | Source | Decision | Reason |
|---|---|---|---|
| `stacks/typescript/` | devkit | adapt | Salvage `tsconfig.json` (good strictness: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) and `vitest.config.ts`. **Delete `src/db/schema.ts`, `drizzle.config.ts`, and the placeholder `src/index.ts`.** Restructure into real `apps/` workspaces rather than a single `stacks/typescript`. |
| `stacks/typescript/pnpm/` | devkit | delete | Bun is chosen. Also note its `ci-web-job.yml` uses unpinned action tags, unlike the rest of the repo. |
| `stacks/python/` | devkit | delete | No Python workspace in this project. |
| `stacks/ruby/` | devkit | delete | No Ruby workspace in this project. |
| `stacks/android/scripts/fdroid-publish.sh` | devkit | **adopt** | **Salvage before deleting the stack.** 168 lines that take an APK path, sign an F-Droid index, and push to `gh-pages`. Works **unchanged** for a Capacitor APK — it is purely APK-in, repo-out. |
| `stacks/android/fastlane/` | devkit | adopt | Store-copy layout shared by Play and both F-Droid paths. Capacitor-agnostic. |
| `stacks/android/fdroid/config.yml.example` · `fdroid/metadata/` | devkit | adapt | Reusable as-is apart from identifiers. Replace `dev.co508.example` → `dev.co508.dormouse`, and `License: GPL-3.0-only` is already correct for us. |
| `stacks/android/scripts/sync-version.sh` | devkit | adapt | Hardcodes `app/build.gradle.kts` and regexes `versionCode = N`. Capacitor generates Groovy `app/build.gradle` with `versionCode N` (no `=`) under `android/`, so the sed misses and the script hard-fails. **Kept rather than deleted** because `fdroid-publish.sh` depends on its `--print` output; rewrite both together at the Android milestone. |
| `stacks/android/github/release.yml.example` | devkit | defer | The two-jobs-in-one-run structure is a real insight (a `GITHUB_TOKEN` tag does not trigger another workflow). But the build steps are `./gradlew assembleRelease` and the artifact paths are wrong for Capacitor. Revisit at the Android milestone. |
| `stacks/android/github/pr-title.yml.example` · `release-please-config.json.example` · `version.txt.example` · `keystore.properties.example` | devkit | defer | All Capacitor-compatible, all irrelevant until Android work starts. |
| `stacks/android/README.md` | devkit | adapt | 400 lines, much of it genuinely transferable (signing, F-Droid policy, secrets table). Harvest into `docs/deployment.md` at the Android milestone, then delete. |
| `stacks/android/fdroid/fdroiddata/` | devkit | defer | The f-droid.org submission payload. `AutoUpdateMode: Version` assumes their bot can regex a Gradle KTS file, and f-droid.org builds from source on their infra. Deferred to the inclusion milestone. |

## `extras/`

| Path | Source | Decision | Reason |
|---|---|---|---|
| `extras/dev-scripts/` | devkit | delete | `dev.ts` spawns uvicorn plus a bun web process. Wrong shape for us. |
| `extras/devcontainer/` | devkit | skip | Not using devcontainers; costs nothing to leave unadopted. |
| `extras/dockerfiles/` | devkit | delete | Python API and worker images we will not build. The web Dockerfile ends at `bun run build` (a typecheck) and produces no runtime stage or artifact. |
| `extras/object-storage/` | devkit | delete | MinIO. We use R2. |
| `extras/github/gitleaks.yml.example` | devkit | adopt | Pinned and checksum-verified. Cheap insurance. |
| `extras/github/dependency-review.yml.example` | devkit | adopt | Cheap insurance. |
| `extras/github/CODEOWNERS.example` | devkit | adapt | Assumes `apps/api`, `apps/web`, `apps/worker`, `packages/shared`. Rewrite for the real layout once it exists. |
| `extras/github/community/` | devkit | skip | Discussion templates; adopt if Discussions get enabled. |
| `extras/todo-to-issue/` | devkit | skip | `workflow_dispatch`-only and needs `contents: write` + `issues: write`. Not worth the permissions. |

## `skills/`

| Path | Source | Decision | Reason |
|---|---|---|---|
| `skills/508-devkit/` | devkit | delete | 185 lines of "how to apply the devkit." Its job ends with this report. |
| `skills/add-migration/` | devkit | delete | "Prefer Alembic (Python) / Drizzle (TS)" — neither is chosen yet. |
| `skills/add-service/` | devkit | delete | Assumes an `apps/*` monorepo of HTTP and worker services and "wire settings through Pydantic." Wrong shape. |
| `skills/promote-context/` | devkit | adopt | Generic `.context/` → tracked-docs promotion. Matches the house rule in `CLAUDE.md`. |
| `skills/triage-ci-failure/` | devkit | adopt | Generic and useful. |

## `.github/`

| Path | Source | Decision | Reason |
|---|---|---|---|
| `.github/workflows/ci.yml` | devkit | adapt | Keep the shape (harden-runner, SHA-pinned actions, `ci-passed` aggregate). **Must fix the path filters** — they reference `stacks/typescript/**` and `stacks/python/**`; once `stacks/` is deleted those jobs never fire and `ci-passed` goes green with everything skipped. A silently-green CI is worse than none. |
| `.github/PULL_REQUEST_TEMPLATE.md` | devkit | adopt | Summary / Validation / Risk / Screenshots. Screenshots are especially apt here. |
| `.github/ISSUE_TEMPLATE/` | devkit | adopt | Three short forms plus config. Fine. |
| `.github/FUNDING.yml` | devkit | adopt | Carries a live `github: 508-dev` entry. **Confirmed intentional** — keeping it to support the co-op. Flagged only because it is on no delete list and is not itemised in `MANIFEST.md`, so it would otherwise ship by accident. |

## New paths to add

| Path | Source | Decision | Reason |
|---|---|---|---|
| `.gitattributes` | target | adopt | **Does not exist today.** Git LFS for sprites, atlases, audio and video posters. Required before any art lands. |
| `docs/design.md` | target | adopt | Plan of record from the planning session. |
| `docs/backlog.md` | target | adopt | Post-v0.1 items, issue-ready. |
| `docs/selection-report.md` | target | adopt | This file. |
| `catalogue/manifest.json` | target | adopt | Per-title provenance: source URL, claimed licence, rights evidence, checker, date. The legal defence for the media library. |
| `LICENSE.server` (AGPL-3.0) | target | adopt | Open-core split: AGPL-3.0 server, GPL-3.0 client. |
| `docs/compliance/uk-osa-risk-assessment.md` | target | defer | Mandatory before public launch, not before v0.1. Tracked in the backlog. |
| Vite build config | target | adopt | The devkit's `"build": "tsc --noEmit"` emits nothing. A real bundle step is a v0.1 blocker. |

## Identifiers to rename repo-wide

| Current | Replacement |
|---|---|
| `508-devkit` | `dormouse` |
| `@508-devkit/web` | per-workspace names under the real layout |
| `dev.co508.example` | `dev.co508.dormouse` |
| `Example App` | `Dormouse` |
| `508-dev/example` | `508-dev/dormouse` |
| `OTEL_SERVICE_NAME=508-devkit` | `dormouse` |
| `508.dev LLC` (LICENSE) | retained — correct copyright holder |
| `caleb@508.dev` (fdroid metadata) | retained — correct author contact |


## Execution notes

Applied 2026-10-29. Three deviations from the plan above, all deliberate:

1. **`stacks/android/` was moved wholesale to `tools/android-release/`** rather
   than cherry-picking the salvaged files. Everything in it was either `adopt`
   or `defer`, so moving the directory preserves the deferred material in place
   and keeps the F-Droid config, metadata and fastlane layout adjacent to the
   publish script that consumes them. Internal path references and the
   `dev.co508.example` → `dev.co508.dormouse` identifiers were updated.

2. **`sync-version.sh` was kept, not deleted.** `fdroid-publish.sh` calls
   `eval "$(scripts/sync-version.sh --print)"`, so deleting it would have
   broken the one script we most wanted to salvage. Row updated above.

3. **`COPYRIGHT.md` was added** (not in the original plan) to carry the
   open-core split, since a single `LICENSE` file cannot express
   GPL-client/AGPL-server plus per-pack asset licences.

Paths marked `skip` (`extras/devcontainer/`, `extras/todo-to-issue/`,
`extras/github/community/`, `.sops.yaml.example`) were left in place unused, per
the `skip` definition. The two `adopt` workflow examples under `extras/github/`
(`gitleaks`, `dependency-review`) were **left as `.example` files rather than
activated** — turning on new CI jobs is a change worth making deliberately
rather than as part of a scaffold cleanup.

`bun.lock` was deleted and must be regenerated by `bun install` once real
dependencies are declared. Until then `bun run check` will not pass, and the
workspace globs in `package.json` (`apps/*`, `packages/*`) point at directories
that do not exist yet.
