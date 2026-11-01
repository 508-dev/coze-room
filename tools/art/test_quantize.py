"""Tests for quantize.py. Run: python3 -m unittest discover -s tools/art"""

import io
import tempfile
import unittest
from pathlib import Path

from PIL import Image

import quantize

PALETTE = quantize.load_palette(quantize.DEFAULT_PALETTE)


def png_bytes(image: Image.Image) -> bytes:
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "out.png"
        quantize.save(image, path)
        return path.read_bytes()


def indices(image: Image.Image) -> list[int]:
    """Palette index of every pixel of an indexed image, row by row."""
    return list(image.tobytes())


def rgba_pixels(png: bytes) -> list[tuple[int, ...]]:
    data = Image.open(io.BytesIO(png)).convert("RGBA").tobytes()
    return [tuple(data[i : i + 4]) for i in range(0, len(data), 4)]


def cells(colours: list[list[tuple]], cell: int = 16, edge=(255, 0, 255, 255)) -> Image.Image:
    """Build an image of cell x cell blocks with a garish 1px border around each, like a soft LoRA edge."""
    image = Image.new("RGBA", (len(colours[0]) * cell, len(colours) * cell), edge)
    for y, row in enumerate(colours):
        for x, colour in enumerate(row):
            image.paste(colour, (x * cell + 1, y * cell + 1, (x + 1) * cell - 1, (y + 1) * cell - 1))
    return image


class PaletteTest(unittest.TestCase):
    def test_atropoeia_has_48_unique_colours(self):
        self.assertEqual(len(PALETTE), 48)
        self.assertEqual(len(set(PALETTE)), 48)
        self.assertEqual(PALETTE[0], (0x30, 0x35, 0x3A))
        self.assertEqual(PALETTE[-1], (0xB3, 0x97, 0x97))

    def test_rejects_malformed_lines(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "bad.hex"
            path.write_text("30353a\n#404949\n")
            with self.assertRaisesRegex(ValueError, ":2:"):
                quantize.load_palette(path)


class QuantizeTest(unittest.TestCase):
    def test_samples_cell_centres_not_edges(self):
        a, b = (*PALETTE[3], 255), (*PALETTE[20], 255)
        out = quantize.quantize(cells([[a, b], [b, a]]), PALETTE)
        self.assertEqual(out.size, (2, 2))
        self.assertEqual(indices(out), [3, 20, 20, 3])

    def test_snaps_off_palette_colours_to_nearest(self):
        out = quantize.quantize(Image.new("RGB", (16, 16), (0, 0, 0)), PALETTE)
        self.assertEqual(PALETTE[indices(out)[0]], (0x1F, 0x19, 0x19))

    def test_alpha_is_a_hard_cutoff(self):
        image = cells([[(*PALETTE[5], 127), (*PALETTE[5], 128)]])
        out = quantize.quantize(image, PALETTE)
        self.assertEqual(indices(out), [48, 5])
        self.assertEqual({a for *_, a in rgba_pixels(png_bytes(out))}, {0, 255})

    def test_every_opaque_pixel_is_a_palette_colour(self):
        noise = Image.effect_noise((64, 64), 100).convert("RGB")
        for r, g, b, a in rgba_pixels(png_bytes(quantize.quantize(noise, PALETTE))):
            self.assertIn((r, g, b), PALETTE)
            self.assertEqual(a, 255)

    def test_output_is_byte_identical_across_runs(self):
        noise = Image.effect_noise((128, 96), 80).convert("RGB")
        self.assertEqual(png_bytes(quantize.quantize(noise, PALETTE)), png_bytes(quantize.quantize(noise, PALETTE)))

    def test_rejects_sizes_that_are_not_whole_cells(self):
        with self.assertRaisesRegex(ValueError, "not a whole number of 16px cells"):
            quantize.quantize(Image.new("RGB", (1000, 1000)), PALETTE)

    def test_cell_of_one_resnaps_a_finished_sprite(self):
        out = quantize.quantize(Image.new("RGB", (28, 28), PALETTE[7]), PALETTE, cell=1)
        self.assertEqual(out.size, (28, 28))
        self.assertEqual(set(indices(out)), {7})


if __name__ == "__main__":
    unittest.main()
