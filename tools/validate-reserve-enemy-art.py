#!/usr/bin/env python
"""Validate generated reserve enemy transparent cutouts."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
CONTRACT_PATH = ROOT / "data" / "game" / "enemy-variety-contracts.json"
ART_ROOT = ROOT / ".generated" / "imagegen" / "enemies" / "reserve-selected"
MIN_EDGE = 1024


def main() -> int:
    contract = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
    ids = [enemy["id"] for enemy in contract["reserveEnemies"]]
    errors: list[str] = []
    generated = 0

    for enemy_id in ids:
        path = ART_ROOT / f"{enemy_id}-transparent.png"
        if not path.exists():
            errors.append(f"{enemy_id}: missing {path.relative_to(ROOT).as_posix()}")
            continue

        generated += 1
        with Image.open(path) as image:
            image = image.convert("RGBA")
            if image.size[0] < MIN_EDGE or image.size[1] < MIN_EDGE:
                errors.append(f"{enemy_id}: expected both dimensions >= {MIN_EDGE}, found {image.size}")
            width, height = image.size
            corners = [
                image.getpixel((0, 0))[3],
                image.getpixel((width - 1, 0))[3],
                image.getpixel((0, height - 1))[3],
                image.getpixel((width - 1, height - 1))[3],
            ]
            if corners != [0, 0, 0, 0]:
                errors.append(f"{enemy_id}: corner alpha values are {corners}, expected all 0")
            alpha_hist = image.getchannel("A").histogram()
            if alpha_hist[0] == 0:
                errors.append(f"{enemy_id}: no fully transparent pixels found")
            if sum(alpha_hist[251:]) == 0:
                errors.append(f"{enemy_id}: no fully opaque subject pixels found")

    print(f"Reserve enemy transparent art present: {generated}/{len(ids)}")
    if errors:
        print(f"Reserve enemy art validation failed with {len(errors)} issue(s):", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print("Reserve enemy art validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
