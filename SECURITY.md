# Security

## Reporting a vulnerability

Email **caleb@508.dev** with the details and a way to reach you. Please do not
open a public issue for anything exploitable.

We will acknowledge within a few days. This is a small project run by a small
number of people, so please be patient — but if something is actively being
abused, say so in the subject line and it will jump the queue.

## Scope

Things we especially want to hear about:

- Anything that lets one user make another user's client play unexpected audio.
  This app runs unattended in people's bedrooms while they sleep; audio is the
  highest-severity surface we have.
- Anything that bypasses the block, ban, or room-capacity controls.
- Anything that exposes one user's identity, device id, or private room code to
  another.
- Server-side issues: authentication bypass, room-state injection, media
  queueing on behalf of another user.

## Practices

- Secrets live in environment variables, never in code. See
  [`docs/secrets.md`](docs/secrets.md).
- Dependencies carry a 7-day minimum release age
  (`bunfig.toml`, `renovate.json`) to blunt supply-chain attacks.
- CI pins third-party actions to full commit SHAs and runs with
  `contents: read`.
- We ship no third-party analytics or tracking SDKs, so there is no third-party
  data-sharing surface to audit.

## What we do not claim

We do not use automated content moderation, AI or otherwise. Moderation is a
report queue reviewed by a human roughly weekly, plus per-user blocking,
vote-kick, and a room host who can remove people in the moment. We say this
plainly because overclaiming safety capabilities is both dishonest and, for a
small operator, the larger legal risk.
