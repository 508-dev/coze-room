# Art pipeline

How to turn a text prompt into a palette-conformant sprite on a real pixel
grid. The *why* lives in [`docs/design.md`](../../docs/design.md#art); this
file is the runbook.

The pipeline has four steps:

1. **Generate** a still in ComfyUI with SDXL and a pixel-art LoRA.
2. **Downsample** it, nearest-neighbour, to the pixel grid.
3. **Quantize** it to the Atropoeia palette, no dithering.
4. **Clean up** by hand in LibreSprite.

Step 1 is the only one that needs a GPU. Steps 2 and 3 are one deterministic
script. Step 4 is a person.

Written against Manjaro Linux with an RTX 5090 (32 GB), October 2026. Versions
that were actually tested are recorded inline, so you can tell what drifted.
Other Arch-based distributions should work unchanged. Other Linux
distributions need their own way of installing ComfyUI; everything from step 3
on is the same.

**Read [What this is bad at](#what-this-is-bad-at) before you start.** It will
save you from expecting finished avatars.

## Files here

| File | What |
|---|---|
| `README.md` | this runbook |
| [`PROMPTS.md`](PROMPTS.md) | models and their licences, sizes, prompt structure, seeds, settings |
| [`EXPERIMENTS.md`](EXPERIMENTS.md) | what has been tried beyond the pipeline, and tools evaluated |
| [`workflow.json`](workflow.json) | the ComfyUI generation graph |
| [`models.sha256`](models.sha256) | checksums of the model files |
| [`palette.hex`](palette.hex) | the Atropoeia palette, 48 colours: **the single source of truth** |
| [`quantize.py`](quantize.py) | downsample + palette snap |
| [`test_quantize.py`](test_quantize.py) | its tests |
| [`verify.py`](verify.py) | refuse off-palette, partial-alpha, or off-grid PNGs |
| [`test_verify.py`](test_verify.py) | its tests |

## Already set up? The short version

```bash
sudo systemctl start comfyui
# open http://127.0.0.1:8188, press W, click dormouse.json, edit the prompt, Run
python3 tools/art/quantize.py /var/lib/comfyui/output/dormouse/gen_00001_.png sprite.png
libresprite sprite.png   # clean up, Ctrl+S
sudo systemctl stop comfyui
```

Setup is steps 1–6 below, about 15 minutes plus an 11 GB download. Making a
sprite is steps 6–8.

## 1. Install ComfyUI

ComfyUI is the node-graph front end that runs the diffusion model. Install the
AUR package:

```bash
yay -S comfyui
```

Tested with `comfyui 0.43.0-1`. What it lays down:

| Path | What |
|---|---|
| `/opt/comfyui/` | ComfyUI itself, owned by the `comfy` system user |
| `/opt/comfyui/venv/` | its private Python venv, including PyTorch |
| `/opt/comfyui/models/` | checkpoints, LoRAs, etc. go in subfolders here |
| `/var/lib/comfyui/output/` | generated images |
| `comfyui.service` | systemd unit; runs as `comfy`, listens on `127.0.0.1:8188` |

You need the NVIDIA proprietary driver (`nvidia-smi` should list your card).
You do **not** need the `cuda` pacman package: the PyTorch wheels bundle their
own CUDA runtime.

## 2. Make PyTorch use the NVIDIA card

**Check this even if the install looked clean.** The package's install script
picks a PyTorch build by grepping `lspci`, and it checks for AMD *before*
NVIDIA. Most Ryzen 7000/9000 desktop CPUs have an integrated Radeon, so on a
Ryzen + NVIDIA machine it installs the **ROCm** (AMD) build of PyTorch.
ComfyUI then starts, finds a "GPU", and runs on the integrated graphics while
the discrete card sits idle.

Check which build you have:

```bash
/opt/comfyui/venv/bin/python -c "import torch; print(torch.__version__, torch.cuda.get_device_name(0))"
```

You want `+cu130` and your NVIDIA card's name. If it says `+rocm…` or names
your CPU, swap the wheels in place:

```bash
sudo -u comfy /opt/comfyui/venv/bin/pip uninstall -y torch torchvision torchaudio triton-rocm
sudo -u comfy /opt/comfyui/venv/bin/pip install --no-cache-dir \
  torch==2.14.1 torchvision==0.29.1 torchaudio==2.11.0 \
  --index-url https://download.pytorch.org/whl/cu130
```

This is about 4 GB. Run the check again afterwards; it should print

```text
2.14.1+cu130 NVIDIA GeForce RTX 5090
```

(or your card's name). With CUDA PyTorch the integrated GPU is invisible, so
device 0 is always the NVIDIA card.

Reinstalling the package does **not** fix this: its install script skips the
PyTorch download whenever `import torch` already succeeds. The flip side is
that the fix survives package upgrades. It does not survive a Python minor
version bump (3.14 → 3.15): that breaks the venv, the install script
reinstalls PyTorch, and it guesses ROCm again. Rerun the check after any
`python` upgrade.

CUDA 13.0 wheels (`cu130`) are needed for an RTX 50-series card (Blackwell,
`sm_120`); anything older than `cu128` does not have kernels for it.

## 3. Download the checkpoint and the LoRA

Two files. The *checkpoint* is the base text-to-image model: SDXL base 1.0,
unmodified, from Stability AI. The *LoRA* is a small add-on that pushes it
toward pixel art: PixelArtRedmond. Why these two, and the licence evidence for
each, is in [`PROMPTS.md`](PROMPTS.md#models). Do not substitute another LoRA
without doing the same licence check.

The URLs are pinned to a commit, not `main`, so a later upload to either repo
cannot silently change what you get.

```bash
sudo -u comfy curl -L --fail -C - \
  -o /opt/comfyui/models/checkpoints/sd_xl_base_1.0.safetensors \
  https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/462165984030d82259a11f4367a4eed129e94a7b/sd_xl_base_1.0.safetensors

sudo -u comfy curl -L --fail -C - \
  -o /opt/comfyui/models/loras/PixelArtRedmond-Lite64.safetensors \
  https://huggingface.co/artificialguybr/PixelArtRedmond/resolve/33cbdd147b152f816b0b3ac2ba250848fef83576/PixelArtRedmond-Lite64.safetensors
```

About 7.1 GB in total. Then verify both against the committed hashes, from the
repo root:

```bash
(cd /opt/comfyui/models && sha256sum -c -) < tools/art/models.sha256
```

Both lines must say `OK`.

`-C -` resumes an interrupted download; `--fail` stops an HTML error page being
saved under a model's filename. Downloading as `comfy` keeps the files owned by
the service user.

## 4. Install LibreSprite

The hand-cleanup editor. It is in Manjaro's official repositories:

```bash
sudo pacman -S libresprite
```

Tested with `libresprite 1.3-1`. LibreSprite is the GPL-2.0 fork of Aseprite's
last open-source release. We use it rather than Aseprite because Aseprite is
proprietary and not in the official repositories; on Manjaro it means building
from source or trusting an AUR repackage of a binary. Everything the cleanup
step needs (indexed colour, a loaded palette, a pencil, nearest-neighbour
zoom) is in LibreSprite.

## 5. Start ComfyUI

ComfyUI runs as a system service:

```bash
sudo systemctl start comfyui     # start
sudo systemctl stop comfyui      # stop when you are done
journalctl -u comfyui -f         # follow the log
```

Then open **<http://127.0.0.1:8188>** in a browser.

Check the log once, the first time. Among the startup lines should be

```text
Device: cuda:0 NVIDIA GeForce RTX 5090 : cudaMallocAsync
```

If it names your CPU or says `cpu`, go back to step 2.

Two things are deliberate:

- **Do not `enable` the service.** After a generation ComfyUI keeps the model
  resident in VRAM (about 7 GB) until it stops. Start it when you are making
  art; stop it afterwards.
- **It listens on `127.0.0.1` only.** ComfyUI has no authentication. Do not
  change it to `--listen 0.0.0.0`.

## 6. Load the workflow and generate

The generation graph is committed at [`workflow.json`](workflow.json), so
nobody has to rebuild it by hand from a screenshot.

1. Install it into ComfyUI's Workflows sidebar. From the repo root, with
   ComfyUI running:

   ```bash
   curl -X POST --data-binary @tools/art/workflow.json \
     "http://127.0.0.1:8188/api/userdata/workflows%2Fdormouse.json?overwrite=true"
   ```

   Rerun this whenever `workflow.json` changes in git.
2. In the browser, press `W` to open the **Workflows** sidebar and click
   **dormouse.json**.
3. Read the brown **Read me** note on the canvas. It is the short version of
   [`PROMPTS.md`](PROMPTS.md).
4. Click **Run** (or press `Ctrl+Enter`).

If you would rather not use `curl`: click the canvas, press `Ctrl+O`, and pick
`tools/art/workflow.json`. **Dragging the file onto the page is unreliable**:
with some browser and file-manager combinations the browser just opens the
JSON as text instead of handing it to ComfyUI.

The first run takes a few seconds longer while the model loads from disk.
After that, a 1024×1024 image takes about 3 seconds on an RTX 5090. The result
shows in the **Save Image** node and is written to
`/var/lib/comfyui/output/dormouse/`.

With the committed settings unchanged, the first image is a cosy living room
at night. On the same GPU model and software versions it is bit-identical to
ours; on other hardware it will be a similar room, not the same one.
That is your smoke test: if you get a room, the setup works.

Every PNG ComfyUI saves embeds the full graph, prompt and seed. Dragging a
generated PNG back onto the canvas restores exactly the settings that made it.

## 7. Downsample and quantize

```bash
python3 tools/art/quantize.py /var/lib/comfyui/output/dormouse/gen_00001_.png sprite.png
```

This needs `python3` and Pillow (`sudo pacman -S python-pillow`; it is already
on most Manjaro installs). It does not need ComfyUI, the venv, or a GPU.

What it does, in order:

1. **Downsample:** keeps the centre pixel of every 16×16 block. A 1024×1024
   generation becomes a 64×64 sprite.
2. **Quantize:** replaces every pixel with the nearest of the 48 palette
   colours. No dithering.
3. **Alpha:** every pixel ends up fully opaque or fully transparent, never in
   between.

The output is an **indexed PNG**: its palette is `palette.hex` in file order,
plus a transparent entry at index 48. LibreSprite reads that palette from the
file, so step 8 starts with exactly the right colours loaded.

Running it again on the same input with the same arguments gives a
byte-identical file, so a regenerated asset that did not really change does
not show up as a change in git.

Options:

- `--cell N`: source pixels per true pixel. The default of 16 is right for
  PixelArtRedmond output; see [`PROMPTS.md`](PROMPTS.md#sizes) for how that
  was measured. Use another value only for another source.
- `--cell 1`: re-snap a finished sprite to the palette without resizing it.
  Use it on anything that was edited outside LibreSprite's indexed mode.

`not a whole number of 16px cells` means the generation was not a multiple
of 16 in each direction. Fix the size in ComfyUI and generate again; do not
crop or pad, because the grid is anchored to the top-left corner.

**Expect the colours to shift.** Atropoeia is muted greens, browns, teals and
dusky pinks. It has almost no saturated blue, purple or red: a blue night sky
comes out teal and a red jumper comes out rust. That is the palette doing its
job of making every asset look like one world. Prompt for colours the palette
has (see `PROMPTS.md`) rather than fighting it.

## 8. Clean up in LibreSprite

```bash
libresprite sprite.png
```

It opens in **indexed** colour mode, on a transparent layer, with the project
palette as its swatches. Paint only with those swatches and the sprite stays
palette-conformant.

| Key | Action |
|---|---|
| `4` / `5` | zoom to 800% / 1600% |
| `B` | pencil |
| `E` | eraser (to transparent) |
| `I`, or hold `Alt` | eyedropper |
| `W` | magic wand: click selects a contiguous patch of one colour; click again to add |
| `Del` | clear the selection to transparent |
| `Ctrl+Z` | undo |
| `Ctrl+S` | save, still an indexed PNG |

A typical pass on a character or prop:

1. **Remove the backdrop.** Generated sprites sit on a flat grey or beige
   backdrop, not on transparency. Press `W`, click the backdrop, click any
   other backdrop patches to add them, then press `Del`. The soft drop shadow
   under a figure is a different colour; select or erase it too.
2. **Remove stray pixels.** Lone pixels of an odd colour, worst in faces and
   hands.
3. **Fix outlines** so they are continuous and one pixel wide.
4. **Redraw the face.** At this size a face is about 5×5 pixels, and the
   generated one is a smear. Place each eye as one or two deliberate pixels.
5. **Save** with `Ctrl+S`.

Room scenes and window views usually need only step 2, and less of it.

Do not:

- **change Sprite → Color Mode.** In particular, never use *Indexed (Ordered
  Dither)*: dithering is banned, and RGB mode lets off-palette colours in.
- **use Sprite → Sprite Size to resize.** It resamples and smears the grid.
  Crop with Sprite → Canvas Size, Sprite → Crop or Sprite → Trim instead.
- **Trim avatar layers.** Every layer of an avatar must share one canvas size
  and anchor, or they will not line up when composited at runtime.

If a sprite has gone off-palette anyway, re-snap it:
`python3 tools/art/quantize.py sprite.png fixed.png --cell 1`.

CI enforces conformance: [`verify.py`](verify.py) runs over `packs/` and fails
on any off-palette, partial-alpha, or off-grid PNG
([#53](https://github.com/508-dev/coze-room/issues/53)). Run it yourself before
you finish:

```bash
python3 tools/art/verify.py packs/
```

Generated assets are true-pixel images, so CI checks a grid of 1 (whole
pixels). Once pack manifests can declare a grid
([#39](https://github.com/508-dev/coze-room/issues/39)) the CI step will honour
that; until then, use `--grid N` by hand to enforce a coarser grid. verify.py
reports every offending file, its offending colours, and a sample coordinate,
so you know exactly what to fix.

Where finished sprites go is not this pipeline's job: see the asset issues
([#54](https://github.com/508-dev/coze-room/issues/54),
[#55](https://github.com/508-dev/coze-room/issues/55)) and the pack system
([#39](https://github.com/508-dev/coze-room/issues/39)). This pipeline stops
at a clean, palette-conformant PNG. Never commit raw generations.

## What this is bad at

Diffusion models produce high-resolution **pictures of** pixel art, not pixel
art. The LoRA draws convincing 16-pixel blocks, but they have soft edges,
noise inside them, and arbitrary colours. `quantize.py` fixes the grid and the
colours. It cannot fix the decisions, because the model never made any.

**Rooms and window views survive the pipeline well.** They are texture-heavy
and forgiving, and a stray pixel reads as detail. Expect light cleanup.

**Avatars do not.** Expect to redraw a lot of each one:

- **Every pixel is a decision at 28px**, and the model does not make
  decisions; it makes plausible texture. Faces and hands come out as noise.
- **You cannot ask for a size.** The 16-pixel block is fixed, so a sprite's
  true size is its generation size ÷ 16, and SDXL degrades below 768×768. The
  smallest useful generation, 768×768, gives a 48×48 canvas holding a seated
  figure about 28–30 pixels tall. Writing "32x32" or "tiny" in the prompt
  changes nothing; measured, not guessed.
- **It does not produce layers.** The design composites avatars at runtime
  from separate, aligned layers (skin, hair, top, accessory). The generator
  makes a whole character in one piece, and it will not hold one character's
  proportions across poses or seeds. Use avatar generations as reference and
  as a starting point for a base body. A promising way around this for a
  single pose, inpainting each part onto a fixed base, is written up in
  [`EXPERIMENTS.md`](EXPERIMENTS.md).
- **Only seated poses have been tried.** Test standing, lying and sleeping
  before planning around them.
- **There is no transparency.** Removing the backdrop is the manual first
  step of cleanup.

Elsewhere:

- **Size ceiling.** The largest size tested is 2048×1152, which gives 128×72
  true pixels. A whole room sized for 28-pixel avatars probably needs more than
  that. Build it from separately generated pieces rather than pushing the
  resolution: SDXL starts repeating objects at very large sizes.
- **Pieces generated separately do not share lighting or outline style.** The
  shared palette does most of the work of making them match; keep the style
  words in the prompt identical across a set, and expect cleanup to finish
  the job.
- **No legible text.** Never use it for signage or UI.
- **No consistent animation frames.** That suits the design, which drives
  motion with shaders, but the 2–4 frame pose animations are hand work.

## Troubleshooting and FAQ

**The log says `Device: cpu`, or names my CPU.** PyTorch is the wrong build.
Go to step 2.

**`comfyui` says "PyTorch is not installed in the venv".** The venv broke,
usually after a Python upgrade. Run `sudo pacman -S comfyui` to rerun the
install script, then do the check in step 2: it will have guessed the GPU
again.

**`http://127.0.0.1:8188` does not load.** Run `systemctl status comfyui` and
`journalctl -u comfyui -e` and read the last error.

**A node is red after loading the workflow, or it says `value not in list`.**
A model file is missing or misnamed. Rerun the checksum check in step 3. If
you added the files while ComfyUI was running, press `R` in the browser to
refresh its model lists.

**Dropping `workflow.json` on the page just shows the JSON.** Your browser
took the drop instead of ComfyUI. Use the sidebar install or `Ctrl+O` from
step 6.

**The output looks like a soft painting, not pixel art.** The LoRA is not
applied. Check that the LoRA node is wired between the checkpoint and the
sampler, that its strength is 1.0, and that the prompt starts with
`Pixel Art, PixArFK,`.

**The colours are wrong after quantizing.** They are the palette's colours.
See step 7.

**I have a smaller GPU.** Only a 32 GB card has been tested. ComfyUI offloads
to system RAM when VRAM runs out, so smaller cards should work, more slowly.
Please add what you find here.

**I don't use an Arch-based distribution.** Install ComfyUI any way its
upstream documents, put the two model files in its `models/checkpoints/` and
`models/loras/` folders, and continue from step 6. The paths in this file
assume the AUR package.

**Why is ComfyUI a system service and not just a program I run?** That is how
the AUR package installs it: its files belong to the `comfy` user. Running
`comfyui` as yourself fails because you cannot write to its directories.

**Do I need the `cuda` package?** No. The PyTorch wheels bring their own CUDA
runtime.

**Can I use a different LoRA or checkpoint?** Only after the licence check
described in `PROMPTS.md`, recorded there, with its hash added to
`models.sha256`. Then measure its block size; it will not necessarily be 16,
and `quantize.py --cell` must match it.

**Can I use FLUX.1-dev?** No. It is non-commercial.

**Can I use Aseprite instead of LibreSprite?** For your own cleanup, yes: it
reads and writes the same indexed PNGs. LibreSprite is the documented tool
because it is in the official repositories and free software.

## Changing the pipeline

- **The workflow.** Open **dormouse.json** from the sidebar, change it, save
  with `Ctrl+S`, then copy ComfyUI's saved copy back into the repo:

  ```bash
  curl -s "http://127.0.0.1:8188/api/userdata/workflows%2Fdormouse.json" > tools/art/workflow.json
  ```

  Review the diff. Keep the canvas's Read me note in step with `PROMPTS.md`.
  The file is excluded from Biome because ComfyUI decides its formatting.
- **A model or LoRA.** Licence check first, then pin the download URL to a
  commit, add the hash to `models.sha256`, and record everything in
  `PROMPTS.md`, including what you rejected.
- **The palette.** Don't. It is the most expensive decision in the project to
  reverse: every asset ever quantized would need regenerating
  ([`docs/design.md`](../../docs/design.md#art)). Every PNG ComfyUI saves embeds
  its graph and seed, and `PROMPTS.md` keeps an asset log, so regenerating is
  possible. It is still a lot of work.

## Tests

```bash
python3 -m unittest discover -s tools/art
```

These cover the properties `quantize.py` promises — cell-centre sampling, exact
palette snapping, a hard alpha cutoff, byte-identical output — and the checks
`verify.py` enforces: exact palette membership, no partial alpha, and
grid-aligned dimensions. CI runs the same command, so the two can never drift
apart.
