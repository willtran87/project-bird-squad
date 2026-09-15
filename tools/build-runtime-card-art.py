#!/usr/bin/env python
"""Build runtime card art from tarot masters.

Generated/source masters are copied into `.generated`; optimized WebP runtime
assets are written to `assets/runtime/cards`.
"""

from __future__ import annotations

import json
import argparse
import re
import shutil
from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "assets" / "runtime" / "cards" / "card-art-manifest.json"
GENERATED_ROOT = ROOT / ".generated" / "imagegen" / "tarot" / "selected"
PORTRAIT_ROOT = ROOT / "assets" / "runtime" / "cards" / "portrait"
THUMB_ROOT = ROOT / "assets" / "runtime" / "cards" / "thumb"
ICON_ROOT = ROOT / "assets" / "runtime" / "cards" / "icon"


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def copy_master(card_id: str, source: str) -> Path:
    source_path = ROOT / source
    if not source_path.exists():
        raise FileNotFoundError(f"Missing source for {card_id}: {source}")
    # A later bulk export must not collapse versioned provenance back onto the
    # legacy card-id master or overwrite the retained original.
    if source_path.resolve().parent == GENERATED_ROOT.resolve():
        return source_path
    GENERATED_ROOT.mkdir(parents=True, exist_ok=True)
    target = GENERATED_ROOT / f"{card_id}.png"
    if source_path.resolve() != target.resolve():
        shutil.copy2(source_path, target)
    return target


def save_webp(image: Image.Image, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target, "WEBP", lossless=True, method=6)


def build_card_assets(master: Path, card_id: str) -> dict[str, str]:
    with Image.open(master).convert("RGBA") as image:
        portrait = ImageOps.contain(image, (512, 768), Image.Resampling.LANCZOS)
        thumb = ImageOps.contain(image, (184, 276), Image.Resampling.LANCZOS)
        icon = ImageOps.fit(image, (128, 128), Image.Resampling.LANCZOS, centering=(0.5, 0.38))

        portrait_path = PORTRAIT_ROOT / f"{card_id}.webp"
        thumb_path = THUMB_ROOT / f"{card_id}.webp"
        icon_path = ICON_ROOT / f"{card_id}.webp"
        save_webp(portrait, portrait_path)
        save_webp(thumb, thumb_path)
        save_webp(icon, icon_path)
        return {
            "portrait": rel(portrait_path),
            "thumbnail": rel(thumb_path),
            "icon": rel(icon_path),
        }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--card-id', action='append', default=[], help='Build only named approved cards; repeat for a small batch.')
    parser.add_argument('--source', type=Path, help='Versioned master for exactly one --card-id; preserve it as manifest provenance.')
    args = parser.parse_args()
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    approved = {entry['cardId'] for entry in manifest.get('cards', []) if entry.get('status') == 'approved'}
    unknown = set(args.card_id) - approved
    if unknown:
        parser.error(f'Unknown or unapproved card ids: {sorted(unknown)}')
    master_override = None
    if args.source:
        if len(set(args.card_id)) != 1:
            parser.error('--source requires exactly one --card-id')
        master_override = (ROOT / args.source).resolve()
        if (master_override.parent != ROOT / '.generated/imagegen/tarot/selected'
                or not re.fullmatch(r'[a-z0-9_]+\.png', master_override.name)
                or not master_override.is_file()):
            parser.error('--source must be an existing selected tarot PNG with a lowercase/underscore filename')
    built = 0
    for entry in manifest.get("cards", []):
        if entry.get("status") != "approved":
            continue
        if args.card_id and entry['cardId'] not in args.card_id:
            continue
        source = entry.get("source")
        if not isinstance(source, str):
            raise ValueError(f"{entry.get('cardId')}: approved card requires source")
        card_id = entry["cardId"]
        master = master_override or copy_master(card_id, source)
        paths = build_card_assets(master, card_id)
        entry["source"] = rel(master)
        entry.update(paths)
        built += 1

    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Built {built} card runtime asset sets.")
    print(rel(MANIFEST_PATH))


if __name__ == "__main__":
    main()
