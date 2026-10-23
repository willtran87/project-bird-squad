"""Reproducible, non-mutating review sheets for every approved runtime card.

Each tile shows the shipped thumbnail at gallery, hand and compact-hand scale.
Uses the existing alpha-correct contact-sheet font/compositing conventions.
The output is evidence, never an automatic artistic approval.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("contact", ROOT / "tools/make-minor-contact-sheets.py")
contact = importlib.util.module_from_spec(spec)
spec.loader.exec_module(contact)


def build(output: Path) -> dict:
    manifest_path = ROOT / "assets/runtime/cards/card-art-manifest.json"
    cards = sorted((c for c in json.loads(manifest_path.read_text(encoding="utf-8"))["cards"]
                    if c["status"] == "approved"), key=lambda c: c["cardId"])
    ids = [c["cardId"] for c in cards]
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate approved card IDs")
    definitions = {c["id"]: c for c in json.loads((ROOT / "data/game/alpha-cards.json").read_text(encoding="utf-8"))["cards"]}
    if set(ids) != set(definitions):
        raise ValueError("Approved art and runtime card IDs differ")
    output.mkdir(parents=True, exist_ok=True)
    entries = []
    font = contact.load_font(14)
    for start in range(0, len(cards), 8):
        batch = cards[start:start + 8]
        sheet_name = f"cards-{start + 1:03d}-{start + len(batch):03d}.png"
        sheet = Image.new("RGB", (1040, 660), (8, 15, 24))
        draw = ImageDraw.Draw(sheet)
        draw.text((12, 9), "Canonical gallery 164x246 | hand 60x90 | compact hand 47x70 — shipped pixels, no crop", fill="#d9e9ef", font=font)
        for index, card in enumerate(batch):
            x, y = 12 + index % 4 * 258, 36 + index // 4 * 310
            source = ROOT / card["thumbnail"]
            with Image.open(source) as loaded:
                rgba = loaded.convert("RGBA")
                for dx, dy, size in [(0, 0, (164, 246)), (176, 0, (60, 90)), (176, 118, (47, 70))]:
                    resized = ImageOps.contain(rgba, size, Image.Resampling.LANCZOS)
                    tile = Image.new("RGBA", size, (8, 10, 18, 255))
                    tile.alpha_composite(resized, ((size[0] - resized.width) // 2, (size[1] - resized.height) // 2))
                    sheet.paste(tile.convert("RGB"), (x + dx, y + dy))
                draw.text((x, y + 251), card["cardId"], fill="#ffe1a3", font=font)
                draw.text((x, y + 269), definitions[card["cardId"]]["displayName"], fill="#d9e9ef", font=font)
                entries.append({"cardId": card["cardId"], "name": definitions[card["cardId"]]["displayName"],
                    "bird": definitions[card["cardId"]].get("bird"), "sheet": sheet_name,
                    "row": index // 4 + 1, "column": index % 4 + 1,
                    "thumbnail": card["thumbnail"], "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                    "dimensions": list(loaded.size), "source": card["source"]})
        sheet.save(output / sheet_name)
    index = {"schema": 1, "manifestSha256": hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
             "scales": [[164, 246], [60, 90], [47, 70]], "cards": entries}
    (output / "index.json").write_text(json.dumps(index, indent=2) + "\n", encoding="utf-8")
    return index


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    result = build(args.output.resolve())
    print(f"Wrote {len(result['cards'])} card reviews at three gameplay scales to {args.output.resolve()}")
