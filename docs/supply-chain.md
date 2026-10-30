# Supply chain

Dormouse is a Bun/TypeScript repo. Dependency cooldowns exist so a freshly
published malicious version has to survive a week of public scrutiny before it
can enter the build.

## Bun

`bunfig.toml` sets:

```toml
minimumReleaseAge = 604800          # 7 days
minimumReleaseAgeExcludes = ["@types/bun", "typescript"]
linker = "isolated"
```

The excludes exist because those two packages are published by parties we
already trust transitively and block typechecking when stale.

## Renovate

`renovate.json` mirrors the same policy with `"minimumReleaseAge": "7 days"`,
plus `prConcurrentLimit: 5` and `prHourlyLimit: 2` so updates arrive at a rate
a single maintainer can actually review.

## CI

CI uses locked installs only:

```bash
bun install --frozen-lockfile
```

Lockfiles are committed. A PR that changes a lockfile without a corresponding
manifest change should be treated as suspicious.

## GitHub Actions

Third-party actions are pinned to full commit SHAs, never floating tags, and
every job runs `step-security/harden-runner`. When updating a pinned SHA, do it
deliberately and read what changed — the whole point of pinning is lost if the
bump is automatic and unexamined.

## Assets are a supply chain too

The licence of a generative model or an audio clip is as load-bearing as the
licence of a package, and a bad one is harder to discover later. See
`COPYRIGHT.md` and the rules in `CONTRIBUTING.md`.
