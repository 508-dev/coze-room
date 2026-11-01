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
