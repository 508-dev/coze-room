# Development

Local development follows the pattern used across existing projects:

- Docker Compose owns infrastructure.
- App services run on the host.
- Ports are deterministic per worktree.

## Commands

```bash
./scripts/worktree-ports.sh env
./scripts/docker-compose.sh up -d postgres
./scripts/dev.sh
./scripts/check-all.sh
```

### Client/server smoke test without infrastructure

Neither the current room skeleton nor its tests need Postgres. In two terminals
at the repo root (use the same port exports in each):

```sh
eval "$(./scripts/worktree-ports.sh export)"
bun run --cwd apps/server dev
```

```sh
eval "$(./scripts/worktree-ports.sh export)"
VITE_API_BASE_URL="http://127.0.0.1:$API_PORT" bun run --cwd apps/client dev
```

Open `WEB_URL` from `./scripts/worktree-ports.sh env`. Verify the room name and
occupant count appear, then click furniture: a seated occupant appears.
Repeat after resizing so a 2x room is centred/letterboxed, then at 360×640 with
device pixel ratio 2 or 3: the whole room fits fractionally, without cropping,
and seats stay clickable in CSS coordinates (renderer resolution caps at 2x).
The network panel should show the same JSON `join`, `welcome`, `takeSeat`, `moved` messages.
`/packs/dormouse-v0/manifest.json` and occupant textures should load. The technical
fixture `/packs/test-fixture/manifest.json` remains available; builds must contain the same
fixture under `apps/client/dist/packs/`. To test selection, set a room's optional
`packId` to `test-fixture` locally; a nonexistent id should warn and keep seats.

After an art revision, run `bun run art:manifest` (Python 3 standard library only).
Vitest invokes its Python unit tests and checks that the committed manifest is
byte-identical to regenerated output. See `frontend.md` for the feature sections.

Private rooms are created with `POST /rooms/private`, which returns `{ roomId,
code }`, and joined with `/ws?code=word-word-word`. Codes are case-insensitive
and accept spaces in place of hyphens. They never appear in `/rooms` or health
counts. Share links and deep links use `#code=word-word-word` so the code stays
out of ordinary HTTP request logs, and the client removes the fragment after a
successful join. The WebSocket handshake still requires `/ws?code=…`; that query
string can remain in application or proxy access logs, so redact it where possible.

Creation and code-join attempts have separate per-IP fixed-window limits. Repeat
attempts for the same valid code do not consume the reconnect budget. With
`TRUST_PROXY=1`, the limiter trusts only the right-most X-Forwarded-For hop from
the single Coolify/Traefik proxy. Enable it only when the app port is reachable
through that proxy and never directly by clients.

### Local catalogue playback (no R2 required)

Ingest the mirrored sources as described in `tools/media/README.md`. Files stay
outside the repository. In the client terminal, opt into the Vite-only rendition
route (and use the same port exports as above):

```sh
DORMOUSE_MEDIA_DIR="$HOME/dormouse-media/renditions" \
VITE_MEDIA_BASE_URL=/__media \
VITE_API_BASE_URL="http://127.0.0.1:$API_PORT" bun run --cwd apps/client dev
```

`DORMOUSE_MEDIA_DIR` is server-side dev configuration and takes an **absolute**
path. The route accepts only generated `<id>.mp4`, `.m4a`, and `.gif` files,
supports native single-byte-Range requests, and refuses paths/symlinks outside
that directory. It is absent from production builds **and** Vite preview; no
media is copied into `dist`. Production instead sets `VITE_MEDIA_BASE_URL` at
build time to the R2 custom domain. That domain must allow browser CORS GET
for the GIF fetch/decoder as well as Range requests for native playback.
Leaving the base empty keeps the TV quietly off.

Click the in-scene TV or the accessible "Playing from the shelf" button. Two
clients joining at different times should seek into the same film; check
`206 Partial Content` for the MP4 and that no original source host is contacted.
The shelf is split into Silent / With sound, with per-title credits. Drift-off
should unload MP4 and use only M4A; waking returns to MP4 only while the watch
view is open. A browser autoplay refusal should offer a tap-to-play/listen
button, not break the room. The GIF is a short excerpt, not a synced full film.

