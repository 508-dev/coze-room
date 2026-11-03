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
provisioned, which disables TV playback. Set it to
`https://dormouse-media.508.dev` and redeploy to enable media. The R2 bucket
also needs the CORS policy below so browsers can decode GIF previews and route
cross-origin media elements through Web Audio.

### Proxy and client IPs

`TRUST_PROXY=1` is set as a **runtime** environment variable. The private-rooms
rate limiter uses it to read only the right-most `X-Forwarded-For` hop; earlier
application versions ignore it. The application has `ports_exposes=3000` and no
`ports_mappings`, so the port is available on Coolify's internal Docker network
but is not published on the host. Traefik is the only public ingress. Keep
Traefik's `forwardedHeaders.insecure` disabled (the default) so clients cannot
inject trusted forwarding hops. No custom Traefik access-log query redaction is
configured for the private-room `code` parameter.

### Production image smoke test

With Docker and Bun installed, run:

```bash
./scripts/smoke-production.sh
```

The script builds the production image, starts it on an unused localhost port,
and checks health and startup logs, the pack manifest, real PNG bytes (not an
LFS pointer), and a WebSocket `welcome`. It requires the `dormouse-v0` pack,
which is on `main`. It is not wired into CI yet.

PostgreSQL is private to the Coolify destination network. Its generated
credentials are stored only in Coolify, and the application has `DATABASE_URL`.
The guestbook (#77) is its only consumer; if the database is unreachable at
boot, the guestbook runs in memory instead. Scheduled backups are **not
configured yet**.

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

To roll back, revert the bad commit on `main` and push it. The
same webhook path deploys the revert; the database volume is untouched.

### Branch

The application deploys `main`. The first live deployment ran from the proof
branch `deploy/coolify`, because `main` did not yet contain the production
Dockerfile; after that branch merged (#69), the application was pointed at
`main` on 2026-11-03 and the proof branch was deleted. Pushes to `main` now
deploy automatically through the signed webhook.

Use the application UUID in the table above for every API call. A shared
`.env` may carry a `COOLIFY_APP_UUID` belonging to a different application on
the same instance.

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

### R2 provisioning and upload runbook

The upload tool never provisions R2. In Cloudflare, create the
`dormouse-media` bucket, then:

1. Attach **`dormouse-media.508.dev`** as the bucket's custom domain. Use a
   single-level `508.dev` subdomain because the zone's Universal SSL certificate
   covers `*.508.dev` only one level deep. Do not use `r2.dev`.
2. Apply this bucket CORS policy:

   ```json
   [
     {
       "AllowedOrigins": ["https://dormouse.508.dev"],
       "AllowedMethods": ["GET", "HEAD"],
       "AllowedHeaders": ["Range"],
       "ExposeHeaders": ["Content-Length", "Content-Range", "Accept-Ranges", "ETag"],
       "MaxAgeSeconds": 86400
     }
   ]
   ```

3. Create an R2 API token with **Object Read & Write**, restricted to the
   `dormouse-media` bucket. Set these values in the upload operator's local
   `.env`; keep the credentials out of git:

   ```text
   R2_ACCOUNT_ID=
   R2_ACCESS_KEY_ID=
   R2_SECRET_ACCESS_KEY=
   R2_BUCKET=dormouse-media
   R2_PUBLIC_BASE_URL=https://dormouse-media.508.dev
   ```

4. After ingest, upload one title or all five from the repository root:

   ```bash
   bun run tools/media/upload.ts example
   bun run tools/media/upload.ts --all
   ```

   Uploads use `Cache-Control: public, max-age=3600`. Keys are stable catalogue
   ids, not content hashes, so a moderate one-hour cache lets replacements
   propagate; long-lived `immutable` caching would be incorrect without
   versioned keys. Re-uploading also applies the header to older objects.
5. Set Coolify's **build-time**
   `VITE_MEDIA_BASE_URL=https://dormouse-media.508.dev` and redeploy the
   application. The client must be rebuilt; a runtime-only variable is not
   enough.
6. Verify an uploaded id with a cross-origin range request:

   ```bash
   curl --fail-with-body --silent --show-error \
     --dump-header - --output /dev/null \
     -H 'Origin: https://dormouse.508.dev' \
     -H 'Range: bytes=0-1023' \
     https://dormouse-media.508.dev/example.mp4
   ```

   Check for **206 Partial Content**, `Access-Control-Allow-Origin:
   https://dormouse.508.dev`, `Accept-Ranges: bytes`, and `Content-Range`.
   Media/CORS failures degrade to the client's resting-TV unavailable state.
   The ingest and rendition details are in
   [`tools/media/README.md`](../tools/media/README.md).

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
