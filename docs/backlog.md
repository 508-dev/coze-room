# Dormouse — post-v0.1 backlog

Everything agreed during planning that is **not** in v0.1. One `##` heading per
issue; the heading is the issue title and the body is the issue body. Ready to
pipe into `gh issue create`.

Rough order is accounts → moderation → phrase system → Android. Moderation must
exist before strangers can talk to each other; the phrase system is pointless
before there is anyone to talk to.

---

## Accounts: username + password with recovery code

Username + password, **no email required**. At signup, generate and display a
one-time recovery code with a deliberate "save this" step. Optional email later,
for recovery only, used for nothing else ever.

Demo users keep a persistent device-local id so they remain blockable and
rate-limitable, with gentle nudges toward registering.

Labels: `accounts`, `v0.2`

## Accounts: Altcha on signup

Self-hosted proof-of-work challenge. Explicitly **not** reCAPTCHA or hCaptcha —
both are proprietary and would be an F-Droid problem.

Pair with per-IP signup rate limits.

Labels: `accounts`, `abuse`, `v0.2`

## Accounts: tenure gating for disruptive capabilities

Queueing media, changing the environment, and chatting unlock after a few hours
of account age. Presence is never gated. The principle: gate the loud
capability, not the ability to be in the room.

Labels: `accounts`, `abuse`, `v0.2`

## Moderation: per-user block

Blocks bind to account id, and to device id for demo users. A blocked user's
bubbles and presence are suppressed for the blocker.

Discoverability of block matters more than its existence.

Labels: `moderation`, `v0.2`

## Moderation: vote-kick

Majority of awake users, consistent with the skip-vote mechanic. Build the vote
primitive once and reuse it for skip, environment change, and kick.

Labels: `moderation`, `v0.2`

## Moderation: host role with auto-handoff

First joiner becomes host. Host can change environment without a vote and can
remove a user. Auto-handoff to the next-longest-present occupant when the host
leaves.

Labels: `moderation`, `rooms`, `v0.2`

## Moderation: transcript buffer and retention

9-day rolling buffer of room transcripts: message text, phrase ids, who was
present, timestamps. Extended to **90 days for reported windows** only.

Capture evidence **at report time** — snapshot the surrounding minutes into the
report so the record survives the buffer rolling.

Labels: `moderation`, `v0.2`

## Moderation: admin console

Table of users sorted by **distinct-blocker count** (harder to brigade than
report count), with recent chat history one click away and one-click ban. Bans
bind to account id and device id.

Target: roughly weekly review in a few minutes.

Labels: `moderation`, `v0.2`

## Safety: 16+ age gate

Neutral age screen. Stay plainly not child-directed; avoid acquiring actual
knowledge of under-13 users (COPPA has no small-business exemption and no user
threshold).

Labels: `compliance`, `v0.2`

## Compliance: UK OSA illegal-content risk assessment

Mandatory regardless of size — s.4(6) catches any service "capable of being used
in the UK" with material risk of harm. If all harms rate low the required
measures are light, but **the assessment and its written record are the
obligation**. Also complete the children's access assessment.

Deliverable: a written, dated document in the repo, reviewed after significant
changes.

Labels: `compliance`, `v0.2`

## Compliance: DSA Article 13 legal representative

Non-EU providers offering services in the EU must designate a legal
representative in a member state. No SME carve-out, and the provider stays
liable regardless of the representative's failures.

**First action: find out whether an EU-resident 508 subcontractor will serve in
this role** before paying a compliance vendor.

Labels: `compliance`, `blocked-on-decision`

## Compliance: safety page describing moderation accurately

Describe exactly what we do and nothing more. The actionable legal risk for a
small app is **overclaiming** safety features — NGL was fined $5M hooked on a
false AI-moderation claim.

Labels: `compliance`, `docs`

## Chat: preset phrase system with voice-over

~50 phrases in five categories (greeting / goodnight / reaction / request /
comfort), stored as data keyed by id so a language is a drop-in. Phrases and
emotes are the same object: one list, one UI, one moderation surface.

