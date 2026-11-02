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

`RoomCanvas.svelte` passes room/occupant snapshots into `Scene` and receives
typed `RoomEvents` (currently `seatClick`) back. Neither side reaches into
the other's internals. This matters because the canvas has to survive being
throttled to near-zero frame rate in drift-off mode while the DOM stays live
and interactive.

## Environment variables

Vite exposes only `VITE_`-prefixed variables to client code. The server-side
neutral names map as follows:

| Neutral name | Client-visible name |
|---|---|
| `WEB_API_BASE_URL` | `VITE_API_BASE_URL` |
| `R2_PUBLIC_BASE_URL` | `VITE_MEDIA_BASE_URL` |
| Pack base (already public) | `VITE_PACK_BASE_URL` (default `/packs`) |

Never expose anything from `.env` that is not explicitly intended to be public.
The R2 credentials in particular are server-only.
Vite reads the repository-root `.env`; only `VITE_` values reach the browser.
When starting Vite directly, export `VITE_API_BASE_URL` explicitly (see
[`development.md`](development.md)); the neutral names are not auto-mapped by Vite.

## How to add a client feature

1. **State and messages:** create `src/features/<feature>.svelte.ts` with a class
   owning its `$state` fields and a `register: ClientFeature` method. Subscribe
   with `connection.on("messageTag", message => { ... })` and return cleanup
   (all subscriptions return an unsubscribe function). Several features can
   subscribe to `welcome`; there is no central switch. See `GuestbookFeature`.
   Add `feature: new Feature()` to `createClientFeatures()` in
   `src/features/registry.ts`. Consumers use `state.features.feature`.
2. **Canvas:** create `src/room/layers/<feature>.ts`, returning a `SceneLayer`.
   Add its factory to `src/room/layers/registry.ts`. `attach` receives a slot
   container, the shared `events` bus and `toRoomPoint(event.global)`. Put objects in
   logical room coordinates; Pixi hit testing already inverts the root transform.
   `onRoomChange(room, pack)` runs once for placeholders, then again after a pack
   resolves; it must replace old objects safely. `onOccupantsChange` receives a
   full snapshot. Optional `update(dt, now)` uses **seconds** for dt and
   `performance.now()` milliseconds for now, including at 5fps in drift-off.
   `destroy` releases subscriptions/resources; Scene then destroys slot children.
   Do not destroy shared Pixi textures. See the seats and avatars layers.
3. **DOM:** add a Svelte component to `src/components/feature-panels.ts` for room
   chrome. It receives `{ state: RoomState }`. `App.svelte` need not change.
   `StartScreen.svelte` is the auto-join placeholder for room selection/attract mode.
4. **Wire/server:** follow the corresponding checklist in `development.md`.

For feature-specific canvas/DOM events, extend `SceneEvents` in `room/events.ts`
by declaration merging from your own module. Client handlers use `state.events`,
layers use `context.events`: `on(tag, handler)` returns cleanup and `emit(tag,
payload)` is typed. A phrase handler can emit a bubble event; a guestbook layer
can emit an open-book event. Unsubscribe in feature cleanup / layer `destroy`.
Neither needs to edit `Scene`, `RoomCanvas` or `App` to relay new event types.

Slots render in this fixed order: `background`, `windowView`, `furnitureBack`,
`avatars`, `furnitureFront`, `bubbles`, `overlay`. Use `furnitureBack` for the
room painting with transparent window cut-outs, **not** `background`: views
must be behind those cut-outs. Foreground armrests/occluders use `furnitureFront`.
Within a slot, layers are attached in registry order; own containers can sort
children by depth. No shaders or environmental effects are implemented yet.

## Room space and packs

`RoomSpec.packId` selects `/packs/<packId>/manifest.json` (or the public base
in `VITE_PACK_BASE_URL`). No selection uses a 640×360 placeholder. Dimensions
come from the pack otherwise. The room is centred and letterboxed, with the
largest **integer** scale that fits when at least 1x fits. Smaller viewports use
a fractional fit so portrait phones keep the whole room visible, without cropping.
Rendering uses device resolution capped at 2x with auto-density; pointer events
remain in CSS pixels and textures remain nearest-sampled.
Seat coordinates and placeholder shapes are unchanged, including the beanbag
extending below y=360 and the standing marker at y=380; there is no room-edge mask.

Manifest v1 (`src/room/packs/manifest.ts`):

```json
{
  "id": "room-v1",
  "version": 1,
  "room": {
    "size": [640, 360],
    "background": "room.png",
    "windowViews": { "rain": "views/rain.png" }
  },
  "sections": {}
}
```

`version` identifies the schema; version changed content with a new pack id.
Sizes are positive integer pixels. Views and sections are optional. File paths
must be pack-relative, without `..`, absolute URLs, query strings or escapes.
The loader validates the core manifest and loads its textures via Pixi `Assets`,
with nearest-neighbour sampling. Missing/invalid manifests or required textures
warn and retain placeholder rendering, never clear the screen. Views are loaded
but selecting/rendering an environment belongs to its future layer.

**Adding a manifest section:** declare its type in the owning feature's module:

```ts
declare module "../room/packs/manifest" {
  interface PackSections {
    example?: { file: string };
  }
}
```

Store its data under `sections.example`. Core validation only verifies that
`sections` is an object; the feature **must validate its own data and relative
file paths** before use, and fall back if absent/invalid. Use `pack.baseUrl` to
load feature assets; set texture sampling to `nearest`. Do not hotlink.

Vite serves the repo-root `packs/` as `/packs` and `bun run build` includes it
in `apps/client/dist/packs/`, except the root `packs/README.md`. Everything there
is public. PNG/OGG are Git LFS;
keep provenance and commercial-use licence evidence for real assets. The
`test-fixture` pack is only an original two-colour technical swatch.

## Performance posture

The room is static most of the time. Budget the GPU for the first ten minutes
of a session, because that is the entire window in which anyone is looking at
it. After that, drift-off mode throttles the renderer hard and the only thing
that must keep running is audio and the network connection.
