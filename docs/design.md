# Dormouse — design, plan of record

> Status: agreed 2026-10-29. Name pending final trademark/domain clearance.
> This document captures decisions and the reasons behind them. When a decision
> changes, change it here and say why.

## What this is

A shared pixel-art room you fall asleep in.

The product promise is the feeling of other people being nearby while you drift
off — the burning-man hammock camp with a projector running, where some people
are half-watching in a daze and others are already out. A quiet dorm. A family
sleepover where someone put the TV on at 2am.

**Stillness is the aesthetic, not a failure state.** Avatars visibly fall asleep.
The room is designed to be beautiful when nobody is doing anything. Liveness
comes from ambient motion and the overnight guestbook, not from conversation.

This matters because the central design tension is unavoidable: within ~20
minutes of a room filling, everyone in it is unconscious. Designing for a chatty
room produces a chatty room, and it will be empty. We design for the quiet one.

## Constraints

| | |
|---|---|
| Owner | 508.dev LLC (US), profit-share with future contributors |
| Budget | ~$5k cash; developer time uncompensated |
| Scale target | **100 concurrent users** — a stated constraint, not an aspiration |
| Platforms | Web (primary), Android (second). **iOS is out of scope.** |
| Licence | Open core — AGPL-3.0 server, GPL-3.0 client, commercial art/audio packs |

Designing for 100 concurrent is deliberate. Outgrowing it and rewriting the
server is cheaper than pre-building for scale we do not have.

## Stack

- **Renderer:** PixiJS v8 (MIT), WebGL2 baseline, GLSL shaders
- **UI chrome:** Svelte 5, strictly separated from the canvas
- **Android:** Capacitor
- **Server:** single process, Node or Go, WebSocket
- **Data:** Postgres for durable state; **no Redis**
- **Media:** Cloudflare R2 behind a custom domain

WebGL2 over WebGPU because WebGPU adapter success is only ~75% on Android, our
primary platform. Capacitor because it is the only wrapper with a proven,
reproducible, developer-signed app on F-Droid today. TWA is ruled out: nothing
on F-Droid uses it and it collides with F-Droid's "must add native value over a
website" bar.

Room state lives **in memory**. At 12 users per room and 100 concurrent that is
about nine live rooms; Postgres holds only accounts, blocks, bans, presets, and
the catalogue manifest.

## The room

**Seat-based. Avatars do not walk.** You tap a seat and your avatar transitions
there with a short hop or fade. Free roam is deferred indefinitely.

This deletes directional walk cycles — the single most expensive animation in
the project and exactly the category we cannot generate. It also makes netcode
trivial: discrete slot occupancy, no position interpolation, no prediction.

- **More seats than people**, so the last to arrive is never stuck with the
  worst spot. A few seats are distinctly desirable (window hammock, by the fire)
  and people may move freely between them.
- **Sleep animation at 10 minutes idle.** Cosmetic only; it restricts nothing.
- **Disconnect holds your seat for ~2 minutes** so a wifi blip does not evict
  you and the room does not flicker.
- **Sleepers hold slots.** The optional room-exit timer is off by default.
- **"Room full" shows who is inside**, so it reads as cosy rather than broken.

### Rooms and discovery

- A **small fixed set of named, persistent public rooms.** Not user-created.
  A short list concentrates population so rooms are occupied; it also bounds the
  moderation surface. Named places people return to beat an infinite lobby list.
- **First joiner becomes host.** Auto-handoff when the host leaves.
- **16-hour inactivity timeout with warning**, to prevent squatting.
- **Private rooms** by short pronounceable code (word-word-word, read aloud at
  1am), invisible to all listings, destroyed 10 minutes after the last person
  leaves.
- **Solo rooms** are private rooms with capacity 1.

## Media

**No YouTube.** YouTube's Developer Policies conflict with this product on at
least four separate clauses: background/screen-off audio (III.I.9), overlays on
the player (RMF), server-automated playback without per-action consent
(III.I.2), and charging for a tier that includes the player (III.F.3.a).
Synchronised co-watching is unaddressed rather than permitted, and there is no
co-watching API or partner programme to apply to.

