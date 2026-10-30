# Frontend

## Stack

- **PixiJS v8** (MIT) for the room — 2D sprites plus custom fragment shaders.
- **WebGL2** as the rendering baseline. WebGPU is progressive enhancement only:
  adapter success is around 75% on Android, which is our second platform.
- **GLSL** for shaders. Do not plan on one shader source serving both GLSL and
  WGSL; if WebGPU support is added later it gets its own shader set.
- **Svelte 5** for UI chrome — chat log, queue, settings, moderation.

## The canvas/DOM boundary

Keep them strictly separated. The Pixi canvas owns the room: avatars, seats,
the TV surface, weather, lighting. Svelte owns everything with text in it.

They communicate through a small typed event bus, not by reaching into each
other's internals. This matters because the canvas has to survive being
throttled to near-zero frame rate in drift-off mode while the DOM stays live
and interactive.

## Environment variables

Vite exposes only `VITE_`-prefixed variables to client code. The server-side
neutral names map as follows:

| Neutral name | Client-visible name |
|---|---|
| `WEB_API_BASE_URL` | `VITE_API_BASE_URL` |
| `R2_PUBLIC_BASE_URL` | `VITE_MEDIA_BASE_URL` |

Never expose anything from `.env` that is not explicitly intended to be public.
The R2 credentials in particular are server-only.

## Performance posture

The room is static most of the time. Budget the GPU for the first ten minutes
of a session, because that is the entire window in which anyone is looking at
it. After that, drift-off mode throttles the renderer hard and the only thing
that must keep running is audio and the network connection.
