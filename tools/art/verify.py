#!/usr/bin/env python3
"""Refuse art that does not conform to the palette and the pixel grid.

The enforcement half of the art pipeline (see tools/art/README.md). Where
quantize.py produces conformant sprites, verify.py refuses anything that is
not: an off-palette colour, partial alpha, or a dimension that is not a whole
multiple of the grid. CI runs it over packs/ so an off-palette PNG cannot land
by accident. Files that are not actually PNG (a renamed JPEG, an LFS pointer
checked out without LFS) are rejected with an actionable message rather than
silently skipped.

Reuses quantize.load_palette so palette.hex has exactly one parser. Pillow
only, no numpy. Pillow 12 deprecates Image.getdata, so pixels are read via
tobytes().

Usage:
    python3 tools/art/verify.py sprite.png
    python3 tools/art/verify.py packs/
    python3 tools/art/verify.py packs/ --grid 16
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image

import quantize

RGB = quantize.RGB
RGBA = tuple[int, int, int, int]


def _hex(rgba: tuple[int, ...]) -> str:
    return "#" + "".join(f"{channel:02x}" for channel in rgba)


def verify_image(image: Image.Image, palette: set[RGB], grid: int = 1) -> list[str]:
    """Return the problems in `image` (empty list means conformant)."""
    problems: list[str] = []
    width, height = image.size
    if grid < 1:
        raise ValueError(f"grid must be at least 1, got {grid}")
    if width % grid or height % grid:
        problems.append(f"size {width}x{height} is not a whole multiple of grid {grid}")

    rgba = image.convert("RGBA").tobytes()
    off_palette: dict[RGB, tuple[int, tuple[int, int]]] = {}
    partial_alpha: dict[RGBA, tuple[int, tuple[int, int]]] = {}
    for i in range(width * height):
        offset = i * 4
        r, g, b, a = rgba[offset], rgba[offset + 1], rgba[offset + 2], rgba[offset + 3]
        if a == 0:
            continue
        if a != 255:
            key = (r, g, b, a)
            bucket = partial_alpha
        elif (r, g, b) not in palette:
            key = (r, g, b)
            bucket = off_palette
        else:
            continue
        count, first = bucket.get(key, (0, (i % width, i // width)))
        bucket[key] = (count + 1, first)

    for rgb, (count, (x, y)) in sorted(off_palette.items()):
        problems.append(f"off-palette {_hex(rgb)}: {count} pixel(s), first at ({x}, {y})")
    for colour, (count, (x, y)) in sorted(partial_alpha.items()):
        problems.append(f"partial-alpha {_hex(colour)}: {count} pixel(s), first at ({x}, {y})")
    return problems


def iter_pngs(paths: list[Path]) -> list[Path]:
    """Expand arguments to the PNGs to check; warn on, and skip, missing paths."""
    pngs: list[Path] = []
    for path in paths:
        if path.is_dir():
            pngs.extend(sorted(path.rglob("*.png")))
        elif path.is_file():
            pngs.append(path)
        else:
            print(f"verify: {path}: no such file or directory; skipping", file=sys.stderr)
    return pngs


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Refuse art that is off-palette, has partial alpha, or is off-grid.",
    )
    parser.add_argument(
        "paths",
        nargs="+",
        type=Path,
        help="PNG files to check, or directories to check recursively for *.png",
    )
    parser.add_argument(
        "--grid",
        type=int,
        default=1,
        help="pixel grid the dimensions must be a whole multiple of (default 1)",
    )
    parser.add_argument(
        "--palette",
        type=Path,
        default=quantize.DEFAULT_PALETTE,
        help="palette .hex file (default: tools/art/palette.hex)",
    )
    args = parser.parse_args(argv)
    if args.grid < 1:
        parser.error("--grid must be at least 1")

    try:
        palette = quantize.load_palette(args.palette)
    except (OSError, ValueError) as error:
        print(f"verify: {error}", file=sys.stderr)
        return 2
    palette_set = set(palette)

    pngs = iter_pngs(args.paths)
    failed = 0
    for png in pngs:
        try:
            with Image.open(png) as image:
                if image.format != "PNG":
                    print(
                        f"verify: {png}: not a PNG (detected {image.format or 'unidentified'}) — "
                        "is Git LFS installed / was this checked out with LFS?",
                        file=sys.stderr,
                    )
                    failed += 1
                    continue
                problems = verify_image(image, palette_set, grid=args.grid)
        except (OSError, ValueError) as error:
            print(
                f"verify: {png}: {error} — not a readable PNG; "
                "is Git LFS installed / was this checked out with LFS?",
                file=sys.stderr,
            )
            failed += 1
            continue
        if problems:
            failed += 1
            print(f"{png}:")
            for problem in problems:
                print(f"  {problem}")

    if failed:
        noun = "file" if failed == 1 else "files"
        print(f"verify: {len(pngs)} image(s) checked, {failed} {noun} failed", file=sys.stderr)
        return 1
    print(f"verify: {len(pngs)} image(s) checked, all conformant")
    return 0


if __name__ == "__main__":
    sys.exit(main())