Instead: **30 hand-cleared public-domain titles, mirrored to R2.**

- Silent and non-silent split in the UI.
- Each title individually rights-checked, with a provenance manifest in the repo
  recording source URL, claimed licence, the evidence, and who checked it.
  "It's on archive.org" is not a rights position — the Internet Archive
  disclaims its own licence metadata and its ToU grants access "for scholarship
  and research purposes only."
- Safer source pools: pre-1930 US films, Wikimedia Commons video (guaranteed-free
  licence family, CORS `*`, hotlinking explicitly allowed), the ~17 Blender open
  movies (CC BY 4.0), NASA footage (blanket PD).
- **Never hotlink.** Mirror everything.
- **Pexels, Pixabay, Coverr and Mixkit are structurally banned** — their
  "Standalone" clauses plus "replicate a similar or competing service" plus
  "bulk, large-scale or systematic copying" close every door. None of this is on
  their licence-summary pages.

### Delivery and sync

- **Progressive 480p over HTTP Range.** No HLS, no ABR ladder — at one rendition
  the complexity is not worth it.
- **Pregenerated low-res GIFs** per title for the in-scene TV.
- **An audio-only rendition** per title, extracted at ingest.
- **Sync is `(item_id, started_at)` and a client-side seek.** No play/pause
  propagation, no buffering coordination. Late joiners land mid-film; drift
  self-corrects on every resync. Nobody is talking in real time, so drift does
  not matter.

### Queue

- **Round-robin, one pending item per person.** Prevents one person owning the
  night. Queue strategy is pluggable and may become a per-room setting.
- **Skip = majority of awake users** (active in the last 10 minutes), minimum 2
  votes. Sleepers are excluded from the denominator; they have opted out of
  decisions by definition.
- **House playlist when the queue empties**, presented as "playing from the
  shelf" so it reads as deliberate.

### Cost

R2 with a custom domain has **$0 egress**, explicitly permitted by Cloudflare's
service-specific terms (28 Sep 2026) when the origin is a Cloudflare paid
service. 100 concurrent viewers at 480p streaming continuously all month is
32.9 TB → $0. A 500-hour catalogue is ~225 GB → ~$3.40/month storage.
`r2.dev` is development-only and rate-limited: **a custom domain is mandatory**
or none of this materialises.

The binding constraint on video is rights clearance, not bytes.

## Audio

- **Freesound CC0 and CC BY only** — 643,703 sounds, 87.2% of the corpus.
  **Never NonCommercial**, which would block the paid tier. Watch out for
  ShareAlike contaminating a mixed asset.
- Every commercial stock-SFX vendor is out. Zapsplat §4 literally reads "must
  not constitute the primary value of a product (for example a sound effects
  app)." Soundsnap bans distribution "in a manner that allows the Sound to be
  extracted." The whole industry has converged on clauses naming this product
  category.
- **Downloaded once, cached, looped locally. Never synced.**
- Environment is **shared state** — changed by the host or simple majority, with
  a 2-minute cooldown and a local-only preview so you can audition before
  spending the cooldown.
- **Volume is local; the choice is not.** Forced environment sharing is the
  point.

## Sleep behaviour

- **Drift-off mode:** the renderer throttles hard and the screen dims while
  audio, presence, and the network connection continue. Toggleable.
- **The TV drops to the audio-only rendition automatically** when drift-off
  engages. One transition, three wins — battery, heat, and data.
- **Independent audio sleep timer** with a wind-down ramp.
- **Optional room-exit timer**, off by default.

### Data budget

Non-media traffic is a rounding error: state events run well under one per
second, ~20–40 bytes each binary-encoded. **A full night is ~1 MB quiet, ~4 MB
chatty.** The entire data cost is the TV:

| Stream | Per hour | Per 8-hour night |
|---|---|---|
| 480p video @ 1 Mbps | 450 MB | 3.6 GB |
| Audio-only @ 96 kbps | 43 MB | 345 MB |
| Audio-only @ 64 kbps mono | 29 MB | 230 MB |

