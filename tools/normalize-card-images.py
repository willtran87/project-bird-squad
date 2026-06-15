from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def iter_pngs(root: Path) -> list[Path]:
    return sorted(path for path in root.rglob("*.png") if path.is_file())


def normalize_image(path: Path, width: int, height: int, write: bool) -> bool:
    with Image.open(path) as source:
        source.load()
        if source.size == (width, height):
            return False

        image = source.convert("RGBA")
        image.thumbnail((width, height), Image.Resampling.LANCZOS)

        background = Image.new("RGBA", (width, height), (8, 7, 10, 255))
        x = (width - image.width) // 2
        y = (height - image.height) // 2
        background.alpha_composite(image, (x, y))

        if write:
            background.save(path)

        return True


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Normalize card PNGs to a fixed canvas without cropping the source image.",
    )
    parser.add_argument("directory", type=Path)
    parser.add_argument("--width", type=int, default=1024)
    parser.add_argument("--height", type=int, default=1536)
    parser.add_argument("--write", action="store_true", help="Write normalized images in place.")
    args = parser.parse_args()

    changed = []
    for path in iter_pngs(args.directory):
        if normalize_image(path, args.width, args.height, args.write):
            changed.append(path)

    action = "Normalized" if args.write else "Would normalize"
    print(f"{action} {len(changed)} file(s) to {args.width}x{args.height}.")
    for path in changed:
        print(path)


if __name__ == "__main__":
    main()
