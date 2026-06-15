from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path.cwd()
DEFAULT_MANIFEST = Path("assets/templates/minor-arcana/raster-border-templates/template-manifest.json")
KEY = (0, 255, 0)


def load_manifest(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def parse_color(value: str) -> tuple[int, int, int]:
    raw = value.strip().lstrip("#")
    if len(raw) != 6:
        raise argparse.ArgumentTypeError("color must be a 6-digit hex value, like #00ff00")
    return tuple(int(raw[i : i + 2], 16) for i in (0, 2, 4))


def is_background_black(pixel: tuple[int, int, int, int], threshold: int) -> bool:
    r, g, b, a = pixel
    return a > 0 and max(r, g, b) <= threshold


def is_chroma_key(pixel: tuple[int, int, int, int], key: tuple[int, int, int], tolerance: int) -> bool:
    r, g, b, a = pixel
    if a == 0:
        return False
    exact_key = abs(r - key[0]) <= tolerance and abs(g - key[1]) <= tolerance and abs(b - key[2]) <= tolerance
    green_spill = g >= 70 and g - max(r, b) >= 15
    return exact_key or green_spill


def remove_key(
    image: Image.Image,
    key: tuple[int, int, int],
    tolerance: int,
    region: dict | None = None,
) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    x1 = max(0, int(region["x"])) if region else 0
    y1 = max(0, int(region["y"])) if region else 0
    x2 = min(rgba.width, int(region["x"]) + int(region["width"])) if region else rgba.width
    y2 = min(rgba.height, int(region["y"]) + int(region["height"])) if region else rgba.height

    for y in range(y1, y2):
        for x in range(x1, x2):
            r, g, b, _ = pixels[x, y]
            if is_chroma_key(pixels[x, y], key, tolerance):
                pixels[x, y] = (0, 0, 0, 0)
    return rgba


def remove_connected_key(
    image: Image.Image,
    key: tuple[int, int, int],
    tolerance: int,
    seed: tuple[int, int],
) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    if not is_chroma_key(pixels[seed], key, tolerance):
        return rgba

    stack = [seed]
    seen = {seed}
    while stack:
        x, y = stack.pop()
        pixels[x, y] = (0, 0, 0, 0)

        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < 0 or ny < 0 or nx >= rgba.width or ny >= rgba.height or (nx, ny) in seen:
                continue
            if is_chroma_key(pixels[nx, ny], key, tolerance):
                seen.add((nx, ny))
                stack.append((nx, ny))

    return rgba


def remove_connected_black_background(image: Image.Image, threshold: int) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    starts = [(0, 0), (rgba.width - 1, 0), (0, rgba.height - 1), (rgba.width - 1, rgba.height - 1)]
    stack = [point for point in starts if is_background_black(pixels[point], threshold)]
    seen = set(stack)

    while stack:
        x, y = stack.pop()
        r, g, b, _ = pixels[x, y]
        pixels[x, y] = (r, g, b, 0)

        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < 0 or ny < 0 or nx >= rgba.width or ny >= rgba.height or (nx, ny) in seen:
                continue
            if is_background_black(pixels[nx, ny], threshold):
                seen.add((nx, ny))
                stack.append((nx, ny))

    return rgba


def clear_outside_outer_shape(image: Image.Image, radius: int = 28) -> Image.Image:
    scale = 4
    rgba = image.convert("RGBA")
    mask = Image.new("L", (rgba.width * scale, rgba.height * scale), 0)
    draw = ImageDraw.Draw(mask)
    box = (0, 0, rgba.width * scale - 1, rgba.height * scale - 1)
    draw.rounded_rectangle(box, radius=radius * scale, fill=255)
    mask = mask.resize(rgba.size, Image.Resampling.LANCZOS)

    _, _, _, alpha = rgba.split()
    rgba.putalpha(Image.composite(alpha, Image.new("L", rgba.size, 0), mask))
    return rgba


def is_chroma_residue(pixel: tuple[int, int, int, int]) -> bool:
    r, g, b, a = pixel
    return a > 0 and g >= 180 and r <= 160 and b <= 160 and g - max(r, b) >= 35


def remove_chroma_residue(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            if is_chroma_residue(pixels[x, y]):
                pixels[x, y] = (0, 0, 0, 0)
    return rgba


def clear_region(image: Image.Image, region: dict, inset: int = 0) -> None:
    pixels = image.load()
    x1 = max(0, int(region["x"]) + inset)
    y1 = max(0, int(region["y"]) + inset)
    x2 = min(image.width, int(region["x"]) + int(region["width"]) - inset)
    y2 = min(image.height, int(region["y"]) + int(region["height"]) - inset)
    for y in range(y1, y2):
        for x in range(x1, x2):
            r, g, b, _ = pixels[x, y]
            pixels[x, y] = (r, g, b, 0)


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare an imagegen tarot border template as a transparent PNG overlay.")
    parser.add_argument("--input", required=True, type=Path, help="Raw imagegen PNG with a flat chroma-key center window.")
    parser.add_argument("--output", required=True, type=Path, help="Final transparent border template PNG.")
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--key", type=parse_color, default=KEY, help="Chroma key color, default #00ff00.")
    parser.add_argument("--tolerance", type=int, default=24, help="RGB tolerance for removing chroma key pixels.")
    parser.add_argument(
        "--key-mode",
        choices=["connected", "image-window", "full"],
        default="connected",
        help="How to remove chroma. connected removes only the center chroma field and preserves disconnected border ornaments.",
    )
    parser.add_argument("--key-seed", default="512,700", help="x,y seed point for --key-mode connected.")
    parser.add_argument(
        "--key-region",
        choices=["image-window", "full"],
        default="image-window",
        help="Deprecated alias used by --key-mode image-window/full.",
    )
    parser.add_argument(
        "--clear-outside-black",
        action="store_true",
        help="Clear pixels outside the manifest rounded outer card shape while preserving all interior border art.",
    )
    parser.add_argument(
        "--keep-chroma-residue",
        action="store_true",
        help="Skip the final bright-chroma residue cleanup pass.",
    )
    parser.add_argument("--outside-black-threshold", type=int, default=8, help="RGB max threshold for --clear-outside-black.")
    parser.add_argument("--clear-image-window", action="store_true", help="Force-clear the manifest imageWindow even if chroma key removal is imperfect.")
    parser.add_argument("--clear-title-text-area", action="store_true", help="Force-clear the inner title area for compositor-owned text.")
    args = parser.parse_args()

    manifest = load_manifest(ROOT / args.manifest)
    try:
        key_seed = tuple(int(part.strip()) for part in args.key_seed.split(",", 1))
    except ValueError as exc:
        raise SystemExit("--key-seed must use x,y integer format, like 512,700") from exc

    with Image.open(ROOT / args.input) as source:
        source.load()
        if source.size != (manifest["canvas"]["width"], manifest["canvas"]["height"]):
            raise SystemExit(
                f"{args.input}: expected {manifest['canvas']['width']}x{manifest['canvas']['height']}, "
                f"found {source.width}x{source.height}"
            )
        if args.key_mode == "connected":
            prepared = remove_connected_key(source, args.key, args.tolerance, key_seed)
        else:
            key_region = manifest["geometry"]["imageWindow"] if args.key_mode == "image-window" else None
            prepared = remove_key(source, args.key, args.tolerance, key_region)

    if args.clear_outside_black:
        prepared = clear_outside_outer_shape(prepared, int(manifest["geometry"]["outer"].get("rx", 28)))
    if not args.keep_chroma_residue:
        prepared = remove_chroma_residue(prepared)
    if args.clear_image_window:
        clear_region(prepared, manifest["geometry"]["imageWindow"], inset=2)
    if args.clear_title_text_area:
        title = manifest["geometry"]["titleCartouche"]
        clear_region(
            prepared,
            {
                "x": title["x"] + 32,
                "y": title["y"] + 26,
                "width": title["width"] - 64,
                "height": title["height"] - 52,
            },
        )

    output = ROOT / args.output
    output.parent.mkdir(parents=True, exist_ok=True)
    prepared.save(output)
    print(f"Wrote {output.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