## Social and safety

**There is no TTS engine.** Chat is a fixed palette of ~50 preset phrases in
five categories (greeting / goodnight / reaction / request / comfort), spoken
via recorded voice-over. Free text remains, visible as a bubble and in the log,
and is **always silent**.

This is a structural decision, not a conservative one. It eliminates:

- The entire SSML-injection attack class (`<sub alias>`, `<prosody volume>`,
  `<audio src>` — all real, all documented in Azure and AWS docs).
- Piper's GPL-3 relicensing and its CC-BY-NC voice-licence minefield.
- The EU AI Act Article 50 synthetic-audio marking question.
- The precedent that worries me most: when a troll made a Twitch streamer's
  channel speak a slur while he was away, **the platform banned the absent
  streamer.** An unattended overnight room with open TTS is that scenario as a
  standing condition.

Arbitrary TTS is a possible future premium feature, not a v1 one.

### Moderation

- Per-user **block**, **vote-kick**, and a **host** role with auto-handoff.
- **Moderation console** sorting users by **distinct-blocker count** — harder to
  brigade than report count — with recent history one click away and one-click
  ban.
- **9-day rolling transcript buffer**, extended to **90 days for reported
  windows**. Log message text, phrase ids, who was present, timestamps.
- **Capture evidence at report time** — snapshot the surrounding minutes into
  the report so the record survives the buffer rolling.
- Bans bind to account id **and** device id.
- **Describe moderation accurately and never overclaim.** NGL was fined $5M
  hooked on a false claim about AI moderation. The actionable legal risk for a
  small app is overclaiming, not failing to stop all harm.

The nearest analogue shows exactly how this fails: MIT Technology Review found
children's voices "often" present in adult VRChat sleep rooms, including a
child's "Hi, I like your avi" answered by an adult man with "Wanna cuddle?"

## Accounts

- **Username + password. No email required.**
- **One-time recovery code** displayed at signup with a deliberate save step.
- Optional email later, for recovery only, used for nothing else ever.
- **Altcha** for signup (FOSS, self-hostable, proof-of-work, no Google — unlike
  reCAPTCHA/hCaptcha, which would be an F-Droid problem anyway).
- **Demo users** get a persistent device-local id, can sit and lie down, and get
  gentle nudges toward an account.
- **Loud capabilities gated behind account tenure**, not behind signup friction.
  Gate the disruptive capability, not the ability to be present.

Email is nearly worthless as anti-spam (throwaways are free). What it actually
buys is recovery, which the recovery code provides without collecting anything.

## Legal and compliance

- **16+ neutral age gate.**
- **Serve everywhere. No geoblocking.**
- **UK OSA:** in scope regardless of size — s.4(6) catches any service "capable
  of being used in the UK" with material risk of harm, and there is no size
  threshold. If all harms rate low the required measures are light, but the
  **risk assessment and its written record are mandatory**. Penalties are £18m
  or 10% of worldwide revenue.
- **EU DSA Article 13:** a non-EU provider must designate a legal representative
  in a member state, with no SME carve-out. **Open: check whether an EU-resident
  508 subcontractor will serve** before paying a vendor. As a micro enterprise we
  are exempt from Articles 20–28 and the annual transparency report.
- **COPPA:** no small-business exemption, no user threshold, penalties up to
  $53,088 per violation. Stay plainly not child-directed and avoid acquiring
  actual knowledge.
- Publish as **508.dev LLC** — Google Play publishes the developer's legal name,
  and the LLC satisfies that without exposing an individual.

## Art

**v0.1 scope:** 1 room, 2 outdoor views (partially visible through windows),
4 seats × 4 catalogue looks × awake/asleep. The seat determines sitting or lying;
there is no standing sprite and no drawn animation. Unseated guests remain in the
presence count, but do not appear on the canvas until they choose a seat.

