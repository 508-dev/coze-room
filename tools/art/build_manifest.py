"""Build the public pack contract from the artist-owned coordinates. No dependencies."""

import argparse
import json
from pathlib import Path

PACK = Path(__file__).resolve().parents[2] / "packs/dormouse-v0"


def build_manifest(art):
    width, height = art["imageSize"]["width"], art["imageSize"]["height"]

    def point(value):
        return [value["x"], value["y"]]

    def box(value):
        result = [*point(value), value["width"], value["height"]]
        x, y, w, h = result
        if not all(type(n) is int for n in result) or min(x, y) < 0 or min(w, h) <= 0:
            raise ValueError("invalid rectangle")
        if x + w > width or y + h > height:
            raise ValueError("rectangle outside room")
        return result

    seats = {
        seat: {"anchor": point(data["anchor"]), "pose": data["pose"]}
        for seat, data in art["seats"].items()
    }
    sprites = {}
    for file, data in art["occupants"].items():
        if data["seat"] not in seats or data["state"] not in ("awake", "asleep"):
            raise ValueError("unknown seat or state")
        if not 0 < data["breathRow"] < height:
            raise ValueError("breathRow outside room")
        sprites[file] = {**data, "headBox": box(data["headBox"])}
    looks = sorted({data["look"] for data in sprites.values()})
    combinations = {(s["seat"], s["look"], s["state"]) for s in sprites.values()}
    if len(sprites) != len(seats) * len(looks) * 2 or len(combinations) != len(sprites):
        raise ValueError("expected one awake/asleep sprite per seat and look")
    book_x, book_y, book_w, book_h = box(art["guestbook"])
    return {
        "id": "dormouse-v0",
        "version": 1,
        "room": {
            "size": [width, height],
            "background": art["files"]["windowCutout"],
            "windowViews": art["files"]["views"],
        },
        "sections": {
            "occupants": {"looks": looks, "seats": seats, "sprites": sprites},
            "tv": {"screen": box(art["tvScreen"])},
            "guestbook": {"spot": [book_x + book_w // 2, book_y + book_h // 2]},
            "audio": {"beds": {
                env: {ext: f"audio/{env}.{ext}" for ext in ("ogg", "m4a")}
                for env in art["files"]["views"]
            }},
            "environment": {"glass": [box(rect) for rect in art["windowGlass"]]},
        },
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail if committed output is stale")
    args = parser.parse_args()
    manifest = build_manifest(json.loads((PACK / "art.json").read_text()))
    output = json.dumps(manifest, indent=2) + "\n"
    target = PACK / "manifest.json"
    if args.check:
        if not target.exists() or target.read_text() != output:
            raise SystemExit("manifest.json is stale; run bun run art:manifest")
    else:
        target.write_text(output)


if __name__ == "__main__":
    main()
