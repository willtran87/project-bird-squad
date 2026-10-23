#!/usr/bin/env python
"""Build compact runtime item art without modifying the full source tier."""

from __future__ import annotations

from pathlib import Path
import json

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ITEM_GROUPS = ("supplies", "waymarks")
COMPACT_EDGE = 256
SCRAP_EDGE = 96
WEBP_QUALITY = 88


def build_selected_masters() -> None:
    """Keep reviewed repairs reproducible before generating their compact tier."""
    manifest = ROOT / 'docs/art/item-art-repairs.json'
    if not manifest.exists():
        return
    items = json.loads(manifest.read_text(encoding='utf-8'))['items']
    for item in items:
        if item['group'] not in ITEM_GROUPS:
            raise ValueError(f"Unknown item group: {item['group']}")
        expected = f"assets/runtime/{item['group']}/icons/{item['id']}.webp"
        if item['export'] != expected or not (ROOT / item['source']).is_file():
            raise ValueError(f"Invalid reviewed item master: {item['id']}")
    for item in items:
        with Image.open(ROOT / item['source']).convert('RGBA') as image:
            if image.width != image.height or image.getchannel('A').getextrema() != (0, 255):
                raise ValueError(f"Item master must be square with genuine alpha: {item['id']}")
            image.resize((512, 512), Image.Resampling.LANCZOS).save(
                ROOT / item['export'], 'WEBP', quality=90, method=6)


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def size_kb(path: Path) -> float:
    return path.stat().st_size / 1024


def build_group(group: str) -> tuple[int, int, int]:
    source_dir = ROOT / "assets" / "runtime" / group / "icons"
    target_dir = ROOT / "assets" / "runtime" / group / "thumb"
    sources = sorted(source_dir.glob("*.webp"))
    if not sources:
        raise FileNotFoundError(f"No item art found in {rel(source_dir)}")

    target_dir.mkdir(parents=True, exist_ok=True)
    expected_names = {source.name for source in sources}
    stale = sorted(path for path in target_dir.glob("*.webp") if path.name not in expected_names)
    if stale:
        names = ", ".join(rel(path) for path in stale)
        raise RuntimeError(f"Remove stale compact item art before rebuilding: {names}")

    source_bytes = 0
    target_bytes = 0
    for source in sources:
        target = target_dir / source.name
        edge = SCRAP_EDGE if group == "supplies" and source.name == "scrap.webp" else COMPACT_EDGE
        with Image.open(source).convert("RGBA") as image:
            source_bytes += source.stat().st_size
            image.thumbnail((edge, edge), Image.Resampling.LANCZOS)
            image.save(target, "WEBP", quality=WEBP_QUALITY, method=4)
        target_bytes += target.stat().st_size
        print(f"{rel(target)} ({edge}px, {size_kb(target):.1f} KB)")

    return len(sources), source_bytes, target_bytes


def main() -> None:
    build_selected_masters()
    count = 0
    source_bytes = 0
    target_bytes = 0
    for group in ITEM_GROUPS:
        group_count, group_source_bytes, group_target_bytes = build_group(group)
        count += group_count
        source_bytes += group_source_bytes
        target_bytes += group_target_bytes

    reduction = (1 - target_bytes / source_bytes) * 100 if source_bytes else 0
    print(
        f"Built {count} compact item textures: "
        f"{source_bytes / 1024:.1f} KB -> {target_bytes / 1024:.1f} KB "
        f"({reduction:.1f}% smaller)."
    )


if __name__ == "__main__":
    main()
