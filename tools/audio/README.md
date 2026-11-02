# Audio bed pipeline

How to rebuild the two v0.1 ambient beds (`rain`, `clear-night`) as seamless
loops. The *why* lives in [`docs/design.md`](../../docs/design.md#audio); the
licence record and exact source URLs are in
[`packs/dormouse-v0/audio/SOURCES.md`](../../packs/dormouse-v0/audio/SOURCES.md).

The pipeline is one deterministic script. It needs `ffmpeg` (with `libopus` for
the Opus-in-OGG output) on PATH. `sox` is available on the machine but is not
used by the build; the seam and loudness checks are done in-script with ffmpeg.

## Files here

| File | What |
|---|---|
| `README.md` | this runbook |
| [`build_beds.py`](build_beds.py) | fetch-free rebuild of both beds from downloaded sources |

## The short version

```bash
# 1. Download the three Freesound hq previews (see SOURCES.md for the exact
#    curl commands and checksums) into a `sources/` directory.
# 2. Rebuild the loops and encode both formats:
python3 tools/audio/build_beds.py --src sources
```

The output lands in `packs/dormouse-v0/audio/` as `rain.{ogg,m4a}` and
`clear-night.{ogg,m4a}`. The script also prints the seam and loudness checks
for each layer, and the final bed.

## How it works

Each bed is a **crossfade-wrapped loop**:

1. Normalise every source to 48 kHz stereo.
2. Keep the first `T + F` seconds of a source (`T = 165`, `F = 6`).
3. The loop body is the source from `F` to `T`; the last `F` seconds are a
   half-sine crossfade that fades the source's tail (`T`…`T+F`) back into its
   head (`0`…`F`). The loop point is then sample-continuous, so there is no
   click; the loop length is `T` (2:45, inside the 2–3 minute spec).
4. Level each layer with a **fixed gain** (never a limiter — a limiter is
   stateful and would reprocess the first and last samples of the loop under
   different internal states, reopening the seam). Sources chosen for v0.1 all
   have headroom, so no limiting is needed.
5. Mix the layers of a multi-layer bed, then normalise the bed to −23 LUFS
   integrated.
6. Encode Opus-in-OGG (`libopus`, 128 kbps) and AAC-in-M4A (160 kbps).

Layers and their pre-mix loudness targets are defined in the `BEDS` table at
the top of [`build_beds.py`](build_beds.py). To change a bed's balance, change
a target there and rerun.

## Verification

The script checks, and prints, for every layer and the final bed:

- **Seam continuity** — the loop is rendered twice and the step at the loop
  point is compared to the 99.9th-percentile sample step. A click would be far
  above it.
- **Crossfade level** — the RMS of the last `F` seconds against the body, so
  the loop point neither swells nor dips audibly.
- **Loudness** — integrated LUFS and true peak on the final bed.

The expected numbers for v0.1 are in `SOURCES.md`; a rebuild that drifts from
them means a source changed (checksum) or ffmpeg's resampler/encoder changed.

## Tuning

- `T` (loop length) and `F` (crossfade) are constants at the top of the script.
- Per-layer targets are in `BEDS`.
- Opus/AAC bitrates are `OPUS_BITRATE` / `AAC_BITRATE`.

## Changing a source

Do a licence check first (CC0 or CC BY 4.0 only; never NonCommercial, watch for
ShareAlike), then:

1. Add its download URL and licence to `SOURCES.md` and its credit to
   `CREDITS.md`.
2. Add/update its entry in `BEDS`.
3. Rebuild and re-check the seam, level, and loudness output.
