# Art experiments

Things tried that are not part of the pipeline. Record what was tried, what
worked and what did not, so the next person starts from evidence instead of
repeating it.

## 1. Aligned avatar layers by inpainting onto a fixed base

2026-10-31. **Question:** can the generator make avatar layers that line up,
so the runtime compositing in [`docs/design.md`](../../docs/design.md#art)
works with generated art?

**Answer: yes, for one pose.** Four hair/hat options and three tops, made
against one base, combined into 20 aligned avatars with no hand alignment.
Whether it holds across the four poses is untested, and that decides whether
it scales.

### The problem it solves

Runtime compositing needs every hair option to fit the *same* head on the
*same* body. Generating whole characters and cutting them up gives each part
its own head and body, so nothing lines up. Instead: keep one base fixed and
generate each part *onto* it.

### Method

1. **Base.** A bald mannequin at 768×768 (48×48 true pixels). Prompt, after
   `Pixel Art, PixArFK,`: `single character sprite, bald person sitting
   cross-legged, plain grey t-shirt, grey trousers, bare feet, full body,
   front view, plain white background, game sprite`. Negative: the standard
   one plus `hair, hat`. Seeds 1–6 were tried; seed 3 was chosen as front-on,
   symmetric and without props (seed 5 sat in an armchair).
2. **Key the backdrop.** Quantize the base, flood-fill the backdrop from the
   image edge (cells that snapped to `a1b9a7` or `b9b59b`), and paint those
   16×16 blocks pure magenta `#FF00FF` in the full-size base.
3. **Masks**, on the 48×48 grid (rows × columns, inclusive; multiply by 16
   for pixels):
   - hair: rows 0–8 × cols 15–32, plus rows 9–16 × cols 15–19 and 28–32.
     This covers the crown and the sides of the head and leaves the face
     alone.
   - top: rows 14–30 × cols 12–35, plus row 13 × cols 12–19 and 28–35.
4. **Inpaint** with the same checkpoint, LoRA and sampler settings as
   [`workflow.json`](workflow.json):
   `LoadImage` (keyed base) → `VAEEncodeForInpaint` (mask, `grow_mask_by` 0)
   → `KSampler` (denoise 1.0) → `VAEDecode` → `ImageCompositeMasked`
   (destination the base, source the decoded image, same mask) →
   `SaveImage`. The final composite guarantees every pixel outside the mask
   is exactly the base.
5. **Prompt the whole character, not just the part**, and name the magenta:
   `single character sprite, person with <hair>, sitting cross-legged,
   wearing <top>, grey trousers, bare feet, full body, front view, plain
   magenta background, game sprite`.
6. **Extract the layer.** In both the base and the result, make every pixel
   within RGB distance 140 of magenta transparent, then run them through
   `quantize.py`. The layer is every cell inside the slot's mask whose
   palette index differs from the base's and is not transparent.
7. **Composite** in a fixed order: base, then tops, then hair.

### Results

- 14 generations (7 options × 2 seeds), about 3 seconds each.
- Clean on the best seed: short curly hair, a ponytail falling over one
  shoulder, a blonde bob, a rust hoodie, an olive jacket over a white shirt.
- Weak: "teal and cream striped sweater" lost its stripes on one seed; one
  beanie came out as little more than a head outline.
- Every combination of the best seed of each looked like a single coherent
  generation rather than a collage.

### Lessons

- **`VAEEncodeForInpaint` beats `SetLatentNoiseMask`.** In a side-by-side on
  six options, `SetLatentNoiseMask` half-kept the bald head.
- **The magenta key is essential.** Without it each inpaint invents its own
  grey or beige backdrop, which snaps to a different palette colour and leaks
  into the layer as junk. It also cannot tell white or blonde hair from a
  light backdrop.
- **Base plus layer equals the generated image exactly**, by construction.
- **The face lives on the base.** Fix it by hand once and every combination
  gets the fixed face. This is the biggest saving in cleanup.
- **Overlapping slots work with a fixed stacking order.** The ponytail
  overlaps the top's mask and drapes correctly over the hoodie because hair
  is stacked above tops.
- **Plan on 2–4 seeds per option.** Prompt adherence is uneven.

### Limits and open questions

- **Poses (the decisive one).** Each pose needs its own base. The same prompt
  on a standing base will not produce the same garment as on the sitting
  base, so "the same hoodie" may not look the same across poses.
- **Long hair** needs a mask reaching the shoulders. **Hair behind the body**
  needs a separate layer under the base. Neither was tried.
- **Skin tones** should be palette swaps of the base's skin colours, not
  generations. Atropoeia has no peach tones: the base's skin snapped to pale
  yellows.
- Faces are noise until hand-fixed, as everywhere else.

## 2. Occupants inpainted into the seats of an empty room

2026-11-02. Tests the three unproven parts of the per-seat occupant proposal in
[`docs/design.md`](../../docs/design.md#proposed-not-agreed-per-seat-occupants-and-procedural-motion).

**Answers:**

1. **Can a character be inpainted into a seat of a generated room?** Yes,
   with a **person-shaped mask** per seat. Rectangular masks fail.
2. **Does head-only inpainting give an asleep sprite?** Partly. A head
   drooping forward reads as asleep; closed eyes alone do not, at this size.
   About one seed in three.
3. **Does one look stay recognisable across seats?** By colour, not by
   detail.

A procedural-motion preview on the result reads as a living room (see
[Motion preview](#motion-preview)).

### Method

1. **Empty room** at 2048×1152, which is 128×72 true pixels. After
   `Pixel Art, PixArFK,`: `cosy dim living room at night, empty old couch,
   empty beanbag, empty hammock by a large window, crt television glowing,
   warm lamp light, nobody, game background`. Negative: the standard one plus
   `people, person, character`. All four seeds came out empty. **None drew a
   hammock or a beanbag.** Seed 4 was chosen: a couch with two seats, big
   night windows, a CRT and a rug.
2. **Seats:** couch-left, couch-right, and the floor (on the rug).
3. **Looks:** `a person with a red ponytail wearing a rust hoodie` and `a
   person with short curly brown hair wearing an olive green jacket`, each in
   every seat, seeds 1 and 2.
4. **Prompt:** the room plus the look:
   `cosy dim living room at night, <look> <sitting on the old couch | sitting
   cross-legged on the rug>, crt television glowing, warm lamp light, game
   background`.
5. **Inpaint** as in experiment 1 (`VAEEncodeForInpaint`, `grow_mask_by` 0,
   denoise 1.0, composited back inside the mask) on the full-size room.
6. **Layer:** cells inside the mask whose palette index differs from the
   empty room's.

### What happened

- **Rectangular seat masks give dirty layers.** A person appeared in 10 of
  12 runs (one drew two people), at the right scale: seated figures were
  about 30 rows tall, which matches the ~28px avatar target, and they took on
  the room's lighting. But the inpaint redraws *everything* in the rectangle,
  window frames and couch texture included, so the layer is speckled with
  background. Neither of the obvious fixes worked:
  - **A threshold on colour change.** A rust hoodie on a rust couch is
    camouflage. Any threshold that keeps the hoodie also keeps the redrawn
    window.
  - **Keeping only the largest connected blob.** It has the same problem.
- **Person-shaped masks work.** Each seat gets a stepped
  head/torso/legs silhouette. The model fills the silhouette with a person
  and redraws nothing outside it, so every look in a seat gets the same
  framing. 11 of 12 runs drew a person (the miss drew an ottoman). Junk is
  left only at the silhouette's edges, a strip of window beside the head or
  rug speckle at the feet: about a minute with the eraser per sprite.
- **Take each silhouette from where the model puts a sitter, not from a
  guess.** The first couch silhouette put the head 7 rows too high. The model
  drew the head lower anyway, and the gap filled with redrawn window. Make
  the silhouette from a first good generation, then reuse it for every look.
- **Asleep, by inpainting only the head.** On the couch this was rows 28–38 ×
  cols 35–45, with `asleep, eyes closed, head tilted to one side, sleeping`
  added to the prompt. The body cannot change. What reads as asleep is **the
  head drooping forward with hair over the face**, which came out on one of
  three seeds on each sitter. Closing the eyes is a 1–2 pixel change that
  barely registers at this size. Hand-draw closed eyes where wanted.
- **Across seats.** "Curly brown hair, olive jacket" reads as the same person
  on both couch seats and on the floor: same hair colour, same jacket colour.
  The hair shape and jacket details vary. Identity comes from colour, so
  write each look as a strong colour description.
- **SDXL ignores furniture it finds unusual.** No hammock, no beanbag, in any
  room. The furniture will need to be put in on purpose, for example by
  inpainting it into the empty room, not just named in the prompt.

### Motion preview

The empty room with the awake couch sitter and the asleep floor sitter,
animated in about 60 lines of code against the indexed sprites, with no drawn
frames:

- **Breathing:** everything above a per-sprite breath line drops 1 pixel and
  comes back, on a 2-second cycle awake and 4 seconds asleep.
- **z's:** a 4×4 glyph in the palette's lightest colour rises from the
  sleeper's head.
- **Rain:** 3-cell streaks in a muted teal falling down-left, drawn only on
  cells of dark window glass.
- **Lamp flicker and CRT shimmer:** palette cycling. Lamp cells step down
  their yellow ramp at random; the CRT alternates along its teal ramp.

It reads as a living room with people in it. The client would do the same
per frame or in a shader.

### Still open

- **Foreground occluders.** Neither sitter overlapped an armrest, so a
  breathing sitter sliding over furniture was not exercised.
- **Blinking** was not tried.
- **Two neighbours on one couch:** the two couch seats were never shown
  occupied at once.
- **Hammock and beanbag seats:** these need the furniture first.

## Tools evaluated, not adopted

Checked 2026-10-31. Licences verified against the Hugging Face API and the
projects' own pages.

### SpriteLoom

<https://github.com/vkarach/spriteloom>. An Aseprite plugin plus a local
Python server running FLUX.2 Klein 4B on your own GPU. It can generate, edit,
inpaint a selection, and redraw a subject from another angle. Results are
inserted as a new layer without touching existing pixels, and can be pinned
to the open sprite's palette.

- **Licences:** the tool is Apache-2.0, and FLUX.2 Klein **4B** is Apache-2.0.
  **FLUX.2 Klein 9B is under a non-commercial licence; never use it.** The
  text encoder's licence is not stated.
- **Not adopted:**
  - It is **Windows-only**, with `.bat` installers and Windows job objects.
  - It needs **Aseprite 1.3+**, not LibreSprite.
  - It is young: 8 stars and no releases at the time.
  - The README does not say how output is scaled to the sprite.
- **Worth taking from it:** inpainting a selection onto a fixed sprite as a
  new layer is the idea behind experiment 1, which needs nothing new.

### Qwen-Image-Layered

<https://huggingface.co/Qwen/Qwen-Image-Layered>. Splits one image into a
configurable number of RGBA layers, filling in what each layer hid. Any layer
can be split again.

- **Licences:** all Apache-2.0: the Qwen model, Comfy-Org's repackaged
  weights, and the Qwen2.5-VL-7B text encoder. ComfyUI's template downloads
  the text encoder from a repo named after HunyuanVideo, whose own licence has
  territorial limits. Take the identical file from the Qwen-Image repackaged
  repo instead, and check its hash.
- **Runs on ComfyUI 0.43**, which ships the nodes and a template. The bf16
  model is 40.9 GB, too big for a 32 GB card. The fp8 version is 20.5 GB,
  plus a 9.4 GB text encoder and a 0.3 GB VAE: about 30 GB in all.
  Recommended resolution 640; the template uses 20 steps at CFG 2.5.
- **Not adopted, and not tried.** It slices one image, but it cannot make
  parts that align across options, which is the avatar problem. It is built
  for posters and photos, and its redrawn layers may not stay on the 16-pixel
  grid. **Where it might help is the room:** splitting a generated room into
  background, furniture and foreground layers, so a seated avatar can sit
  behind a couch arm.
