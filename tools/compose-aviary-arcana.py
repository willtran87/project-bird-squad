from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path.cwd()
CANVAS = (1024, 1536)
DATA_FILE = Path("data/cards/arcana/aviary-arcana.json")
DEFAULT_TEMPLATE = Path("assets/templates/minor-arcana/raster-border-templates/master.png")

GEOMETRY = {
    "image_window": (104, 164, 920, 1310),
    "title_cartouche": (154, 1310, 870, 1422),
    "top_medallion": (512, 92, 46),
}

ART_OPENING_SEED = (512, 700)
TITLE_VERTICAL_OFFSET = 18


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def display_title(card: dict) -> str:
    return card.get("gameName") or card.get("tarot") or card["id"]


def card_source_candidates(source_root: Path, card_id: str) -> list[Path]:
    return [
        source_root / "aviary" / f"{card_id}.png",
        source_root / f"{card_id}.png",
        source_root / "aviary" / f"{card_id}.jpg",
        source_root / f"{card_id}.jpg",
        source_root / "aviary" / f"{card_id}.jpeg",
        source_root / f"{card_id}.jpeg",
    ]


def find_source(source_root: Path, card_id: str) -> Path | None:
    for candidate in card_source_candidates(source_root, card_id):
        if candidate.exists():
            return candidate
    return None


