# Dormouse v0 generated art

Temporary v0.1 art for **The Back Room**. A commissioned artist can replace the
whole directory later; the client should consume `art.json` rather than baking
in these coordinates.

## Files

- `room.png` — the empty room: two-seat couch at the left, beanbag, hammock at
  the right, CRT television, and two windows.
- `room-window-cutout.png` — the same room with every window-glass pixel fully
  transparent. Render a view behind this, not behind `room.png`.
- `window-glass-mask.png` — room-sized mask with opaque glass cells and a
  transparent background.
- `view-rain.png`, `view-clear-night.png` — room-sized outdoor views. Only the
  cells visible through the glass matter.
- `occupants/` — four looks (`ember`, `moss`, `plum`, `teal`) in each of four
  seats, awake and asleep: 32 transparent sprites.
- `contact-sheet.png` — every look with all four seats occupied, against both
  views. The four occupant silhouettes do not overlap.
- `art.json` — seat anchors, per-sprite breathing rows and head boxes, TV and
  window rectangles, exact glass rectangles, and the guestbook spot.

Every scene and occupant image is **128×72 true pixels**. All images, including
the contact-sheet atlas, are indexed to the 48-colour Atropoeia palette plus
one fully transparent entry. Occupant sprites deliberately use the full room
canvas, so they need no trimming offsets and composite at `(0, 0)`. Alpha is
only 0 or 255. Boxes in `art.json` use top-left `x`, `y` plus `width`, `height`;
`breathRow` is an absolute room-space y coordinate.

## How this pack was made

The room and views were generated at 2048×1152 with SDXL base 1.0 and
PixelArtRedmond Lite64, using the settings in `tools/art/PROMPTS.md`. The base
room is seed 2. Because the model initially substituted chairs and rugs for
the requested furniture, the beanbag, hammock, and CRT were separately
inpainted into fixed masks (seeds 2, 2, and 4) and composited into the room.
The exact shipped prompts, seeds, and workflow commit are in the asset log in
`tools/art/PROMPTS.md`.

Occupants follow `tools/art/EXPERIMENTS.md` experiment 2. Initial rectangular
inpaints established where the model placed a person in each seat. Those
placements became reusable stepped person-shaped masks. Each look was then
inpainted into every seat. The shipped asleep sprite is a head-only inpaint of
its shipped awake sprite, selecting results with a forward-drooping head
rather than relying on barely visible closed eyes. The hammock uses a lying
pose.

All generations were downsampled with `tools/art/quantize.py --cell 16`.
Occupant layers contain changed cells inside the relevant person mask;
isolated one-cell specks were removed. The window cut-out and mask were edited
on the true-pixel grid and re-snapped with `--cell 1`. No raw generations or
scratch scripts are included.

This is intentionally rough, generated placeholder art. Faces, hands, and some
cloth/background boundaries would benefit from human pixel cleanup, but the
seats, colour identities, lying pose, and asleep head poses are readable at
room scale.
