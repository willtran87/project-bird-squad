#!/usr/bin/env python
"""Build optimized runtime UI art from source PNG assets."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SPLASH_SOURCE = ROOT / "assets" / "splash" / "bird-squad-canal-run-splash-v11.png"
SPLASH_TARGETS = [
    ROOT / "assets" / "splash" / "bird-squad-canal-run-splash-v11-menu-pop.webp",
]
LEADER_ROOT = ROOT / "assets" / "runtime" / "flock" / "leaders"
UI_ICON_ROOT = ROOT / "assets" / "runtime" / "ui" / "icons"
TITLE_PRELOAD_ICON_ROOT = UI_ICON_ROOT / "title-preload"
UI_ICON_WEBP_QUALITY = 90
TITLE_PRELOAD_ICON_SIZE = 128
TITLE_PRELOAD_ICON_NAMES = [
    "ascension-medallion",
    "audio-toggle-medallion",
    "audio-toggle-pulse-ring",
    "audio-toggle-wave-burst",
    "codex-medallion",
    "help-medallion",
    "leader-lock-medallion",
    "leader-ready-medallion",
    "leader-select-medallion",
    "record-medallion",
    "settings-medallion",
    "start-run-medallion",
]


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


def build_ui_icons() -> None:
    sources = sorted(UI_ICON_ROOT.glob("*.png"))
    if not sources:
        raise FileNotFoundError(f"No runtime UI icon PNG sources found in {rel(UI_ICON_ROOT)}")

    expected_names = {source.with_suffix(".webp").name for source in sources}
    stale = sorted(path for path in UI_ICON_ROOT.glob("*.webp") if path.name not in expected_names)
    if stale:
        names = ", ".join(rel(path) for path in stale)
        raise RuntimeError(f"Remove stale runtime UI WebP assets before rebuilding: {names}")

    source_bytes = 0
    target_bytes = 0
    for source in sources:
        target = source.with_suffix(".webp")
        with Image.open(source).convert("RGBA") as image:
            source_bytes += source.stat().st_size
            image.save(target, "WEBP", quality=UI_ICON_WEBP_QUALITY, method=4)
        target_bytes += target.stat().st_size

    reduction = (1 - target_bytes / source_bytes) * 100 if source_bytes else 0
    print(
        f"Built {len(sources)} runtime UI WebPs: "
        f"{source_bytes / 1024 / 1024:.2f} MB -> {target_bytes / 1024 / 1024:.2f} MB "
        f"({reduction:.1f}% smaller)."
    )


def build_title_preload_icons() -> None:
    """Build compact first-paint copies of medallions shown at 34px or less."""
    TITLE_PRELOAD_ICON_ROOT.mkdir(parents=True, exist_ok=True)
    expected_names = {f"{name}-title-preload.webp" for name in TITLE_PRELOAD_ICON_NAMES}
    stale = sorted(
        path for path in TITLE_PRELOAD_ICON_ROOT.glob("*.webp")
        if path.name not in expected_names
    )
    if stale:
        for path in stale:
            if path.parent != TITLE_PRELOAD_ICON_ROOT:
                raise RuntimeError(f"Refusing to remove title preload outside output root: {rel(path)}")
            path.unlink()
        print(f"Removed {len(stale)} stale generated title preload asset(s).")

    source_pixels = 0
    target_pixels = 0
    target_bytes = 0
    for name in TITLE_PRELOAD_ICON_NAMES:
        source = UI_ICON_ROOT / f"{name}.png"
        target = TITLE_PRELOAD_ICON_ROOT / f"{name}-title-preload.webp"
        if not source.exists():
            raise FileNotFoundError(f"Missing title preload source: {rel(source)}")
        with Image.open(source).convert("RGBA") as image:
            source_pixels += image.width * image.height
            image.thumbnail(
                (TITLE_PRELOAD_ICON_SIZE, TITLE_PRELOAD_ICON_SIZE),
                Image.Resampling.LANCZOS,
            )
            target_pixels += image.width * image.height
            image.save(target, "WEBP", quality=UI_ICON_WEBP_QUALITY, method=6)
        target_bytes += target.stat().st_size

    reduction = (1 - target_pixels / source_pixels) * 100 if source_pixels else 0
    print(
        f"Built {len(TITLE_PRELOAD_ICON_NAMES)} compact title icons: "
        f"{source_pixels:,} -> {target_pixels:,} pixels ({reduction:.1f}% fewer), "
        f"{target_bytes / 1024:.1f} KB."
    )


def main() -> None:
    build_splash()
    build_leaders()
    build_ui_icons()
    build_title_preload_icons()


if __name__ == "__main__":
    main()
