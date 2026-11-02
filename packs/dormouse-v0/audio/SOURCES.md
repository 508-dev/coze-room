# Audio sources and processing — Dormouse v0.1 ambient beds

This is the provenance record for the two v0.1 ambient beds. It says where each
sound came from, under what licence, and exactly what was done to it. The
*why* (Freesound CC0/CC BY only, never NonCommercial) lives in
[`docs/design.md`](../../../docs/design.md#audio) and
[`COPYRIGHT.md`](../../../COPYRIGHT.md).

Two beds ship, matching the two window views:

| Environment id | File | What it is |
|---|---|---|
| `rain` | `rain.ogg`, `rain.m4a` | Steady rain on a greenhouse glass roof |
| `clear-night` | `clear-night.ogg`, `clear-night.m4a` | Calm night: wind through trees, crickets |

Both are 2:45 (165 s) seamless loops, Opus-in-OGG plus an AAC-in-M4A fallback,
48 kHz stereo, matched at −23 LUFS integrated with no clipping. The playback
task (#58 part 2) wires these in by environment id; the file stem is the id.

## Sources

All three are Freesound, all **CC0 1.0** (public domain dedication). CC0 is the
cleanest case: no attribution is legally required, but the credits are recorded
in [`../CREDITS.md`](../CREDITS.md) anyway as a courtesy and a trail.

| Bed | Layer | Sound | Author | Freesound URL | Licence |
|---|---|---|---|---|---|
| `rain` | rain | "Rain Falling On The Greenhouse" | WhiteNoiseSleeper | <https://freesound.org/people/WhiteNoiseSleeper/sounds/725603/> | CC0 1.0 |
| `clear-night` | wind | "Night wind, trees ans crickets 2" | fran_marenco | <https://freesound.org/people/fran_marenco/sounds/853993/> | CC0 1.0 |
| `clear-night` | crickets | "Crickets chirping in the Night at the Forest 002" | Borgory | <https://freesound.org/people/Borgory/sounds/751466/> | CC0 1.0 |

The licence deed shown on each Freesound page is
`http://creativecommons.org/publicdomain/zero/1.0/`
(canonical: <https://creativecommons.org/publicdomain/zero/1.0/>).

### Source details

- **Rain — 725603** ("Rain Falling On The Greenhouse", WhiteNoiseSleeper).
  Re-mastered with noise reduction for clarity. Original: Zoom H1, two small
  microphones clipped near the roof of a small greenhouse during light/medium
  rainfall. Picked for the `rain` bed because it is steady, calm, and is
  literally rain on a glass roof — the "window or roof" perspective the bed
  asks for. No thunder, no traffic.

- **Wind — 853993** ("Night wind, trees ans crickets 2", fran_marenco).
  Wind through trees, creaking dry branches, and background crickets.
  LOM Uši Pro + Zoom F4, Cabo Raso. Picked as the `clear-night` atmosphere:
  a night field recording with no birdsong (a daytime cue that would be wrong
  in a night bed).

- **Crickets — 751466** ("Crickets chirping in the Night at the Forest 002",
  Borgory). Forest crickets at night, Zoom H5 + Sennheiser ME66 (dual-mono).
  Picked to guarantee clear, foreground cricket chirping over the wind layer,
  since the crickets in 853993 sit further back in the mix.

## Downloading the sources

The sources themselves are **not committed** — they are Freesound "high-quality
previews" (the public `-hq` MP3, ~183 kbps, no account or API key needed). Fetch
them into a directory (any name; the build script reads `--src`):

```bash
mkdir -p sources && cd sources
curl -L --fail -o rain_725603_whitenoisesleeper_greenhouse_hq.mp3 \
  https://cdn.freesound.org/previews/725/725603_15753134-hq.mp3
curl -L --fail -o clear-night_853993_fran-marenco_wind-trees-crickets_hq.mp3 \
  https://cdn.freesound.org/previews/853/853993_3557494-hq.mp3
curl -L --fail -o clear-night_751466_borgory_crickets-forest_hq.mp3 \
  https://cdn.freesound.org/previews/751/751466_801011-hq.mp3
sha256sum -c <<'EOF'
b7f52ea3533516327963b1640fe63d3bb28d1cb5adc14ba234237078902bcff9  rain_725603_whitenoisesleeper_greenhouse_hq.mp3
fac40406ae37aae3a2871ee63c95315edccf353d6c99ca4134ae6de7db7c43ab  clear-night_853993_fran-marenco_wind-trees-crickets_hq.mp3
4bc39df7043cc4a0838ea28e70dbceb9cb59c21112547323eb33ef4fffcbc90c  clear-night_751466_borgory_crickets-forest_hq.mp3
EOF
```

These are the public previews, so no Freesound account or API key is involved.
If a future bed genuinely needs the *original* uploads (higher sample rate or
bit depth than the preview offers), that requires a logged-in Freesound API
key — stop and ask the owner rather than working around it.

## Processing

The rebuild script is [`tools/audio/build_beds.py`](../../../tools/audio/build_beds.py);
see [`tools/audio/README.md`](../../../tools/audio/README.md) for the runbook.
Every step is deterministic (fixed parameters, no randomness): a rebuild
produces byte-identical WAV intermediates and M4A output, and Opus-in-OGG whose
audio payload is identical (only the Ogg container's random stream serial
number differs, which carries no audio significance).

1. **Normalise format** — decode and resample every source to 48 kHz stereo.
2. **Seamless loop** — take the first 171 s of each source, then *crossfade-wrap*
   it into a 165 s loop: keep the body (6 s…165 s), and append a 6 s
   half-sine crossfade that fades the source's tail back into its head. The
   loop point is sample-continuous by construction, so there is no click.
3. **Level** — gain each layer to a per-layer integrated-loudness target:
   rain −23 LUFS (single layer); clear-night wind −24 LUFS, crickets −27 LUFS.
   Gain is a fixed scalar (no compressor/limiter), so the seam stays intact.
4. **Mix** — equal-weight sum of the clear-night layers.
5. **Normalise** — bring the final bed to −23 LUFS integrated.
6. **Encode** — Opus-in-OGG (`libopus`, 128 kbps) and AAC-in-M4A (160 kbps).

### Verification (run by the build script, and re-checkable)

- **Seam**: the loop is rendered twice end-to-end and the step at the loop
  point (`|x[−1] − x[0]|`) is compared to the loop's 99.9th-percentile
  sample step. A splice click would be orders of magnitude above it; all beds
  report the seam at or below the normal step distribution.
- **Loudness**: integrated −23 LUFS on every output; true peak well under
  0 dBTP (rain ≈ −7, clear-night ≈ −8), so no clipping.
- **Level across the crossfade**: the last 6 s stay within ~±1.6 dB of the
  body, so the loop point does not audibly swell or dip.

Resulting output:

| File | Format | Duration | Integrated | True peak |
|---|---|---|---|---|
| `rain.ogg` | Opus, 48 kHz stereo, ~119 kbps | 165.0 s | −23.0 LUFS | −7.0 dBTP |
| `rain.m4a` | AAC-LC, 48 kHz stereo, ~162 kbps | 165.0 s | −23.2 LUFS | −7.2 dBTP |
| `clear-night.ogg` | Opus, 48 kHz stereo, ~118 kbps | 165.0 s | −23.0 LUFS | −8.1 dBTP |
| `clear-night.m4a` | AAC-LC, 48 kHz stereo, ~162 kbps | 165.0 s | −23.1 LUFS | −8.2 dBTP |

`rain.ogg`/`rain.m4a` and `clear-night.ogg`/`clear-night.m4a` are Git LFS (see
`.gitattributes`); confirm with `git lfs ls-files`.
