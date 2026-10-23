#!/usr/bin/env python
"""Build optimized runtime UI art from source PNG assets."""

from __future__ import annotations

from pathlib import Path
import argparse

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
GENERATED_UI_SOURCES = {
    'route-map-frame': ('route-map-frame-source-v2.png', (1024, 500)),
    'reward-ceremony-backdrop': ('reward-ceremony-backdrop-source-v2.png', (1280, 640)),
}
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


def build_ui_icons(names: list[str] | None = None) -> None:
    for name, (filename, dimensions) in GENERATED_UI_SOURCES.items():
        if names is not None and name not in names:
            continue
        source = ROOT / 'assets' / 'concept-art' / 'ui' / 'icons' / 'sources' / filename
        with Image.open(source).convert('RGBA') as image:
            fitted = ImageOps.contain(image, dimensions, Image.Resampling.LANCZOS)
            canvas = Image.new('RGBA', dimensions, (0, 0, 0, 0))
            canvas.alpha_composite(fitted, ((dimensions[0] - fitted.width) // 2, (dimensions[1] - fitted.height) // 2))
            canvas.save(UI_ICON_ROOT / f'{name}.png', optimize=True)
    sources = sorted(UI_ICON_ROOT.glob("*.png"))
    if not sources:
        raise FileNotFoundError(f"No runtime UI icon PNG sources found in {rel(UI_ICON_ROOT)}")

    expected_names = {source.with_suffix(".webp").name for source in sources}
    stale = sorted(path for path in UI_ICON_ROOT.glob("*.webp") if path.name not in expected_names)
    if stale:
        names = ", ".join(rel(path) for path in stale)
        raise RuntimeError(f"Remove stale runtime UI WebP assets before rebuilding: {names}")

    if names is not None:
        missing = set(names) - {source.stem for source in sources}
        if missing:
            raise FileNotFoundError(f"Unknown UI icons: {', '.join(sorted(missing))}")
        sources = [source for source in sources if source.stem in names]

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


REVIEWED_RESIDENTS = ('marn-valeclip-v3', 'ivo-tallymast-v3', 'oren-shearbright-v3', 'caldra-pinion-v3', 'starling-shopkeeper-v2')


def build_signal_icon() -> None:
    source = ROOT / 'assets/concept-art/ui/route-map/route-node-icons-splash-v7/signal-splash-v7.png'
    target = ROOT / 'assets/runtime/map-icons/icons/signal.webp'
    with Image.open(source).convert('RGBA') as image:
        if image.width != image.height or image.getchannel('A').getextrema() != (0, 255):
            raise ValueError('Signal master must be square with genuine transparency')
        image.resize((384, 384), Image.Resampling.LANCZOS).save(target, 'WEBP', quality=90, method=6)


def build_resident(name: str) -> None:
    """Export a reviewed transparent resident without changing its proportions."""
    if name not in REVIEWED_RESIDENTS:
        raise ValueError(f'Unknown reviewed resident: {name}')
    market = name == 'starling-shopkeeper-v2'
    source = ROOT / 'assets' / 'concept-art' / ('market-kit/layers' if market else 'route-events') / f'{name}.png'
    target = ROOT / 'assets' / 'runtime' / ('market-kit' if market else 'route-events') / f'{name}.webp'
    with Image.open(source).convert('RGBA') as image:
        if image.getextrema()[3][0] != 0:
            raise ValueError('Resident source must have genuine transparency')
        image.thumbnail((768, 1024), Image.Resampling.LANCZOS)
        image.save(target, 'WEBP', quality=90, method=6)
    print(f'{rel(target)} ({size_kb(target):.1f} KB)')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--icons', nargs='+', help='Rebuild only these named UI icons.')
    parser.add_argument('--resident', help='Export one reviewed transparent resident.')
    parser.add_argument('--signal', action='store_true', help='Export the reviewed Signal route icon.')
    args = parser.parse_args()
    if args.signal:
        build_signal_icon()
        return
    if args.resident:
        build_resident(args.resident)
        return
    if args.icons:
        build_ui_icons(args.icons)
        return
    build_splash()
    build_leaders()
    build_ui_icons()
    build_title_preload_icons()
    build_signal_icon()
    for resident in REVIEWED_RESIDENTS:
        build_resident(resident)


if __name__ == "__main__":
    main()
