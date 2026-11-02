import copy
import json
import unittest

from build_manifest import PACK, build_manifest


class ManifestTests(unittest.TestCase):
    def setUp(self):
        self.art = json.loads((PACK / "art.json").read_text())

    def test_contract_and_files(self):
        result = build_manifest(self.art)
        self.assertEqual(result["room"]["size"], [128, 72])
        self.assertEqual(result["sections"]["tv"]["screen"], list(self.art["tvScreen"].values()))
        self.assertEqual(len(result["sections"]["occupants"]["sprites"]), 32)
        self.assertEqual(result, build_manifest(copy.deepcopy(self.art)))
        files = [result["room"]["background"], *result["room"]["windowViews"].values(),
                 *result["sections"]["occupants"]["sprites"]]
        files += [file for bed in result["sections"]["audio"]["beds"].values() for file in bed.values()]
        for file in files:
            self.assertTrue((PACK / file).is_file(), file)

    def test_coordinates_follow_art_changes(self):
        self.art["seats"]["hammock"]["anchor"]["x"] = 91
        self.art["guestbook"] = dict(x=10, y=20, width=8, height=6)
        result = build_manifest(self.art)["sections"]
        self.assertEqual(result["occupants"]["seats"]["hammock"]["anchor"][0], 91)
        self.assertEqual(result["guestbook"]["spot"], [14, 23])

    def test_rejects_incomplete_sprite_matrix(self):
        del self.art["occupants"][next(iter(self.art["occupants"]))]
        with self.assertRaises(ValueError):
            build_manifest(self.art)

    def test_rejects_out_of_room_metadata(self):
        self.art["tvScreen"]["width"] = 999
        with self.assertRaises(ValueError):
            build_manifest(self.art)
