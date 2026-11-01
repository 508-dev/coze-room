#!/usr/bin/env python3
"""Downsample a generated image to its pixel grid and snap it to the palette.

The deterministic middle of the art pipeline (see tools/art/README.md). It
turns a diffusion model's high-resolution *picture of* pixel art into actual
pixel art on a real grid:

1. Nearest-neighbour downsample: keep the centre pixel of every CELL x CELL
   block. PixelArtRedmond draws one fake pixel per 16x16 block, aligned to the
   top-left corner, so the default cell is 16.
2. Snap every pixel to the nearest palette colour (squared RGB distance; ties
   go to the earlier palette entry). No dithering.
3. Alpha is a hard cutoff: every pixel ends up fully opaque or fully
   transparent.

The output is an indexed PNG. Its palette is palette.hex in file order, then
one fully transparent entry, so LibreSprite opens it in indexed mode with
exactly the project palette loaded.

The same input and arguments always produce byte-identical output.

Usage:
    python3 tools/art/quantize.py IN.png OUT.png [--cell 16]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
DEFAULT_PALETTE = HERE / "palette.hex"

RGB = tuple[int, int, int]


def load_palette(path: Path) -> list[RGB]:
    """Read a Lospec-style .hex file: one RRGGBB per line, no '#'."""
    colours: list[RGB] = []
    for number, raw in enumerate(path.read_text().splitlines(), start=1):
        line = raw.strip()
        if not line:
            continue
        try:
            if len(line) != 6:
                raise ValueError
            colours.append((int(line[0:2], 16), int(line[2:4], 16), int(line[4:6], 16)))
        except ValueError:
            raise ValueError(f"{path}:{number}: not an RRGGBB colour: {line!r}") from None
    if not colours:
        raise ValueError(f"{path}: no colours")
    if len(colours) > 255:
        raise ValueError(f"{path}: {len(colours)} colours; at most 255 fit beside transparency")
    return colours


def quantize(image: Image.Image, palette: list[RGB], cell: int = 16, alpha_threshold: int = 128) -> Image.Image:
    """Return an indexed image at 1/cell scale using only `palette` plus one transparent index."""
    width, height = image.size
    if cell < 1:
        raise ValueError(f"cell must be at least 1, got {cell}")
    if width % cell or height % cell:
        raise ValueError(
            f"{width}x{height} is not a whole number of {cell}px cells; "
            f"generate at a multiple of {cell} (see tools/art/PROMPTS.md)"
        )

    rgba = image.convert("RGBA").tobytes()
    transparent = len(palette)
    nearest: dict[RGB, int] = {}

    def snap(rgb: RGB) -> int:
        if rgb not in nearest:
            r, g, b = rgb
            nearest[rgb] = min(
                range(len(palette)),
                key=lambda i: (palette[i][0] - r) ** 2 + (palette[i][1] - g) ** 2 + (palette[i][2] - b) ** 2,
            )
        return nearest[rgb]

    out_w, out_h = width // cell, height // cell
    centre = cell // 2
    indices = bytearray(out_w * out_h)
    for y in range(out_h):
        for x in range(out_w):
            offset = 4 * ((y * cell + centre) * width + x * cell + centre)
            r, g, b, a = rgba[offset : offset + 4]
            indices[y * out_w + x] = snap((r, g, b)) if a >= alpha_threshold else transparent

    out = Image.frombytes("P", (out_w, out_h), bytes(indices))
    out.putpalette([channel for colour in [*palette, (0, 0, 0)] for channel in colour], rawmode="RGB")
    out.info["transparency"] = transparent
    return out


def save(image: Image.Image, path: Path) -> None:
    """Write the PNG with fixed settings and no metadata, so output is byte-stable."""
    image.save(path, format="PNG", optimize=False, compress_level=9, transparency=image.info["transparency"])


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Downsample a generated image to its pixel grid and snap it to the palette.",
    )
    parser.add_argument("input", type=Path, help="generated image, e.g. /var/lib/comfyui/output/dormouse/gen_00001_.png")
    parser.add_argument("output", type=Path, help="where to write the indexed PNG")
    parser.add_argument(
        "--cell",
        type=int,
        default=16,
        help="source pixels per true pixel (default 16, PixelArtRedmond's grid; use 1 to re-snap a finished sprite)",
    )
    parser.add_argument("--palette", type=Path, default=DEFAULT_PALETTE, help="palette .hex file (default: tools/art/palette.hex)")
    parser.add_argument(
        "--alpha-threshold",
        type=int,
        default=128,
        help="alpha at or above this is opaque, below is transparent (default 128)",
    )
    args = parser.parse_args(argv)

    try:
        palette = load_palette(args.palette)
        with Image.open(args.input) as image:
            result = quantize(image, palette, cell=args.cell, alpha_threshold=args.alpha_threshold)
    except (OSError, ValueError) as error:
        print(f"quantize: {error}", file=sys.stderr)
        return 2

    save(result, args.output)
    print(f"{args.input} -> {args.output} ({result.width}x{result.height})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
