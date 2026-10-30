# Deployment

## Decision

**One small VPS. One server process. Postgres alongside it. Media on
Cloudflare R2 behind a custom domain.**

Target: 100 concurrent users, roughly nine live rooms, **$15–25/month** all in.

Room state lives in the server process memory. Postgres holds only the durable
things: accounts, blocks, bans, presets, and the catalogue manifest. There is
no Redis, because at this size a second datastore buys nothing.

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