def fit_to_box(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    source = image.convert("RGBA")
    target_w, target_h = size
    scale = max(target_w / source.width, target_h / source.height)
    resized = source.resize((round(source.width * scale), round(source.height * scale)), Image.Resampling.LANCZOS)
    left = max(0, (resized.width - target_w) // 2)
    top = max(0, (resized.height - target_h) // 2)
    return resized.crop((left, top, left + target_w, top + target_h))


def apply_card_alpha_mask(image: Image.Image) -> Image.Image:
    scale = 4
    mask = Image.new("L", (CANVAS[0] * scale, CANVAS[1] * scale), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, CANVAS[0] * scale - 1, CANVAS[1] * scale - 1), radius=28 * scale, fill=255)
    mask = mask.resize(CANVAS, Image.Resampling.LANCZOS)

    out = image.convert("RGBA")
    _, _, _, alpha = out.split()
    out.putalpha(Image.composite(alpha, Image.new("L", CANVAS, 0), mask))
    return out


def template_art_opening_mask(template: Image.Image) -> Image.Image:
    template_alpha = template.convert("RGBA").split()[3]
    seed_x, seed_y = ART_OPENING_SEED
    if template_alpha.getpixel((seed_x, seed_y)) > 16:
        fallback = Image.new("L", CANVAS, 0)
        ImageDraw.Draw(fallback).rectangle(GEOMETRY["image_window"], fill=255)
        return fallback

    opening = template_alpha.point(lambda alpha: 255 if alpha <= 16 else 0)
    filled = opening.copy()
    ImageDraw.floodfill(filled, ART_OPENING_SEED, 128, thresh=0)
    return filled.point(lambda value: 255 if value == 128 else 0)


def fit_art_under_template(source: Image.Image, template: Image.Image) -> Image.Image:
    art = fit_to_box(source, CANVAS)
    art.putalpha(template_art_opening_mask(template))
    return art


TITLE_FONT_PATH: Path | None = None


def resolve_title_font(path: Path | None) -> Path | None:
    candidates: list[Path] = []
    if path:
        candidates.append(path)
    env_path = os.environ.get("BIRD_SQUAD_TITLE_FONT")
    if env_path:
        candidates.append(Path(env_path))
    candidates.append(ROOT / "assets/fonts/grindy-brush/Grindy Brush.otf")

    for candidate in candidates:
        resolved = candidate if candidate.is_absolute() else ROOT / candidate
        if resolved.exists():
            return resolved
    return None


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    if TITLE_FONT_PATH:
        return ImageFont.truetype(str(TITLE_FONT_PATH), size=size)
    return ImageFont.load_default(size=size)


def fitted_font(draw: ImageDraw.ImageDraw, text: str, max_width: int, sizes: list[int]) -> ImageFont.ImageFont:
    for size in sizes:
        font = load_font(size)
        bbox = draw.textbbox((0, 0), text, font=font)
        if bbox[2] - bbox[0] <= max_width:
            return font
    return load_font(max(12, min(sizes) - 2))


def draw_centered_text(
    image: Image.Image,
    text: str,
    center: tuple[float, float],
    max_width: int,
    sizes: list[int],
    fill: tuple[int, int, int, int],
    stroke_fill: tuple[int, int, int, int] | None = None,
    stroke_width: int = 0,
) -> None:
    draw = ImageDraw.Draw(image)
    font = fitted_font(draw, text, max_width, sizes)
    bbox = draw.textbbox((0, 0), text, font=font, stroke_width=stroke_width)
    layer_w = bbox[2] - bbox[0] + 24
    layer_h = bbox[3] - bbox[1] + 24
    text_layer = Image.new("RGBA", (layer_w, layer_h), (0, 0, 0, 0))
    text_draw = ImageDraw.Draw(text_layer)
    text_draw.text(
        (12 - bbox[0], 12 - bbox[1]),
        text,
        fill=fill,
        font=font,
        stroke_width=stroke_width,
        stroke_fill=stroke_fill,
    )
    ink_bbox = text_layer.getchannel("A").getbbox()
    if ink_bbox is None:
        return
    text_layer = text_layer.crop(ink_bbox)
    image.alpha_composite(text_layer, (round(center[0] - text_layer.width / 2), round(center[1] - text_layer.height / 2)))


def draw_title_and_roman(image: Image.Image, title: str, roman: str) -> Image.Image:
    cartouche = GEOMETRY["title_cartouche"]
    draw_centered_text(
        image,
        title,
        ((cartouche[0] + cartouche[2]) / 2, (cartouche[1] + cartouche[3]) / 2 + TITLE_VERTICAL_OFFSET),
        cartouche[2] - cartouche[0] - 220,
        [58, 54, 50, 46, 42, 38, 34],
        (36, 22, 6, 255),
    )

    cx, cy, r = GEOMETRY["top_medallion"]
    draw_centered_text(
        image,
        roman,
        (cx, cy + 4),
        r * 2 - 16,
        [36, 34, 32, 30, 28, 26, 24],
        (241, 218, 153, 255),
        stroke_fill=(32, 20, 8, 220),
        stroke_width=1,
    )
    return image


def assert_isolated_art_source(source_root: Path) -> None:
    normalized = source_root.as_posix().lower()
    forbidden_fragments = [
        "/aviary-border-first-runs/",
        "/minor-arcana-border-first-runs/",
        "/runtime/cards/",
    ]
    for fragment in forbidden_fragments:
        if fragment in normalized:
            raise SystemExit(
                f"{source_root}: source-root must point to isolated borderless art, not finished/composited card output"
            )


def compose_card(source_path: Path, output_path: Path, template_path: Path, card: dict) -> None:
    with Image.open(source_path) as source:
        source.load()
        with Image.open(template_path) as template:
            template.load()
            if template.size != CANVAS:
                raise SystemExit(f"{template_path}: expected {CANVAS[0]}x{CANVAS[1]}, found {template.width}x{template.height}")
            template_layer = template.convert("RGBA")
            canvas = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
            canvas.alpha_composite(fit_art_under_template(source, template_layer), (0, 0))
            canvas.alpha_composite(template_layer)
        final = draw_title_and_roman(canvas, display_title(card), card["roman"])
        final = apply_card_alpha_mask(final)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        final.save(output_path)


def main() -> None:
    parser = argparse.ArgumentParser(description="Compose generated Aviary Legend center art under the shared Bird Squad master border.")
    parser.add_argument("--source-root", type=Path, default=Path(".generated/imagegen/tarot/aviary-center-art-runs/latest"))
    parser.add_argument("--output-root", type=Path, default=Path(".generated/imagegen/tarot/aviary-border-first-runs/latest"))
    parser.add_argument("--template", type=Path, default=DEFAULT_TEMPLATE, help="Shared raster border template, normally the Minor Arcana master.png.")
    parser.add_argument("--title-font", type=Path, default=None, help="Optional local title font override.")
    parser.add_argument("--strict", action="store_true", help="Fail if any expected center-art source image is missing.")
    parser.add_argument("--dry-run", action="store_true", help="List work without writing final PNGs.")
    args = parser.parse_args()

    global TITLE_FONT_PATH
    TITLE_FONT_PATH = resolve_title_font(args.title_font)

    source_root = (ROOT / args.source_root).resolve()
    output_root = (ROOT / args.output_root).resolve()
    template_path = (ROOT / args.template).resolve()
    if not template_path.exists():
        raise SystemExit(f"{template_path}: missing master template")

    assert_isolated_art_source(source_root)
    data = read_json(ROOT / DATA_FILE)
    missing: list[str] = []
    composed: list[Path] = []

    for card in data["cards"]:
        card_id = card["id"]
        source = find_source(source_root, card_id)
        if source is None:
            missing.append(f"aviary/{card_id}.png")
            continue

        output = output_root / "aviary" / f"{card_id}.png"
        if not args.dry_run:
            compose_card(source, output, template_path, card)
        composed.append(output)

    action = "Would compose" if args.dry_run else "Composed"
    print(f"{action} {len(composed)} Aviary Legend card(s).")
    if missing:
        print(f"Missing {len(missing)} center-art source file(s):")
        for item in missing:
            print(f"- {item}")

    if missing and args.strict:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
