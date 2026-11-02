#!/usr/bin/env python3
"""Build the two v0.1 ambient audio beds (rain, clear-night) as seamless loops.

Reproducible from downloaded Freesound high-quality previews. See
`packs/dormouse-v0/audio/SOURCES.md` for where to fetch the sources and the
licence record; see `tools/audio/README.md` for the runbook.

Requires `ffmpeg` (with `libopus`) and `python3` with NumPy on PATH. The loop
construction and encoding are pure ffmpeg; NumPy is used only for the seam
check.

The bed is built as a *crossfade-wrapped loop*: take the first `T + F` seconds
of a source, keep the body from `F` to `T`, and append a `F`-second half-sine
crossfade that fades the source's tail (`T`…`T+F`) back into its head
(`0`…`F`). The loop point is then sample-continuous, so there is no click.
Loop length is `T`.

Loudness: each layer is gain-normalised to a per-layer integrated-LUFS target
with a fixed (memoryless) gain — never a limiter, which would reopen the seam —
then mixed, and the final bed is brought to -23 LUFS integrated. Outputs are
Opus-in-OGG and AAC-in-M4A.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

# --- Tuning ---------------------------------------------------------------

T = 165.0          # loop length, seconds (2:45, within the 2-3 minute spec)
F = 6.0            # crossfade length, seconds
SR = 48000         # working sample rate
TARGET_LUFS = -23.0
OPUS_BITRATE = "128k"
AAC_BITRATE = "160k"

# bed -> list of (layer_key, source_filename, layer_target_lufs)
# layer_target_lufs is the integrated loudness each layer is set to *before*
# mixing (None is not used). The final mix is always normalised to TARGET_LUFS.
BEDS = {
    "rain": [
        ("rain", "rain_725603_whitenoisesleeper_greenhouse_hq.mp3", None),
    ],
    "clear-night": [
        ("wind", "clear-night_853993_fran-marenco_wind-trees-crickets_hq.mp3", -24.0),
        ("crickets", "clear-night_751466_borgory_crickets-forest_hq.mp3", -27.0),
    ],
}


# --- ffmpeg helpers -------------------------------------------------------

def run(cmd: list[str], **kw) -> subprocess.CompletedProcess:
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode != 0:
        sys.stderr.write("command failed: %s\n%s\n" % (" ".join(cmd), r.stderr))
        raise SystemExit(r.returncode)
    return r


def measure_lufs(path: Path) -> tuple[float, float]:
    """Return (integrated_lufs, true_peak_dbtp) for a wav file."""
    r = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path),
             "-af", "loudnorm=print_format=json", "-f", "null", "-"])
    # loudnorm prints a JSON object to stderr; find the last one.
    matches = list(re.finditer(r"\{.*?\}", r.stderr, flags=re.S))
    if not matches:
        sys.stderr.write("no loudnorm JSON in output:\n%s\n" % r.stderr)
        raise SystemExit(1)
    try:
        d = json.loads(matches[-1].group(0))
    except Exception:
        sys.stderr.write("could not parse loudnorm output:\n%s\n" % r.stderr)
        raise
    return float(d["input_i"]), float(d["input_tp"])


def make_loop(src: Path, out: Path, t: float = T, f: float = F) -> None:
    """Crossfade-wrap the first `t + f` seconds of `src` into a `t`-second loop."""
    fc = (
        f"aresample={SR},aformat=channel_layouts=stereo,asplit=3[a][b][c];"
        f"[a]atrim=start={f}:end={t},asetpts=PTS-STARTPTS[body];"
        f"[b]atrim=start={t}:end={t + f},asetpts=PTS-STARTPTS[tail];"
        f"[c]atrim=start=0:end={f},asetpts=PTS-STARTPTS[head];"
        f"[tail][head]acrossfade=d={f}:c1=hsin:c2=hsin[wrap];"
        f"[body][wrap]concat=n=2:v=0:a=1[out]"
    )
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(src),
         "-filter_complex", fc, "-map", "[out]", "-c:a", "pcm_s24le", str(out)])


def gain_to(out: Path, src: Path, target_lufs: float) -> float:
    """Apply a fixed (memoryless) gain so `src` reaches `target_lufs` LUFS.

    A fixed gain is deliberate: it preserves the loop seam exactly, whereas a
    limiter or compressor is stateful and would process the first and last
    samples of the loop under different internal states, reopening the seam.
    The sources chosen for v0.1 all have headroom after their gain, so no
    limiter is needed; we still measure the result and warn if it clips.
    """
    i, _ = measure_lufs(src)
    gain_db = target_lufs - i
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(src),
         "-af", f"volume={gain_db:.4f}dB", "-c:a", "pcm_s24le", str(out)])
    _, out_tp = measure_lufs(out)
    if out_tp > -0.5:
        sys.stderr.write(
            f"WARNING: {out.name} true peak {out_tp:.1f} dBTP after gain; "
            "reduce the layer target to leave headroom\n")
    return gain_db


def mix(layers: list[Path], out: Path) -> None:
    """Equal-weight sum of already-levelled layers (no auto-normalisation)."""
    inputs: list[str] = []
    for p in layers:
        inputs += ["-i", str(p)]
    n = len(layers)
    fc = "".join(f"[{i}:a]" for i in range(n)) + f"amix=inputs={n}:normalize=0[out]"
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y"] + inputs +
        ["-filter_complex", fc, "-map", "[out]", "-c:a", "pcm_s24le", str(out)])


def encode(in_path: Path, out_ogg: Path, out_m4a: Path) -> None:
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(in_path),
         "-c:a", "libopus", "-b:a", OPUS_BITRATE, "-f", "ogg", str(out_ogg)])
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(in_path),
         "-c:a", "aac", "-b:a", AAC_BITRATE, "-movflags", "+faststart",
         str(out_m4a)])


# --- verification ---------------------------------------------------------

def decode_mono(path: Path) -> "object":
    import numpy as np
    r = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(path),
                        "-af", "aformat=channel_layouts=mono", "-f", "f32le", "-"],
                       capture_output=True)
    return np.frombuffer(r.stdout, dtype=np.float32)


def verify_seam(loop: Path) -> None:
    """Render the loop twice and check for a discontinuity at the loop point.

    A click at the seam would show up as a sample-to-sample step far larger
    than anything in the body of the loop. We compare the step at the loop
    point (|x[-1] - x[0]|, i.e. the transition the second play makes back into
    the first) against the 99.9th-percentile step of the whole loop, and also
    check the crossfade region does not audibly drop in level.
    """
    import numpy as np
    x = decode_mono(loop)
    n = len(x)
    seam = float(abs(x[-1] - x[0]))
    steps = np.abs(np.diff(x))
    p999 = float(np.percentile(steps, 99.9))
    click = seam > p999
    # RMS envelope: crossfade region (last F seconds) vs body
    win = int(SR * 0.25)
    nw = n // win
    rms = np.sqrt(np.mean(x[: nw * win].reshape(nw, win) ** 2, axis=1))
    rms_db = 20 * np.log10(rms + 1e-10)
    nf = int(F / 0.25)
    body_db = float(np.mean(rms_db[:-nf]))
    xfade_db = float(np.mean(rms_db[-nf:]))
    print(f"  seam step = {seam:.6g} vs p99.9 step = {p999:.6g} "
          f"-> {'CLICK' if click else 'seamless'}")
    print(f"  level: body {body_db:.1f} dB, crossfade {xfade_db:.1f} dB "
          f"({xfade_db - body_db:+.1f} dB)")


def report_loudness(path: Path, label: str) -> None:
    i, tp = measure_lufs(path)
    print(f"  {label}: integrated = {i:.1f} LUFS, true peak = {tp:.1f} dBTP")


# --- main -----------------------------------------------------------------

def build_bed(name: str, layers, src_dir: Path, tmp: Path) -> None:
    print(f"== {name} ==")
    levelled: list[Path] = []
    for layer_key, filename, target in layers:
        src = src_dir / filename
        if not src.exists():
            sys.stderr.write(f"missing source: {src} (see SOURCES.md)\n")
            raise SystemExit(1)
        loop = tmp / f"{name}-{layer_key}-loop.wav"
        make_loop(src, loop)
        if target is None:
            # single-layer bed: normalise the loop straight to the final target
            lvl = tmp / f"{name}-{layer_key}-levelled.wav"
            gain_to(lvl, loop, TARGET_LUFS)
            print(f"  {layer_key}: loop made, normalised to {TARGET_LUFS} LUFS")
        else:
            lvl = tmp / f"{name}-{layer_key}-levelled.wav"
            gain_to(lvl, loop, target)
            print(f"  {layer_key}: loop made, levelled to {target} LUFS")
        verify_seam(loop)
        levelled.append(lvl)

    if len(levelled) == 1:
        bed = levelled[0]
    else:
        bed = tmp / f"{name}-mix.wav"
        mix(levelled, bed)
        final = tmp / f"{name}-final.wav"
        gain_to(final, bed, TARGET_LUFS)
        bed = final
        print("  mixed and re-normalised to -23 LUFS")

    return bed


def main() -> int:
    ap = argparse.ArgumentParser(description="Build the Dormouse ambient beds")
    ap.add_argument("--src", type=Path, default=Path("sources"),
                    help="directory of downloaded Freesound hq previews")
    ap.add_argument("--out", type=Path, default=Path("packs/dormouse-v0/audio"),
                    help="output directory")
    ap.add_argument("--tmp", type=Path, default=Path(".context/audio-build"),
                    help="scratch directory (gitignored)")
    args = ap.parse_args()

    args.tmp.mkdir(parents=True, exist_ok=True)
    args.out.mkdir(parents=True, exist_ok=True)

    for name, layers in BEDS.items():
        bed = build_bed(name, layers, args.src, args.tmp)
        report_loudness(bed, "final bed")
        encode(bed, args.out / f"{name}.ogg", args.out / f"{name}.m4a")
        print(f"  wrote {args.out / (name + '.ogg')} and "
              f"{args.out / (name + '.m4a')}\n")

    print("done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