Commission a single neutral voice first (~$300–600 of budget). Extra voices
become the first sellable content pack.

**No TTS engine.** Free text stays visible and always silent.

Labels: `social`, `content`, `v0.3`

## Chat: free-text chat with bubbles and collapsible log

Visible above the avatar and in a collapsible history panel. **Never spoken.**

Labels: `social`, `v0.3`

## Chat: whispers (private messages)

Note: Google Play's UGC policy requires **in-app blocking for 1:1 interaction**,
so whispers cannot ship before block does.

Labels: `social`, `v0.3`

## i18n: Japanese as the second language

The phrase list is 50 strings plus 50 audio files — the easiest thing in
software to localise, with no UI reflow. Japanese first because the VRChat sleep
scene is disproportionately Japanese and nobody serves them a 2D version.

Labels: `i18n`, `content`

## Android: Capacitor shell

Safe-area insets, hardware back button, keyboard-resize behaviour. Background
audio service so the ambient bed and TV audio survive screen-off.

Labels: `android`, `v0.4`

## Android: self-hosted F-Droid repo

The devkit's `scripts/fdroid-publish.sh` works unchanged for any APK producer —
salvage it before deleting `stacks/android`. Publishes a signed APK into an
F-Droid repo on `gh-pages`.

Note: `sync-version.sh` is Kotlin/Gradle-KTS-specific and needs rewriting for
Capacitor (Groovy `versionCode N`, no `=`, under `android/`).

Labels: `android`, `release`, `v0.4`

## Android: Google Play listing

Requires verified developer identity; the legal name is published. Publish as
508.dev LLC. Must satisfy Play's UGC policy: terms acceptance before posting,
defined prohibited behaviours, in-app reporting and blocking.

Labels: `android`, `release`

## Android: f-droid.org inclusion

Attempt only once the build is boring. f-droid.org builds from source on their
infrastructure, which for Capacitor means the whole Node toolchain must build
reproducibly there.

Labels: `android`, `release`, `stretch`

## Media: expand catalogue to 30 titles

Each individually rights-checked, mirrored to R2, recorded in the provenance
manifest with source URL, claimed licence, evidence, and checker. Split silent
and non-silent in the UI.

Safer pools: pre-1930 US films, Wikimedia Commons video, Blender open movies
(CC BY 4.0), NASA.

Labels: `media`, `content`

## Media: ingest pipeline

One script per title: mirror to R2, transcode 480p, extract audio-only
rendition, generate the low-res in-scene GIF, append to the manifest.

Labels: `media`, `tooling`

## Media: round-robin queue

One pending item per person. **Make the queue strategy pluggable** — a future
per-room setting.

Labels: `media`, `v0.3`

## Media: skip vote

Majority of **awake** users (active in last 10 min), minimum 2 votes. Sleepers
excluded from the denominator.

Labels: `media`, `v0.3`

## Media: house playlist

Auto-plays when the queue empties, presented as "playing from the shelf" so it
reads as deliberate rather than as a fallback. A queued item jumps ahead.

Labels: `media`, `v0.3`

## Rooms: private rooms by code

Short pronounceable code (word-word-word — people read these aloud at 1am).
Invisible to all listings. Destroyed 10 minutes after the last person leaves.

Labels: `rooms`, `v0.2`

## Rooms: solo rooms

Private rooms with capacity 1. Created instantly, no code.

Labels: `rooms`, `v0.2`

## Rooms: saved presets

A preset is `{environment, volumes, queue}` saved per user and applied on room
creation. Solo and private rooms only.

Labels: `rooms`, `v0.3`

## Rooms: 16-hour inactivity timeout

With warning, to prevent squatting on a public room.

Labels: `rooms`

## Rooms: expanded public room set

Grow from one to six or eight hand-named persistent rooms. Show occupancy, who
is present, what is playing, and the weather on the room list so choosing is
part of the wind-down.

