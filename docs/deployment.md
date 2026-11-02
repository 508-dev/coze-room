# Deployment

## Decision

**One small VPS. One server process. Postgres alongside it. Media on
Cloudflare R2 behind a custom domain.**

Target: 100 concurrent users, roughly nine live rooms, **$15–25/month** all in.

Room state lives in the server process memory. Postgres holds only the durable
things: accounts, blocks, bans, presets, and the catalogue manifest. There is
no Redis, because at this size a second datastore buys nothing.

## Coolify production

The v0.1 deployment is **https://dormouse.508.dev** on 508.dev's Coolify
instance. It uses these resources in the `production` environment:

| Resource | Name | UUID |
|---|---|---|
| Project | `dormouse` | `2p3ohmkh9sxth0juo2auv2hc` |
| Application | `dormouse` | `d0bc7s4k4h58trxinxp3l7wh` |
| PostgreSQL 17 | `dormouse-postgres` | `mw5h0jzuhgsqv67nlmhuzq9v` |

The application builds the root `Dockerfile` on `Prod1`. The multi-stage build
uses a digest-pinned Bun 1.4.0 Alpine image and frozen-lockfile installs. One
Bun process listens on port 3000 and serves the Vite client, `/health`, and the
`/ws` WebSocket on the same origin, so production needs no client URL override
or separate web resource. Coolify health-checks `GET /health` and Traefik
terminates TLS, including secure WebSockets.

The image carries `packs/` for client art and runtime seat anchors, plus
`catalogue/manifest.json` for server playback. Coolify's application setting
`is_git_lfs_enabled` is enabled for the pack PNG and audio objects, and the
Docker build fails if it finds an unresolved Git LFS pointer under `packs/`.
Large mirrored media remains outside the image.

`VITE_MEDIA_BASE_URL` is a Coolify **build-time-only** variable passed to the
client build as a Docker build argument. It is deliberately empty until R2 is
provisioned, which disables TV playback. Set it to the public custom media
origin and redeploy to enable media. The R2 bucket will also need a CORS policy
allowing `GET` from `https://dormouse.508.dev` so the browser can decode GIF
previews.

PostgreSQL is private to the Coolify destination network. Its generated
credentials are stored only in Coolify, and the application has `DATABASE_URL`.
Nothing reads it yet; the guestbook will be its first consumer. Scheduled
backups are **not configured yet**.

### Redeploy

A signed GitHub push webhook deploys the configured application branch
automatically. To queue the same deployment through the API, load the Coolify
credentials into the shell without writing them into the repository, then run:

```bash
curl --fail-with-body --silent --show-error -X POST \
  "$COOLIFY_URL/api/v1/deploy?uuid=d0bc7s4k4h58trxinxp3l7wh" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN"
```

Inspect progress in the application's **Deployment Logs**, or with
`GET /api/v1/deployments?uuid=d0bc7s4k4h58trxinxp3l7wh`. Verify a finished
deployment with:

```bash
curl --fail https://dormouse.508.dev/health
curl --fail https://dormouse.508.dev/
```

To roll back, revert the bad commit on the configured branch and push it. The
same webhook path deploys the revert; the database volume is untouched.

### Switch from the proof deployment to `main`

The application currently deploys `deploy/coolify` because `main` did not yet
contain the production Dockerfile when the live deployment was proven. After
that branch merges, point the application at `main` and queue one deployment:

```bash
curl --fail-with-body --silent --show-error -X PATCH \
  "$COOLIFY_URL/api/v1/applications/d0bc7s4k4h58trxinxp3l7wh" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"git_branch":"main"}'

curl --fail-with-body --silent --show-error -X POST \
  "$COOLIFY_URL/api/v1/deploy?uuid=d0bc7s4k4h58trxinxp3l7wh" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN"
```

Thereafter, pushes to `main` deploy automatically.

## Media

R2 with a **custom domain** is the whole economics of this project. Egress is
$0, which Cloudflare's service-specific terms (28 Sep 2026) explicitly permit
when the origin is a Cloudflare paid service. 100 concurrent viewers at 480p
streaming continuously for a month is 32.9 TB and costs nothing.

**`r2.dev` will not do.** It is development-only, rate-limited, and uncached,
and Cloudflare's caching is a custom-domain-only feature. Without a real domain
attached the zero-egress story does not materialise.

Storage is the only media cost: a 500-hour 480p catalogue is about 225 GB,
roughly $3.40/month.

## Scale path

Do not pre-build this. When the single process is genuinely the bottleneck:

1. Move room state to Redis.
2. Run N server processes.
3. Route by room id with sticky sessions.

Nothing in the current design blocks that, and doing it early would cost months
for capacity we do not need.

## Android

Release tooling is salvaged from the 508 devkit and lives dormant in
`tools/android-release/`. See its `README.md` for the full model — signing,
versioning, and the F-Droid constraints.

Order of distribution:

1. **Web** — the primary platform.
2. **Self-hosted F-Droid repo** plus a GitHub Releases APK.
   `tools/android-release/scripts/fdroid-publish.sh` does this unchanged: it
   takes an APK path, signs an index, and pushes to `gh-pages`.
3. **Google Play.** Requires verified developer identity; the legal name is
   published. We publish as 508.dev LLC.
4. **f-droid.org inclusion**, last. They build from source on their own
   infrastructure, which for a Capacitor app means the whole Node toolchain has
   to build reproducibly there. Attempt only once the build is boring.

Known gap: `tools/android-release/scripts/sync-version.sh` is written for a
Kotlin/Gradle-KTS app. Capacitor generates Groovy `android/app/build.gradle`
with `versionCode N` and no `=`, so the sed will miss. It needs rewriting
before the first Android release, and `fdroid-publish.sh` depends on its
`--print` output.

## Before public launch

- UK OSA illegal-content risk assessment, written and dated.
- Children's access assessment.
- DSA Article 13 legal representative in an EU member state.
- Published security contact (already in `SECURITY.md`).

These are tracked in `docs/backlog.md`.
