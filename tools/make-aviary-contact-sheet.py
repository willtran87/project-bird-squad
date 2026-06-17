from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path.cwd()


def iter_cards(root: Path) -> list[Path]:
    files = sorted((root / "aviary").glob("*.png"))
    if files:
        return files
    return sorted(root.glob("aviary_*.png"))


def load_font(size: int) -> ImageFont.ImageFont:
    try:
        return ImageFont.truetype("arial.ttf", size=size)
    except OSError:
        return ImageFont.load_default(size=size)


def make_sheet(files: list[Path], output: Path, columns: int, thumb: tuple[int, int]) -> None:
    if not files:
        return

    label_h = 28
    gutter = 12
    rows = (len(files) + columns - 1) // columns
    width = columns * thumb[0] + (columns + 1) * gutter
    height = rows * (thumb[1] + label_h) + (rows + 1) * gutter
    sheet = Image.new("RGB", (width, height), (18, 20, 28))
    draw = ImageDraw.Draw(sheet)
    font = load_font(13)

    for index, file in enumerate(files):
        col = index % columns
        row = index // columns
        x = gutter + col * (thumb[0] + gutter)
        y = gutter + row * (thumb[1] + label_h + gutter)
        with Image.open(file) as source:
            image = source.convert("RGB")
            image.thumbnail(thumb, Image.Resampling.LANCZOS)
            tile = Image.new("RGB", thumb, (8, 10, 18))
            tx = (thumb[0] - image.width) // 2
            ty = (thumb[1] - image.height) // 2
            tile.paste(image, (tx, ty))
            sheet.paste(tile, (x, y))
        draw.text((x, y + thumb[1] + 7), file.stem, fill=(238, 238, 230), font=font)

    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output)


def main() -> None:
    parser = argparse.ArgumentParser(description="Create an Aviary Legend contact sheet for center art or final composites.")
    parser.add_argument("--source-root", type=Path, default=Path(".generated/imagegen/tarot/aviary-border-first-runs/latest"))
    parser.add_argument("--output-root", type=Path, default=Path("tmp/qa/aviary/latest"))
    args = parser.parse_args()

    source_root = (ROOT / args.source_root).resolve()
    output_root = (ROOT / args.output_root).resolve()

    files = iter_cards(source_root)
    make_sheet(files, output_root / "aviary-contact-sheet.png", columns=6, thumb=(160, 240))
    print(f"Wrote contact sheet for {len(files)} PNG file(s) to {output_root.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
