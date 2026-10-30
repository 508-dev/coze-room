# Dormouse

A shared pixel-art room you fall asleep in.

Up to twelve people sit or lie down in the same small room. A TV plays
public-domain films from a shared queue. Rain falls outside the window. Nobody
has to say anything, and after ten minutes of stillness your avatar quietly
falls asleep.

It is for people who sleep better when there are others nearby.

> **Status: planning complete, implementation not started.**
> See [`docs/design.md`](docs/design.md) for the plan of record and
> [`docs/backlog.md`](docs/backlog.md) for what is scheduled after v0.1.

## Why

The behaviour already exists: people sleep together in VRChat worlds nightly,
one of which has over 13 million visits. But a headset is the worst possible
object to wear while falling asleep. Meanwhile the cosy-room products that run
in a browser are all framed around *focus and productivity* — Pomodoro timers
and task lists — which is the opposite of winding down.

Nobody has shipped the sleep framing in a form you can leave running on a phone
at your bedside. That is the whole idea.

## Design principles

**Stillness is the aesthetic.** The room is designed to be beautiful when
nobody is doing anything. Within twenty minutes of filling up, everyone in a
room is unconscious — designing for conversation would produce an empty room.

**Audio is the product; the room is the on-ramp.** The visuals get about ten
minutes of attention. After that the renderer throttles, the screen dims, and
the audio keeps going.

**Capability, not presence, is gated.** Anyone can come in and lie down,
including without an account. Chatting, queueing media and changing the weather
unlock with account tenure.

## Stack

PixiJS v8 (WebGL2, GLSL) · Svelte 5 · Capacitor for Android · a single
WebSocket server with room state in memory · Postgres · media on Cloudflare R2.

Web is the primary platform. Android follows. There is no iOS client.

## Getting started

```sh
bun install
cp .env.example .env
bun run dev          # starts Postgres in Docker, then the client and server
```

Useful scripts:

| Command | What it does |
|---|---|
| `bun run dev` | Compose infra, then client + server on the host |
| `bun run check` | lint, typecheck, test, build |
| `bun run ports` | show this worktree's deterministic port assignment |

Parallel worktrees get non-colliding ports automatically, hashed from the
worktree path. See [`docs/development.md`](docs/development.md).

## Licence

Open core. The client is **GPL-3.0**, the server is **AGPL-3.0**, and the
commercial surface is art and audio packs rather than the program. See
[`COPYRIGHT.md`](COPYRIGHT.md).

Built on the [508 devkit](https://github.com/508-dev/508-devkit). The
adaptation is recorded in [`docs/selection-report.md`](docs/selection-report.md).