The server sends public catalogue metadata in welcome, plus `(itemId,
startedAt)` and a clock sample; changes broadcast `media`. A `mediaSync`
request every 30 seconds refreshes state and estimates server clock offset
using its round-trip midpoint. The estimate is deliberately unsmoothed: the
2-second seek deadband and 30-second resampling absorb occasional RTT outliers.
The native player resyncs every 15 seconds and on media snapshots. The house
schedule cycles manifest order from a fixed
2026-01-01 UTC reference, calculating directly from durations: restarts,
skipped ticks and empty rooms do not restart or cumulatively drift the film.
An occupied room arms one boundary timeout for prompt title changes; the room
tick remains a backstop. The timeout is cancelled when the room empties or its
owner calls `room.destroy()` before retiring it.
`media-playlist.ts` is the strategy seam for future user queues; this does not
implement queue requests, skip votes, or play/pause propagation.
The server defensively reads and validates `catalogue/manifest.json` at feature
construction, so deployment images should include `catalogue/` alongside the
server and protocol workspaces. Missing/invalid catalogues warn once and leave
the TV off without disabling presence, seating, or the rest of the server.

R2 provisioning/upload (#61) and human approval of the manifest's pending
rights reviews remain release prerequisites; local playback does not imply
either is complete.

## How to add a server/protocol feature

Keep transport and room lifetime independent of feature logic:

1. **Protocol:** define `<Feature>ClientMessage` / `<Feature>ServerMessage` unions
   in `packages/protocol/src/<feature>.ts`. Add one `| import("./<feature>").…`
   line to each relevant union in `src/index.ts`. Keep unique `t` tags and add
   public type re-exports as needed. Snapshot fields go in a `<Feature>Welcome`
   interface, extended by `WelcomeFields` in `presence.ts`; wire fields stay
   top-level and protocol version 1 is unchanged by this refactor.
2. **Server:** create `apps/server/src/features/<feature>.ts` exporting a factory
   returning `RoomFeature`. Add its factory to `features/registry.ts`. A factory
   runs **once per Room**, so feature state must be inside it, not module globals.
   No edits to `index.ts` are needed. That file only decodes and calls
   `room.handleMessage(id, message, socket)`.
3. `onMessage(room, id, message)` returns `true` only for owned messages (stopping
   dispatch); return `undefined` for everything else. Non-join messages dispatch
   only for known occupants. The core validates join names, look indices (0–7)
   and seat IDs before dispatch; features must validate their own payloads.
   Message-handler exceptions are caught/logged and abort only that message.
   `room.occupants`/`room.spec` expose room state;
   `room.broadcast(message)` and `room.send(id, message)` deliver typed responses.
   Do not keep a socket reference in the feature.
4. `onJoin` runs after membership insertion, before the core `joined` broadcast
   and before welcome is collected.
   `welcome(room, selfId)` contributes `Partial<WelcomeFields>`; keep to your own
   fields. The core retains empty media/guestbook defaults for wire compatibility.
   `onLeave` runs **after actual eviction**, not at transient disconnect (the
   two-minute seat grace still applies). `onTick(room, now)` runs after core
   dozing/eviction; `now` is server wall-clock milliseconds. Hooks are synchronous;
   do asynchronous I/O inside a feature with explicit error handling, never
   assume the room waits for it. Persistence is not implemented by this refactor.
5. Room discovery/lifetime goes in `room-registry.ts`, public specifications in
   `rooms.ts`. This is the private-room extension point, separate from HTTP/WS.
6. Add tests alongside the feature, injecting factory lists into `new Room(spec,
   factories)` when useful. See `features/feature.test.ts` for dispatch, lifecycle,
   welcome and state-isolation examples. Run `./scripts/check-all.sh` and the
   smoke test above before opening a PR.

For client handlers, feature-owned runes, layers, UI registration and pack
manifest sections, see the concrete checklist in [`frontend.md`](frontend.md).

`worktree-ports.sh env` is the print-only URL/port mode. It prints `WEB_URL`
first, then `WEB_PORT`, then the remaining assigned ports and derived
connection strings, and exits without starting services. Keep that order when
adapting the helper so coding workspace tools discover the web surface before
API or infrastructure URLs.

## Worktree Port Reservations

`scripts/worktree-ports.sh` normally hashes the absolute git worktree path and
derives stable local ports from that hash. Some agent/worktree orchestrators
reserve ports for each workspace. Keep product-specific environment variable
names out of the helper and map them to these generic names in the run command
or wrapper script:

- `WORKTREE_PORT_BLOCK_START`: first port in a reserved block.
- `WORKTREE_PORT_BLOCK_SIZE`: size of the reserved block, default `10`.
- `WORKTREE_PRIMARY_PORT`: one reserved public port.
- `WORKTREE_PRIMARY_PORT_TARGET`: `WEB_PORT` or `API_PORT`, default `WEB_PORT`.

When a block is present, the helper uses compact offsets inside it for web, API,
worker health, database, cache, and OTEL example ports. When only one public port
is present, the helper assigns it to the selected primary target and keeps other
ports on the normal deterministic worktree allocation.

## Optional Port Reclaim

Dev scripts may offer opt-in port reclaim so a developer can rerun the same
worktree script after a stale dev process is left behind:

```bash
./scripts/dev.sh --reclaim-ports
DEVKIT_RECLAIM_PORTS=1 ./scripts/dev.sh
```

Reclaiming must stay conservative. Before killing a process, inspect the port
owner with `lsof`, verify the process cwd or parent process cwd is under the
current worktree, and verify the command looks like the same service type the
script is about to start. Refuse to kill unrelated listeners and print the pid,
cwd, and command so the developer can decide manually.

The root `scripts/dev.sh` includes a small shell example for single host-run
web-dev processes. It walks a short parent chain from the process listening on
`WEB_PORT` and only sends `SIGTERM` when it finds a same-worktree JS dev command
such as Next, Vite, Astro, webpack, rsbuild, Bun, or pnpm. The shell helper is
generic enough for adapted repos to add other host-run app processes:

```sh
# Example only: add a service-specific signature before enabling this.
reclaim_service_port api "$API_PORT"
reclaim_service_port worker-health "$WORKER_HEALTH_PORT"
```

Each extra service needs its own command matcher, such as a Uvicorn app import
for an API, a queue-worker binary name, or a bot executable. Do not treat all
same-worktree processes as reclaimable; a repo can run unrelated listeners from
the same checkout.

Avoid reclaiming Docker-owned infrastructure ports from the host dev script.
For Postgres and similar Compose services, use stable
`COMPOSE_PROJECT_NAME` with `./scripts/docker-compose.sh up` / `down` so
same-worktree runs are idempotent. If an infrastructure port is held by
something else, report the owner and ask the developer to stop it or change the
configured port.

For multi-service repos, prefer a small service-aware mux helper instead of
copying generic shell globs. A good pattern is:

```text
scripts/dev.sh web
  -> scripts/dev_mux.py --ensure-port web
  -> lsof owner pids for the web URL port
  -> walk parent/child process tree
  -> require same worktree path scope
  -> require service signature, such as the uvicorn app import or discord-bot
  -> stop the related service process tree
  -> verify the port is free before starting
```

This avoids killing a different service that happens to run from the same repo,
and avoids prefix-path mistakes such as treating `/tmp/app/foo-bar` as being
inside `/tmp/app/foo`.

## Worktree Includes

Use `.worktreeinclude` to allowlist ignored local files that should be copied into new sibling worktrees. Treat entries as gitignore-style path patterns, not shell globs passed directly to `cp`.

Example:

```text
.env
.env.local
.env.development.local
.sops.yaml
```

Do not include generated state such as `.venv`, `node_modules`, caches, local databases, screenshots, or raw logs. Those should be recreated per worktree.

## Workspace Context

Do not commit `.context/`. Conductor creates it as workspace-local scratch for
agents. Durable runbooks and decisions belong in tracked docs such as this file,
`docs/tooling.md`, and `docs/pattern-report.md`.

## Docker Build Contexts

Keep `.dockerignore` in every repo that has Dockerfiles or Compose services. Exclude local secrets, dependency directories, caches, agent scratch state, and build outputs so Docker does not upload large or sensitive files into the build context.

Example:

```text
.git
.context
.env
.env.*
!.env.example
.venv
node_modules
**/node_modules
__pycache__
.pytest_cache
.mypy_cache
.ruff_cache
dist
build
```

## Why Host-Run Services

Host-run app services are faster for reload loops, easier for agents to inspect, and avoid rebuilding containers for normal code changes.

Use full-container Compose only when validating deployment parity.

## Agent Notes

- Keep root scripts as stable entrypoints. Change package-manager internals
  behind them when adapting a target repo.
- Use `./scripts/worktree-ports.sh env` before debugging port conflicts.
- Copy ignored local config through `.worktreeinclude`; do not commit copied
  `.env` files or generated workspace state.
