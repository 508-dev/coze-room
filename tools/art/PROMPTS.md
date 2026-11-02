# Prompts, models, and settings

What we generate with and how. The runbook for setting it up is
[`README.md`](README.md).

## Models

This project sells art packs, so a model's licence matters as much as its
output. A non-commercial or no-derivatives licence anywhere in the chain
poisons the commercial tier. The rule: **if the terms are unclear, do not use
it.** Licences were checked on 2026-10-30 against the sources linked below.

| Role | File | Licence | Source (pinned) | sha256 |
|---|---|---|---|---|
| Checkpoint | `sd_xl_base_1.0.safetensors` | CreativeML Open RAIL++-M | [stabilityai/stable-diffusion-xl-base-1.0 @ `4621659`](https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/tree/462165984030d82259a11f4367a4eed129e94a7b) | `31e35c80…893f7e5b` |
| LoRA | `PixelArtRedmond-Lite64.safetensors` | CreativeML OpenRAIL-M; Civitai: commercial image use allowed | [artificialguybr/PixelArtRedmond @ `33cbdd1`](https://huggingface.co/artificialguybr/PixelArtRedmond/tree/33cbdd147b152f816b0b3ac2ba250848fef83576) | `84e915e2…fec2252ab7` |

Full hashes are in [`models.sha256`](models.sha256).

### SDXL base 1.0

- **Licence:** CreativeML Open RAIL++-M, dated 26 July 2023
  ([LICENSE.md](https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/blob/main/LICENSE.md)).
  The repo is not gated.
- **Outputs are ours to sell.** The licence says: "Licensor claims no rights in
  the Output You generate using the Model." There is no non-commercial clause.
- **Use restrictions** (Attachment A) bind the outputs: nothing unlawful,
  nothing that harms minors, no disinformation, harassment, or exploitation of
  vulnerable groups, and so on. None of it touches cosy pixel-art rooms.
- **Do not be misled by the model card.** Its "Direct Use" section says "The
  model is intended for research purposes only." That is descriptive text on
  the card, not a licence term; LICENSE.md has no research-only restriction.
- **Why SDXL:** its pixel-art LoRA ecosystem is by far the richest of the
  commercially licensed models. The fallback is FLUX.1-schnell (Apache-2.0).
  **FLUX.1-dev is non-commercial. Never use it.**

### PixelArtRedmond (Lite64), by artificialguybr

- **Licence on Hugging Face:** `creativeml-openrail-m` in the model card
  metadata. There is no LICENSE file and no contradicting text in the card;
  every README revision from 2023-09-13 to 2026-07-20 was checked.
- **Licence on Civitai:** the author's own listing of the **byte-identical
  file** ([model 144684](https://civitai.com/models/144684), version 160844,
  matched by sha256) sets `allowCommercialUse: ["Image","RentCivit","Rent"]`
  and `allowNoCredit: true`. In Civitai's UI that reads as "Sell images they
  generate: yes" and "No credit required". Selling the LoRA itself or merges
  of it is not allowed; we do neither.
- The two sources agree. That agreement is the reason it was chosen.
- **Trigger words:** `Pixel Art, PixArFK`.
- **Caveats:** the metadata names the SD 1.x licence (OpenRAIL-M) rather than
  SDXL's RAIL++-M; both permit commercial outputs, and the outputs are bound by
  SDXL's Attachment A regardless. The training data is undisclosed beyond
  "fine-tuned on a large dataset", which is true of every LoRA we looked at.

### Rejected, and why

Record anything rejected here, so nobody re-litigates it.

- **[Pixel Art XL](https://huggingface.co/nerijs/pixel-art-xl)** (nerijs) —
  the best-known SDXL pixel-art LoRA. Hugging Face says OpenRAIL-M, but the
  same author's [Civitai listing](https://civitai.com/models/120096) of the
  byte-identical file sets commercial use to **none**, requires credit, and
  forbids merges. The terms conflict, so it is out.
- **[ntc-ai/SDXL-LoRA-slider.pixel-art](https://huggingface.co/ntc-ai/SDXL-LoRA-slider.pixel-art)**
  — MIT on its face, but the author says it was trained on a community merge
  built on SDXL Turbo plus unnamed models. SDXL Turbo's licence is Stability's
  revenue-capped community licence. The lineage is unclear, so it is out.
- **[lizozom/pixel-icon-lora-sdxl](https://huggingface.co/lizozom/pixel-icon-lora-sdxl)**
  — Apache-2.0 on its face, but the card says its training data "is derived
  from a third party's artwork", with no stated permission. Out.
- **[strkyyy/pixel-art-16bit](https://huggingface.co/strkyyy/pixel-art-16bit)**
  — licence is clean (RAIL++-M, with Civitai flags allowing everything), but it
  was bulk-uploaded alongside 20 other style LoRAs, including a "ghibli" one,
  with no stated provenance. Held in reserve as a fallback only; re-check
  before using.
- **FLUX.1-dev** — non-commercial licence.

## Sizes

**PixelArtRedmond draws one fake pixel per 16×16 block, anchored at the
top-left corner.** So:

- generate at multiples of 16 in both directions;
- the true size of the sprite is the generation size ÷ 16;
- `quantize.py`'s default `--cell 16` is correct.

| Use | Generate at | True pixels | Notes |
|---|---|---|---|
| Avatar (seated) | 768×768 | 48×48 | figure about 28–30 px tall, consistently across seeds |
| Prop, square scene, window view | 1024×1024 | 64×64 | |
| Wide scene | 1344×768 | 84×48 | |
| Large scene | 1536×1536 | 96×96 | still coherent |
| Largest tested | 2048×1152 | 128×72 | still coherent; nothing larger tried |

How we know: on 2026-10-31 we measured the block size of all 24 test
generations by autocorrelating the colour change between neighbouring pixels.
46 of the 48 measurements (24 images × 2 axes) came out exactly 16. The
other two came out 32, which is still on the 16 grid (every other boundary was
faint), and both were 640×640 images, below the sizes recommended here. The
grid started at the top-left corner in all 24.

The block size did **not** change with:

- **image size:** every size from 640 to 2048 tested;
- **LoRA strength:** 0.5 to 1.25 tested. Strength changes only how crisp the
  blocks are: grid correlation was about 0.57 at 0.5 and about 0.85 at 1.0;
- **prompt words:** "8-bit", "16-bit, detailed", "tiny 32x32 icon" changed
  the composition, not the block size. Don't use them to control size.

Below 768 SDXL itself degrades. Odder still, at 640×640 the model frames a
character *larger* in the canvas (about 36 of 40 rows), so a smaller
generation does not give a smaller figure. 768×768 is the avatar size.

## Prompt structure

```text
Pixel Art, PixArFK, <subject>, <details>, <light and mood>, <framing>
```

- **`Pixel Art, PixArFK,` always comes first.** These are the LoRA's trigger
  words.
- **Subject before details.** SDXL tends to weight early words more.
- **End with a framing phrase:**
  - scenes and window views: `game background`
  - characters and props: `single character sprite, full body, plain white
    background, game sprite` (substitute the prop for "character"). The
    backdrop comes out grey or beige rather than white, which is fine: it is
    removed during cleanup.
- **Keep the style words identical across a set** of assets that must sit
  together. Change only the subject.
- **Prefer colours the palette has.** Atropoeia is muted greens, browns,
  teals and dusky pinks, with almost no saturated blue, purple or red.
  Anything outside it shifts when quantized. This follows from the palette;
  it has not been measured.

Negative prompt, always:

```text
3d render, realistic, photo, blurry, text, watermark, signature
```

Prompts that produced usable output:

| Asset kind | Prompt (after `Pixel Art, PixArFK,`) | Size | Seeds |
|---|---|---|---|
| Room | `cosy dim living room at night, old couch, beanbag, hammock by a large window, crt television glowing, warm lamp light, game background` | 1024×1024, 1344×768, 2048×1152 | 1 |
| Window view | `rainy pine forest at night, distant mountains, moonlight, game background` | 1024×1024 | 1 |
| Avatar | `single character sprite, person sitting cross-legged, full body, plain white background, game sprite` | 768×768 | 1–4 |

The room prompt at 1024×1024 with seed 1 is the committed workflow's default,
and the smoke test in the README.

## Seeds

The seed fixes the starting noise. **Same seed, prompt, settings, GPU model
and software versions: the same image, bit for bit.** We checked this: a
rerun matched the original pixel for pixel. On other hardware you get a
similar image, not the same one.

- **Leave the seed on `fixed`.** The workflow ships that way. With
  `randomize`, every click changes two things at once.
- **Explore by changing the seed by hand**: 1, 2, 3, 4. Small integers are
  easy to write down.
- **Change one thing at a time.** Hold the seed fixed while tuning a setting.
  When comparing two prompts, run both on the same seeds (1–4).
- **Batch size above 1 is for browsing only.** An image from the middle of a
  batch can be reproduced only by rerunning the whole batch.
- **Log every generation that becomes an asset** in the [asset log](#asset-log)
  below. The PNG also embeds its full graph and seed, but raw generations are
  not committed.

## Settings

| Setting | Value |
|---|---|
| Sampler | `dpmpp_2m` |
| Scheduler | `karras` |
| Steps | 30 |
| CFG | 7.0 |
| Denoise | 1.0 |
| LoRA strength (model and CLIP) | 1.0 |
| VAE | the checkpoint's own |
| Refiner | none |

Only LoRA strength has been swept (0.5, 0.75, 1.0, 1.25). Below about 0.75 the
block grid gets soft, which makes the downsample less faithful; 1.25 is
chunkier and not better. The sampler settings are SDXL's common defaults; they
gave usable output on the first try, so they have not been tuned. The base
VAE showed no artefacts, so there is no separate VAE. If you tune any of
this, record what you tried here, including what did not help.

On the RTX 5090, a 1024×1024 image takes about 3 seconds.

## Asset log

One row for every generation that becomes a shipped asset, so it can be
regenerated if the palette or the pipeline ever changes. "Workflow" is the
git commit of `workflow.json` used.

| Asset | Prompt (after `Pixel Art, PixArFK,`) | Size | Seed | Workflow | Notes |
|---|---|---|---|---|---|
| `room.png base` | cosy dim living room at night, one empty old two-seat couch, one large rectangular window with dark night outside, crt television glowing, warm lamp light, open empty floor space, blank wall space, nobody, game background | 2048×1152 | 2 | `a33d632` | Text-to-image |
| `room.png beanbag` | cosy dim living room at night, one empty low round olive green beanbag, a shapeless sagging soft fabric floor cushion with no backrest and no arms and no legs, empty old couch, large window, crt television glowing, warm lamp light, nobody, game background | 2048×1152 | 2 | `a33d632` | Inpaint; composited over base |
| `room.png hammock` | a wide empty cream cloth hammock hanging between two wooden posts at the right under the window, a curved sagging horizontal fabric bed suspended by ropes in a cosy dim living room, empty old two-seat couch at the left, crt television glowing above the hammock, warm lamp light, nobody, game background | 2048×1152 | 2 | `a33d632` | Inpaint at right; composited with beanbag and CRT |
| `room.png CRT` | cosy dim living room at night, a large old boxy crt television with a glowing dark teal screen on a wooden cabinet at the right, empty old couch, large window, empty beanbag, empty hammock, warm lamp light, nobody, game background | 2048×1152 | 4 | `a33d632` | Inpaint; final room |
| `view-rain.png` | overcast rainy pine forest at night, solid grey blue cloud cover, wet dark tree silhouettes, distant misty mountains, flat dull sky, no moon, no stars, no clear sky, game background | 2048×1152 | 1 | `a33d632` | Text-to-image |
| `view-clear-night.png` | deep dark clear night sky with one bright full moon in the upper middle and a few small stars, black pine treeline below, distant mountains, no clouds, no rain, no buildings, no people, game background | 2048×1152 | 2 | `a33d632` | Text-to-image |
| `occupants/couch-l-ember-awake.png` | cosy dim living room at night, a person with a bright red ponytail wearing a rust red hoodie sitting on the left side of the two-seat couch at the left, crt television glowing, warm lamp light, game background | 2048×1152 | 4 | `a33d632` | Person-mask inpaint; transparent layer extracted |
| `occupants/couch-l-moss-awake.png` | cosy dim living room at night, a person with short curly dark brown hair wearing an olive green jacket sitting on the left side of the two-seat couch at the left, crt television glowing, warm lamp light, game background | 2048×1152 | 2 | `a33d632` | Person-mask inpaint; transparent layer extracted |
| `occupants/couch-l-plum-awake.png` | cosy dim living room at night, a person with a shaved head wearing a dark plum purple jacket sitting on the left side of the two-seat couch at the left, crt television glowing, warm lamp light, game background | 2048×1152 | 2 | `a33d632` | Person-mask inpaint; transparent layer extracted |
| `occupants/couch-l-teal-awake.png` | cosy dim living room at night, a person with long straight black hair wearing a dark teal jacket sitting on the left side of the two-seat couch at the left, crt television glowing, warm lamp light, game background | 2048×1152 | 2 | `a33d632` | Person-mask inpaint; transparent layer extracted |
| `occupants/couch-r-ember-awake.png` | cosy dim living room at night, a person with a bright red ponytail wearing a rust red hoodie sitting on the right side of the two-seat couch at the left, crt television glowing, warm lamp light, game background | 2048×1152 | 1 | `a33d632` | Person-mask inpaint; transparent layer extracted |
| `occupants/couch-r-moss-awake.png` | cosy dim living room at night, a person with short curly dark brown hair wearing an olive green jacket sitting on the right side of the two-seat couch at the left, crt television glowing, warm lamp light, game background | 2048×1152 | 4 | `a33d632` | Person-mask inpaint; transparent layer extracted |
| `occupants/couch-r-plum-awake.png` | cosy dim living room at night, a person with a shaved head wearing a dark plum purple jacket sitting on the right side of the two-seat couch at the left, crt television glowing, warm lamp light, game background | 2048×1152 | 1 | `a33d632` | Person-mask inpaint; transparent layer extracted |
| `occupants/couch-r-teal-awake.png` | cosy dim living room at night, a person with long straight black hair wearing a dark teal jacket sitting on the right side of the two-seat couch at the left, crt television glowing, warm lamp light, game background | 2048×1152 | 2 | `a33d632` | Person-mask inpaint; transparent layer extracted |
| `occupants/beanbag-ember-awake.png` | cosy dim living room at night, a person with a bright red ponytail wearing a rust red hoodie sitting on the right side of the low green beanbag chair at the left, crt television glowing, warm lamp light, game background | 2048×1152 | 3 | `a33d632` | Person-mask inpaint; transparent layer extracted |
| `occupants/beanbag-moss-awake.png` | cosy dim living room at night, a person with short curly dark brown hair wearing an olive green jacket sitting on the right side of the low green beanbag chair at the left, crt television glowing, warm lamp light, game background | 2048×1152 | 3 | `a33d632` | Person-mask inpaint; transparent layer extracted |
| `occupants/beanbag-plum-awake.png` | cosy dim living room at night, a person with a shaved head wearing a dark plum purple jacket sitting on the right side of the low green beanbag chair at the left, crt television glowing, warm lamp light, game background | 2048×1152 | 1 | `a33d632` | Person-mask inpaint; transparent layer extracted |
| `occupants/beanbag-teal-awake.png` | cosy dim living room at night, a person with long straight black hair wearing a dark teal jacket sitting on the right side of the low green beanbag chair at the left, crt television glowing, warm lamp light, game background | 2048×1152 | 4 | `a33d632` | Person-mask inpaint; transparent layer extracted |
| `occupants/hammock-ember-awake.png` | cosy dim living room at night, a person with a bright red ponytail wearing a rust red hoodie lying on their side with a horizontal body in the cloth hammock at the right, head at the left, crt television glowing, warm lamp light, game background | 2048×1152 | 1 | `a33d632` | Person-mask inpaint; transparent layer extracted |
| `occupants/hammock-moss-awake.png` | cosy dim living room at night, a person with short curly dark brown hair wearing an olive green jacket lying on their side with a horizontal body in the cloth hammock at the right, head at the left, crt television glowing, warm lamp light, game background | 2048×1152 | 3 | `a33d632` | Person-mask inpaint; transparent layer extracted |
| `occupants/hammock-plum-awake.png` | cosy dim living room at night, a person with a shaved head wearing a dark plum purple jacket lying on their side with a horizontal body in the cloth hammock at the right, head at the left, crt television glowing, warm lamp light, game background | 2048×1152 | 3 | `a33d632` | Person-mask inpaint; transparent layer extracted |
| `occupants/hammock-teal-awake.png` | cosy dim living room at night, a person with long straight black hair wearing a dark teal jacket lying on their side with a horizontal body in the cloth hammock at the right, head at the left, crt television glowing, warm lamp light, game background | 2048×1152 | 3 | `a33d632` | Person-mask inpaint; transparent layer extracted |
| `occupants/couch-l-ember-asleep.png` | cosy dim living room at night, a person with a bright red ponytail wearing a rust red hoodie asleep sitting on the left side of the two-seat couch at the left, eyes closed, head drooping forward, hair over face, sleeping peacefully, crt television glowing, warm lamp light, game background | 2048×1152 | 2 | `a33d632` | Head-only inpaint of shipped awake generation |
| `occupants/couch-l-moss-asleep.png` | cosy dim living room at night, a person with short curly dark brown hair wearing an olive green jacket asleep sitting on the left side of the two-seat couch at the left, eyes closed, head drooping forward, hair over face, sleeping peacefully, crt television glowing, warm lamp light, game background | 2048×1152 | 3 | `a33d632` | Head-only inpaint of shipped awake generation |
| `occupants/couch-l-plum-asleep.png` | cosy dim living room at night, a person with a shaved head wearing a dark plum purple jacket asleep sitting on the left side of the two-seat couch at the left, eyes closed, head drooping forward, hair over face, sleeping peacefully, crt television glowing, warm lamp light, game background | 2048×1152 | 3 | `a33d632` | Head-only inpaint of shipped awake generation |
| `occupants/couch-l-teal-asleep.png` | cosy dim living room at night, a person with long straight black hair wearing a dark teal jacket asleep sitting on the left side of the two-seat couch at the left, eyes closed, head drooping forward, hair over face, sleeping peacefully, crt television glowing, warm lamp light, game background | 2048×1152 | 3 | `a33d632` | Head-only inpaint of shipped awake generation |
| `occupants/couch-r-ember-asleep.png` | cosy dim living room at night, a person with a bright red ponytail wearing a rust red hoodie asleep sitting on the right side of the two-seat couch at the left, eyes closed, head drooping forward, hair over face, sleeping peacefully, crt television glowing, warm lamp light, game background | 2048×1152 | 2 | `a33d632` | Head-only inpaint of shipped awake generation |
| `occupants/couch-r-moss-asleep.png` | cosy dim living room at night, a person with short curly dark brown hair wearing an olive green jacket asleep sitting on the right side of the two-seat couch at the left, eyes closed, head drooping forward, hair over face, sleeping peacefully, crt television glowing, warm lamp light, game background | 2048×1152 | 3 | `a33d632` | Head-only inpaint of shipped awake generation |
| `occupants/couch-r-plum-asleep.png` | cosy dim living room at night, a person with a shaved head wearing a dark plum purple jacket asleep sitting on the right side of the two-seat couch at the left, eyes closed, head drooping forward, hair over face, sleeping peacefully, crt television glowing, warm lamp light, game background | 2048×1152 | 2 | `a33d632` | Head-only inpaint of shipped awake generation |
| `occupants/couch-r-teal-asleep.png` | cosy dim living room at night, a person with long straight black hair wearing a dark teal jacket asleep sitting on the right side of the two-seat couch at the left, eyes closed, head drooping forward, hair over face, sleeping peacefully, crt television glowing, warm lamp light, game background | 2048×1152 | 3 | `a33d632` | Head-only inpaint of shipped awake generation |
| `occupants/beanbag-ember-asleep.png` | cosy dim living room at night, a person with a bright red ponytail wearing a rust red hoodie asleep sitting slumped in the low green beanbag chair, eyes closed, head drooping forward, hair over face, sleeping peacefully, crt television glowing, warm lamp light, game background | 2048×1152 | 2 | `a33d632` | Head-only inpaint of shipped awake generation |
| `occupants/beanbag-moss-asleep.png` | cosy dim living room at night, a person with short curly dark brown hair wearing an olive green jacket asleep sitting slumped in the low green beanbag chair, eyes closed, head drooping forward, hair over face, sleeping peacefully, crt television glowing, warm lamp light, game background | 2048×1152 | 3 | `a33d632` | Head-only inpaint of shipped awake generation |
| `occupants/beanbag-plum-asleep.png` | cosy dim living room at night, a person with a shaved head wearing a dark plum purple jacket asleep sitting slumped in the low green beanbag chair, eyes closed, head drooping forward, hair over face, sleeping peacefully, crt television glowing, warm lamp light, game background | 2048×1152 | 3 | `a33d632` | Head-only inpaint of shipped awake generation |
| `occupants/beanbag-teal-asleep.png` | cosy dim living room at night, a person with long straight black hair wearing a dark teal jacket asleep sitting slumped in the low green beanbag chair, eyes closed, head drooping forward, hair over face, sleeping peacefully, crt television glowing, warm lamp light, game background | 2048×1152 | 3 | `a33d632` | Head-only inpaint of shipped awake generation |
| `occupants/hammock-ember-asleep.png` | cosy dim living room at night, a person with a bright red ponytail wearing a rust red hoodie asleep lying on their side in the cloth hammock at the right, eyes closed, head drooping forward, hair over face, sleeping peacefully, crt television glowing, warm lamp light, game background | 2048×1152 | 3 | `a33d632` | Head-only inpaint of shipped awake generation |
| `occupants/hammock-moss-asleep.png` | cosy dim living room at night, a person with short curly dark brown hair wearing an olive green jacket asleep lying on their side in the cloth hammock at the right, eyes closed, head drooping forward, hair over face, sleeping peacefully, crt television glowing, warm lamp light, game background | 2048×1152 | 3 | `a33d632` | Head-only inpaint of shipped awake generation |
| `occupants/hammock-plum-asleep.png` | cosy dim living room at night, a person with a shaved head wearing a dark plum purple jacket asleep lying on their side in the cloth hammock at the right, eyes closed, head drooping forward, hair over face, sleeping peacefully, crt television glowing, warm lamp light, game background | 2048×1152 | 1 | `a33d632` | Head-only inpaint of shipped awake generation |
| `occupants/hammock-teal-asleep.png` | cosy dim living room at night, a person with long straight black hair wearing a dark teal jacket asleep lying on their side in the cloth hammock at the right, eyes closed, head drooping forward, hair over face, sleeping peacefully, crt television glowing, warm lamp light, game background | 2048×1152 | 3 | `a33d632` | Head-only inpaint of shipped awake generation |