**Per-seat occupant sprites for v0.1**, adopted 2026-11-02 after the inpainting
experiments below. A small fixed catalogue is 32 sprites, not the combinatorial
explosion of layered customisation. **Runtime layer compositing** (skin/fur,
head/hair, top, accessory) moves to #38 after v0.1; never pre-bake its 4,096
combinations per pose. This change trades customisation for consistent seat
perspective, readable sleep poses and an achievable generated-art budget.

**Palette: [Atropoeia](https://lospec.com/palette-list/atropoeia), 48 colours.**
Settled 2026-10-30. Committed at `tools/art/palette.hex` as the single source of
truth. Every asset quantizes to this and nothing else — one shared palette is
what makes generated assets look like one world rather than fourteen, and it is
the most expensive decision to reverse, because every asset ever quantized would
need regenerating.

**Pipeline:** generate stills → deterministic nearest-neighbour downsample to
the pixel grid → quantize to the palette, no dithering → hand cleanup in
LibreSprite. The deterministic middle two steps are what turn a diffusion
model's high-resolution *picture of* pixel art into actual pixel art on a real
grid. LibreSprite rather than Aseprite (settled 2026-10-31) because it is free
software in Manjaro's official repositories, while Aseprite is proprietary and
AUR-only; both read and write the same indexed PNGs. The runbook is
[`tools/art/README.md`](../tools/art/README.md).

**Generation environment:** Manjaro Linux, RTX 5090 (32 GB). ComfyUI installed
2026-10-30. SDXL is the intended checkpoint, chosen because the pixel-art LoRA
ecosystem for SDXL is by far the richest; FLUX.1-schnell (Apache-2.0) is the
fallback. A *LoRA* is a small add-on file that biases a base model toward one
style without retraining it. The LoRA is **PixelArtRedmond** (settled
2026-10-31), because its Hugging Face and Civitai terms agree that generated
images may be sold. The better-known Pixel Art XL was rejected because its two
listings contradict each other on commercial use. Evidence for both is in
[`tools/art/PROMPTS.md`](../tools/art/PROMPTS.md).

PixelArtRedmond draws on a fixed 16-pixel block regardless of resolution,
strength or prompt, so a sprite's true size is its generation size ÷ 16, and
the downsample is a fixed `--cell 16`. Avatars generate at 768×768 into a 48×48
canvas; nothing smaller survives SDXL.

**Model and LoRA licences matter as much as output**, because the commercial
surface is art packs:

- SDXL base (CreativeML Open RAIL++-M) and FLUX.1-schnell (Apache-2.0) permit
  commercial use.
- **FLUX.1-dev is non-commercial. Do not use it.**
- **LoRAs carry their own individual licences and many Civitai LoRAs are
  non-commercial or no-derivatives.** Check each one, record the licence and
  source URL in `tools/art/PROMPTS.md`, and if terms are unclear, do not use it.

**A conformance check, not a convention.** `tools/art/verify.py` fails CI on any
non-palette colour, partial alpha, or off-grid dimension. This is the cheap
mechanism that keeps a generated asset set coherent over months without anyone
policing it by eye.

**Expect the avatars to need hand cleanup.** Diffusion models do not make
deliberate decisions at 28px, and at that size every pixel is one. The room and
window views survive the pipeline far better than characters do. The generator
also makes whole characters, not the separate, aligned layers that runtime
compositing needs, so avatar layer sets are hand work that uses generations as
reference.

**Shaders carry the motion.** Rain, water, fire flicker, god rays, fog, cloth
sway, CRT glow, parallax, candle gutter — all procedural, zero frames, and
exactly the ambient liveness the product needs. Nearly all motion in this scene
should be shader-driven regardless of who makes the art.

**Assets ship as versioned packs** — a directory plus a manifest, loaded by pack
id. Swapping generated art for commissioned human art is a data change, not a
code change. This is the same mechanism the commercial content packs will use.

### Adopted for v0.1: per-seat occupants and procedural motion

> Proposed 2026-11-01; adopted for v0.1 on 2026-11-02. The experimental
> reasoning is retained here; current implementation details are in
> [`frontend.md`](frontend.md#v01-art-integration).

**The problem.** Runtime layer compositing needs a separate layer per option,
each lining up with all the others and staying consistent across four poses at
2–4 frames each. A diffusion model makes none of that by default. Inpainting
each part onto a fixed base gets aligned layers for one pose. Nobody has shown
that a garment survives a change of pose, and drawn animation frames are
exactly what generation cannot keep consistent.

**The adopted approach, for v0.1:**

- **Occupants are drawn into their seat.** Generate the room empty, then
  inpaint a character into each seat of the empty room and keep only the
  pixels that changed. Scale, perspective and lighting come from the room,
  and an armrest in front of the sitter stays part of the room. Generating the
  room with people already in it does not work: seats fill and empty all
  night, and an empty seat must look empty.
- **A small catalogue of looks.** Each look is a fixed description ("red
  ponytail, rust hoodie") generated into every seat, so someone who changes
  seats stays recognisably themselves, if not pixel-identical. Seat movement
  stays free. Locking each person to one seat was considered; it is not
  needed.
- **The seat decides the pose.** Couch means sitting, hammock means lying.
  Each seat has an awake and an asleep sprite per look. The asleep one is made
  by inpainting only the head of the awake one, so the body and clothes cannot
  drift. Standing is dropped: changing seat is a hop or a fade.
- **No drawn frames: all motion is procedural.**
  - *Avatars:* a 1-pixel breathing bob of everything above a per-sprite
    breath line; a blink made by briefly swapping in the asleep sprite's eyes;
    when asleep, slower breathing and a drifting `z`.
  - *Environment:* the shaders above, plus **palette cycling**: rotating
    colours along a ramp inside a masked region animates fire, candle glow,
    water, TV static and blinking lights with no frames. It suits assets that
    are all indexed against one fixed palette.
  - Each seat gets a small foreground mask, drawn once and rendered after the
    occupants, so a breathing sitter never slides over the armrest.
- **Asset count is looks × seats × 2.** Six looks across four seats is 48
  sprites: minutes of GPU time, plus cleanup.

**What changed.**

- **Layer compositing becomes per-seat sprites for v0.1.** The argument
  against pre-baking was combinatorial (4,096 sprites per pose). It still
  holds for layered customisation, which moves with
  [#38](https://github.com/508-dev/coze-room/issues/38) to after v0.1, but it
  does not apply to a catalogue of a few dozen sprites.
- **The poses.** The *Scope* line's four poses at 2–4 frames each become
  seat-determined poses, awake and asleep, with procedural motion.
- **The rest:** [#54](https://github.com/508-dev/coze-room/issues/54)'s scope,
  and the "composite avatar layers at runtime" line in `AGENTS.md`.

**Tested 2026-11-02** ([`EXPERIMENTS.md`](../tools/art/EXPERIMENTS.md),
experiment 2):

- **Occupants inpaint into seats** at the right scale and in the room's
  light, but only with a person-shaped mask per seat, taken from a first good
  generation. With a rectangle, the room inside it is redrawn too and leaks
  into the layer.
- **Asleep sprites work about one seed in three.** A head drooping forward
  reads as asleep; closed eyes alone are too small to see. The body cannot
  drift.
- **One look stays recognisable across seats by colour**, not by detail.
- **Procedural motion is enough** to make the room feel inhabited: breathing,
  z's, rain on the glass, and palette-cycled lamp and CRT.

**Still unshown:**

- a breathing sitter behind a foreground armrest;
- blinking;
- two neighbours on one couch;
- hammock and beanbag seats. SDXL would not draw either furniture piece from
  the prompt alone.

## Distribution

Web → self-hosted F-Droid repo + GitHub Releases APK → Google Play →
f-droid.org inclusion once the build is boring.

f-droid.org builds from source on their own infrastructure, which for a
Capacitor app means the whole Node toolchain must build reproducibly there.
A self-hosted repo sidesteps it entirely, and the devkit's `fdroid-publish.sh`
already does exactly that, unchanged, for any APK.

**Zero third-party analytics. No SDK.** Every connection, session length, room
occupancy and queue action already passes through our own server. Deriving
metrics from our own logs earns no F-Droid anti-feature flag and means we never
have to write a sentence about third-party data sharing.

## v0.1

Web only. Ship this, put it in front of twenty people, and watch whether anyone
stays past the novelty.

| Item | Issue | State |
|---|---|---|
| One public room | — | done (skeleton) |
| Private rooms by code | [#31](https://github.com/508-dev/coze-room/issues/31) | |
| Two window views | [#55](https://github.com/508-dev/coze-room/issues/55) | |
| Demo users only — no accounts, no moderation | — | done by omission |
| Preset chat bubbles, no voice-over | [#60](https://github.com/508-dev/coze-room/issues/60) | |
| Seat-based occupants, awake/asleep, procedural motion | [#54](https://github.com/508-dev/coze-room/issues/54) | |
| Three seats: couch, beanbag, hammock | — | done (four, as data) |
| Five catalogue titles with timestamp sync | [#57](https://github.com/508-dev/coze-room/issues/57) | |
| Ambient audio bed | [#58](https://github.com/508-dev/coze-room/issues/58) | |
| Guestbook | [#56](https://github.com/508-dev/coze-room/issues/56) | protocol stubbed, nothing populates it |
| Drift-off mode | — | done (throttle + dim) |
| Blurred attract-mode start screen | [#59](https://github.com/508-dev/coze-room/issues/59) | |

Supporting work, all `v0.1-blocker`: the art pipeline
([#50](https://github.com/508-dev/coze-room/issues/50)–[#53](https://github.com/508-dev/coze-room/issues/53))
and hosting
([#61](https://github.com/508-dev/coze-room/issues/61)).

The riskiest assumption is not technical. It is **"a still room containing
sleeping strangers is pleasant to be in."** That is testable in weeks, before
the art budget, before accounts, before moderation.

The two things not to cut even from v0.1 are **drift-off mode** and the
**guestbook** — they are the only parts that are specifically about sleep.
Without them we have built a cosy room, which already exists twice.

Order after v0.1: accounts → moderation → phrase system with VO → Android.
Moderation must exist before strangers can talk to each other; the phrase system
is pointless before there is anyone to talk to.

## Competitive position

- **VRChat sleep rooms** are the behaviour at scale — one world has ~13.4M
  visits and ~156K favourites; Discord orgs "VRC Cuddles" (15,000+) and "SLEEP"
  (4,000+) run worlds nightly. Peer-reviewed in CHI '23. **The headset is the
  weakness** — the MIT reporter could not fall asleep in one, and OyasumiVR's own
  tagline ("Ever wanted to fall asleep in VR, but not stay in VR all night?") is
  an admission.
- **lofi.town** is the closest 2D product — shared pixel town, visible avatars,
  decoratable burrows, ambient audio, ~710K visits/month. Burrow TVs with
  YouTube links are **shipped**; whether playback is *synchronised* is
  unverified. Its monetization (Free / $2.99 / $9.99, cosmetics only,
  co-presence never paywalled) is the model we are copying. **Its mobile client
  is paused** — that is the opening.
- **Focustown** has web + Android, 500K+ Play downloads, no sleep mode but a
  user asking for one.
- **Nobody has shipped the sleep framing.** Xsleep (2022) died in three months.
  Four indie attempts shipped July–October 2026, all with 0–1 ratings.

**The live threat is not a sleep app. It is lofi.town or Focustown shipping a
night mode.**

## Known risks, named

1. **Distribution is unsolved.** Xsleep and MokuMoku Town both shipped working
   products and died of obscurity. Our category has almost no search volume
   because nobody knows to look for it. Accepted knowingly: build it first,
   figure out reach later.
2. **Moderation time, not server cost, is what kills social products.** Rec Room
   burned $294M at a $3.5B valuation and shut down June 2026 because "costs
   always ended up overwhelming the revenue."
3. **Rights clearance on 30 films is real work** and the manifest is the only
   defence if it is ever questioned.
4. **The empty-room first impression** is the highest-leverage screen in the
   product and the easiest to get wrong.
