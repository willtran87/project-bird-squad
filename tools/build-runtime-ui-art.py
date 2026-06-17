#!/usr/bin/env python
"""Build optimized runtime UI art from source PNG assets."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SPLASH_SOURCE = ROOT / "assets" / "splash" / "bird-squad-canal-run-splash-v4.png"
SPLASH_TARGETS = [
    ROOT / "assets" / "splash" / "bird-squad-canal-run-splash-v4.webp",
    ROOT / "assets" / "splash" / "bird-squad-canal-run-splash-v4-menu-pop.webp",
]
LEADER_ROOT = ROOT / "assets" / "runtime" / "flock" / "leaders"


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def size_kb(path: Path) -> float:
    return path.stat().st_size / 1024


def build_splash() -> None:
    if not SPLASH_SOURCE.exists():
        raise FileNotFoundError(f"Missing splash source: {rel(SPLASH_SOURCE)}")

    with Image.open(SPLASH_SOURCE).convert("RGB") as image:
        splash = ImageOps.fit(image, (1280, 720), Image.Resampling.LANCZOS, centering=(0.5, 0.5))
        for target in SPLASH_TARGETS:
            splash.save(target, "WEBP", quality=82, method=6)
            print(f"{rel(target)} ({size_kb(target):.1f} KB)")


def build_leaders() -> None:
    sources = sorted(LEADER_ROOT.glob("*.png"))
    if not sources:
        raise FileNotFoundError(f"No leader PNG sources found in {rel(LEADER_ROOT)}")

    for source in sources:
        target = source.with_suffix(".webp")
        with Image.open(source).convert("RGBA") as image:
            image.thumbnail((768, 768), Image.Resampling.LANCZOS)
            image.save(target, "WEBP", lossless=True, method=6)
        print(f"{rel(target)} ({size_kb(target):.1f} KB)")


def main() -> None:
    build_splash()
    build_leaders()


if __name__ == "__main__":
    main()
