"""Tests for verify.py. Run: python3 -m unittest discover -s tools/art"""

import io
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

from PIL import Image

import quantize
import verify

PALETTE = quantize.load_palette(quantize.DEFAULT_PALETTE)
PALETTE_SET = set(PALETTE)


def rgba_image(rows: list[list[tuple]]) -> Image.Image:
    """Build an RGBA image from rows of (r, g, b, a) pixels."""
    height, width = len(rows), len(rows[0])
    data = bytearray()
    for row in rows:
        for pixel in row:
            data.extend(pixel)
    return Image.frombytes("RGBA", (width, height), bytes(data))


class VerifyImageTest(unittest.TestCase):
    def test_conformant_image_has_no_problems(self):
        rows = [
            [(*PALETTE[0], 255), (*PALETTE[1], 255)],
            [(*PALETTE[2], 255), (0, 0, 0, 0)],
        ]
        self.assertEqual(verify.verify_image(rgba_image(rows), PALETTE_SET), [])

    def test_reports_off_palette_colour_with_count_and_first_coordinate(self):
        off = (255, 0, 0, 255)
        rows = [[(*PALETTE[0], 255), off], [off, off]]
        problems = verify.verify_image(rgba_image(rows), PALETTE_SET)
        self.assertEqual(problems, ["off-palette #ff0000: 3 pixel(s), first at (1, 0)"])

    def test_reports_partial_alpha_with_rgba_hex(self):
        rows = [[(*PALETTE[0], 128)]]
        problems = verify.verify_image(rgba_image(rows), PALETTE_SET)
        self.assertEqual(problems, ["partial-alpha #30353a80: 1 pixel(s), first at (0, 0)"])

    def test_transparent_pixels_are_not_checked(self):
        # A transparent pixel may hold any RGB; only alpha matters.
        rows = [[(255, 0, 0, 0)]]
        self.assertEqual(verify.verify_image(rgba_image(rows), PALETTE_SET), [])

    def test_rejects_off_grid_dimensions(self):
        conformant = Image.new("RGBA", (32, 16), (*PALETTE[0], 255))
        self.assertEqual(verify.verify_image(conformant, PALETTE_SET, grid=16), [])
        off_grid = Image.new("RGBA", (20, 16), (*PALETTE[0], 255))
        self.assertEqual(
            verify.verify_image(off_grid, PALETTE_SET, grid=16),
            ["size 20x16 is not a whole multiple of grid 16"],
        )

    def test_default_grid_accepts_any_dimension(self):
        image = Image.new("RGBA", (17, 3), (*PALETTE[0], 255))
        self.assertEqual(verify.verify_image(image, PALETTE_SET), [])


class VerifyCliTest(unittest.TestCase):
    def test_reports_every_offending_file_and_exits_nonzero(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            Image.new("RGBA", (2, 2), (*PALETTE[0], 255)).save(root / "good.png")
            Image.new("RGBA", (2, 2), (255, 0, 0, 255)).save(root / "red.png")
            Image.new("RGBA", (2, 2), (0, 0, 255, 255)).save(root / "blue.png")

            out = io.StringIO()
            with redirect_stdout(out):
                code = verify.main([str(root)])

            text = out.getvalue()
            self.assertEqual(code, 1)
            self.assertIn("red.png", text)
            self.assertIn("off-palette #ff0000", text)
            self.assertIn("blue.png", text)
            self.assertIn("off-palette #0000ff", text)
            self.assertNotIn("good.png", text)

    def test_passes_on_empty_directory(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = io.StringIO()
            with redirect_stdout(out):
                code = verify.main([tmp])
            self.assertEqual(code, 0)

    def test_skips_a_missing_path(self):
        with tempfile.TemporaryDirectory() as tmp:
            missing = Path(tmp) / "packs"
            out, err = io.StringIO(), io.StringIO()
            with redirect_stdout(out), redirect_stderr(err):
                code = verify.main([str(missing)])
            self.assertEqual(code, 0)
            self.assertIn("skipping", err.getvalue())


if __name__ == "__main__":
    unittest.main()
