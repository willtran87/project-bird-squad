from __future__ import annotations

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
FX_ROOT = ROOT / "assets" / "runtime" / "fx"
WEBP_QUALITY = 90


def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def main() -> None:
    sources = sorted(FX_ROOT.glob("*.png"))
    if not sources:
        raise FileNotFoundError(f"No runtime FX PNG sources found in {relative(FX_ROOT)}")

    expected_names = {source.with_suffix(".webp").name for source in sources}
    stale = sorted(path for path in FX_ROOT.glob("*.webp") if path.name not in expected_names)
    if stale:
        names = ", ".join(relative(path) for path in stale)
        raise RuntimeError(f"Remove stale runtime FX WebPs before rebuilding: {names}")

    source_bytes = 0
    target_bytes = 0
    for source in sources:
        target = source.with_suffix(".webp")
        with Image.open(source).convert("RGBA") as image:
            size = image.size
            image.save(target, "WEBP", quality=WEBP_QUALITY, method=4)
        with Image.open(target) as built:
            if built.size != size:
                raise RuntimeError(f"{relative(target)} changed dimensions from {size} to {built.size}")
            if "A" not in built.getbands():
                raise RuntimeError(f"{relative(target)} lost its alpha channel")
        source_bytes += source.stat().st_size
        target_bytes += target.stat().st_size

    reduction = (1 - target_bytes / source_bytes) * 100 if source_bytes else 0
    print(
        f"Built {len(sources)} runtime FX WebPs: "
        f"{source_bytes / 1024 / 1024:.2f} MB -> {target_bytes / 1024 / 1024:.2f} MB "
        f"({reduction:.1f}% smaller)"
    )


if __name__ == "__main__":
    main()
