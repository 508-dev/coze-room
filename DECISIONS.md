# Decisions

Decision authority for Dormouse. Each entry is a decision, why it exists, and
when to deviate. Reasoning lives in [`docs/design.md`](docs/design.md); this is
the short form an agent or contributor can scan.

Supersede an entry by editing it and saying what changed.

## 1. Design for 100 concurrent users

**Decision:** 100 concurrent is a stated ceiling, not an aspiration. One VPS,
one process, room state in memory, no horizontal scaling.

**Why:** Outgrowing it and rewriting the server is cheaper than pre-building for
scale we do not have. Rec Room raised $294M and died because costs outran
revenue.

**Deviate when:** we actually approach the ceiling. The path is known — move
room state to Redis, run N processes, route by room id.

## 2. Stillness is the aesthetic

**Decision:** the room must be beautiful when nobody is doing anything. Ambient
motion and an overnight guestbook carry liveness, not conversation.

**Why:** within ~20 minutes of a room filling, everyone in it is asleep.
Designing for a chatty room produces a chatty room, and it will be empty.

**Deviate when:** never, for the default room. A louder "awake" room type is a
separate product decision.

## 3. No YouTube

**Decision:** media is mirrored public-domain video served from R2.

**Why:** YouTube's Developer Policies conflict on at least four clauses —
background/screen-off audio (III.I.9), overlays on the player (RMF),
server-automated playback (III.I.2), and charging for a tier containing the
player (III.F.3.a). There is no co-watching API to apply to.

**Deviate when:** YouTube ships a sanctioned co-watching API. Not before.

## 4. No TTS engine

**Decision:** chat is a fixed palette of preset phrases with recorded
voice-over. Free text is visible and never spoken.

**Why:** it structurally eliminates the SSML-injection attack class, the
voice-licence minefield, and the EU AI Act Article 50 question. Platforms
punish the *absent room owner* for what third parties make a room say.

**Deviate when:** arbitrary TTS becomes a premium feature with per-listener
opt-in and an existing trust relationship. Revisit the injection surface first.

## 5. Seat-based movement

**Decision:** avatars do not walk. You tap a seat and transition there.

**Why:** directional walk cycles are the most expensive animation in the project
and the one category we cannot generate. Seat-based also makes netcode trivial.

**Deviate when:** there is an art budget and someone asks for it. It is on the
backlog, deliberately.

## 6. Gate capability, not presence

**Decision:** anyone can enter and lie down, including without an account.
Chatting, queueing and changing the environment unlock with account tenure.

**Why:** signup friction does not stop abuse; capability gating does. This is
VRChat's trust-level pattern, which demonstrably works.

**Deviate when:** a specific abuse pattern proves presence itself is the vector.

## 7. Privacy-preserving accounts

**Decision:** username and password, no email required. One-time recovery code
at signup. Optional email later, for recovery only.

**Why:** email is near-worthless as anti-spam (throwaways are free) and its only
real value is recovery, which the code provides without collecting anything.

**Deviate when:** never collect an email for a purpose the user did not choose.

## 8. No third-party analytics

**Decision:** no analytics SDK of any kind. Metrics derive from our own server
logs.

**Why:** we run the server, so every connection already passes through it. This
avoids F-Droid's `Tracking` anti-feature and keeps the privacy policy short.

**Deviate when:** never, for client-side telemetry.

## 9. Open core

**Decision:** GPL-3.0 client, AGPL-3.0 server, commercial art and audio packs.

**Why:** code is free; the commercial surface is content. Licensed shows are
permanently out of scope — they require DRM, which is incompatible with
everything else here.

**Deviate when:** never without re-reading `COPYRIGHT.md` and the licence
constraints on bundled assets.

## 10. Honest safety claims

**Decision:** describe moderation exactly as implemented, and no more.

**Why:** the actionable legal risk for a small app is overclaiming, not failing
to stop all harm. NGL was fined $5M over a false AI-moderation claim.

**Deviate when:** never.