Labels: `rooms`

## Environment: majority vote with cooldown

Host or simple majority, 2-minute cooldown. **Local-only audio preview** so a
user can audition an environment before spending the cooldown. Volume is local;
the choice is shared.

Labels: `rooms`, `audio`, `v0.3`

## Environment: expand to more outdoor views

Beyond the v0.1 two. Light/medium/heavy rain, thunderstorm, ship at sea,
beachside, forest creek, windy cliff. Only ever partially visible through the
window.

Labels: `art`, `audio`, `content`

## Art: full avatar layer set

8 options each for skin/fur tone, head/hair, top, accessory, across 4 poses.
**Runtime compositing, never pre-baked.** One shared project palette.

Labels: `art`, `content`

## Art: asset pack system

Versioned pack directories plus a manifest, loaded by pack id. Makes swapping
generated art for commissioned art a data change, and is the same mechanism the
commercial content packs will use.

Labels: `art`, `architecture`

## Art: shader set

Rain on glass, god rays, fog, CRT glow, candle gutter, water, cloth sway,
parallax. Procedural motion replaces animation frames and is where the visual
budget should go.

Labels: `art`, `rendering`

## Infra: Git LFS

No `.gitattributes` exists today. Needed before art and audio land.

Labels: `infra`, `v0.1-blocker`

## Infra: real bundler build

The devkit's `"build": "tsc --noEmit"` emits nothing. Needs an actual Vite build
producing a deployable artifact.

Labels: `infra`, `v0.1-blocker`

## Infra: deploy

Single VPS, one process, room state in memory, Postgres for durable data, no
Redis. R2 with a **custom domain** — `r2.dev` is development-only and
rate-limited, and without a custom domain the zero-egress story does not
materialise.

Labels: `infra`

## Infra: metrics from server logs

No third-party analytics, no SDK. Session length, room occupancy, queue actions
and retention all derive from our own logs — earns no F-Droid anti-feature flag
and keeps the privacy policy short.

Labels: `infra`, `privacy`

## Upstream: PR feedback to 508-devkit

Generalisable gaps found while adapting the scaffold, none specific to this
project:

- No asset-pipeline or Git LFS story; no `.gitattributes`
- `"build": "tsc --noEmit"` is a typecheck, not a build
- CI path filters silently pass green when `stacks/` is deleted — `ci-passed`
  succeeds with every component job skipped
- `.pre-commit-config.yaml` `files:` regex is hardcoded to `stacks/`
- `scripts/dev.sh` can only start one process; no multiplexer for a
  client + server repo
- `.github/FUNDING.yml` carries a live `github: 508-dev` entry that is on no
  delete list and is not itemised in `MANIFEST.md`
- `scripts/worktree-ports.sh` hardcodes six port names and synthesises
  `POSTGRES_URL`/`DATABASE_URL`/`REDIS_URL`, so dropping Postgres means editing
  the port helper

Repo: https://github.com/508-dev/508-devkit

Labels: `upstream`

## Stretch: avatar walking

Free roam with directional walk cycles. Deliberately deferred — walk cycles are
the most expensive animation in the project and seat-based movement makes
netcode trivial. Revisit only once there is an art budget.

Labels: `stretch`

## Stretch: Discord Activity as a second client

Distribution channel, not a platform. An Activity is a web view and the web
client is most of the way there. Cannot replace the standalone product: Discord
is server-scoped, so a drop-in lobby of twelve quiet strangers is structurally
impossible there.

Labels: `stretch`, `distribution`

## Stretch: arbitrary TTS as a premium feature

Only with per-listener opt-in and a trust relationship. Revisit the SSML
injection surface, Piper's voice-licence situation, and EU AI Act Article 50
before building.

Labels: `stretch`, `premium`

## Stretch: commercial content packs

Art and audio packs as the commercial surface, following lofi.town's model:
cosmetics and convenience only, co-presence never paywalled. Requires the asset
pack system to exist first.

Labels: `stretch`, `premium`
