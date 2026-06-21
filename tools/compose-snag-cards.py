from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path.cwd()
CANVAS = (1024, 1536)
ART_OPENING_SEED = (512, 700)
TITLE_VERTICAL_OFFSET = 2
GEOMETRY = {
    "title_cartouche": (154, 1310, 870, 1422),
}

TITLE_FONT_PATH: Path | None = None


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


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


def title_font(draw: ImageDraw.ImageDraw, title: str, max_width: int) -> ImageFont.ImageFont:
    for size in [58, 54, 50, 46, 42, 38, 34]:
        font = load_font(size)
        bbox = draw.textbbox((0, 0), title, font=font)
        if bbox[2] - bbox[0] <= max_width:
            return font
    return load_font(32)


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


def fit_to_box(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    source = image.convert("RGBA")
    target_w, target_h = size
    scale = max(target_w / source.width, target_h / source.height)
    resized = source.resize((round(source.width * scale), round(source.height * scale)), Image.Resampling.LANCZOS)
    left = max(0, (resized.width - target_w) // 2)
    top = max(0, (resized.height - target_h) // 2)
    return resized.crop((left, top, left + target_w, top + target_h))


def template_art_opening_mask(template: Image.Image) -> Image.Image:
    template_alpha = template.convert("RGBA").split()[3]
    seed_x, seed_y = ART_OPENING_SEED
    if template_alpha.getpixel((seed_x, seed_y)) > 16:
        fallback = Image.new("L", CANVAS, 0)
        ImageDraw.Draw(fallback).rectangle((104, 164, 920, 1310), fill=255)
        return fallback

    opening = template_alpha.point(lambda alpha: 255 if alpha <= 16 else 0)
    filled = opening.copy()
    ImageDraw.floodfill(filled, ART_OPENING_SEED, 128, thresh=0)
    return filled.point(lambda value: 255 if value == 128 else 0)


def fit_art_under_template(source: Image.Image, template: Image.Image) -> Image.Image:
    art = fit_to_box(source, CANVAS)
    art.putalpha(template_art_opening_mask(template))
    return art


def draw_title(image: Image.Image, title: str) -> Image.Image:
    draw = ImageDraw.Draw(image)
    cartouche = GEOMETRY["title_cartouche"]
    font = title_font(draw, title, cartouche[2] - cartouche[0] - 220)

    bbox = draw.textbbox((0, 0), title, font=font)
    layer_w = bbox[2] - bbox[0] + 24
    layer_h = bbox[3] - bbox[1] + 24
    title_layer = Image.new("RGBA", (layer_w, layer_h), (0, 0, 0, 0))
    title_draw = ImageDraw.Draw(title_layer)
    title_draw.text((12 - bbox[0], 12 - bbox[1]), title, fill=(36, 22, 6, 255), font=font)

    ink_bbox = title_layer.getchannel("A").getbbox()
    if ink_bbox is None:
        return image

    title_layer = title_layer.crop(ink_bbox)
    center_x = (cartouche[0] + cartouche[2]) / 2
    center_y = (cartouche[1] + cartouche[3]) / 2 + TITLE_VERTICAL_OFFSET
    image.alpha_composite(title_layer, (round(center_x - title_layer.width / 2), round(center_y - title_layer.height / 2)))
    return image


def source_candidates(source_root: Path, card_id: str) -> list[Path]:
    return [
        source_root / f"{card_id}.png",
        source_root / f"{card_id}-center-imagegen-v1.png",
        source_root / f"{card_id}.jpg",
        source_root / f"{card_id}.jpeg",
    ]


def find_source(source_root: Path, card_id: str) -> Path | None:
    for candidate in source_candidates(source_root, card_id):
        if candidate.exists():
            return candidate
    return None


def assert_isolated_art_source(source_root: Path) -> None:
    normalized = source_root.as_posix().lower()
    forbidden_fragments = [
        "/tarot/selected/",
        "/runtime/cards/",
        "/snag-card/raw/",
    ]
    for fragment in forbidden_fragments:
        if fragment in normalized:
            raise SystemExit(f"{source_root}: source-root must point to borderless center art, not finished card output")


def compose_card(source_path: Path, output_path: Path, template_path: Path, title: str) -> None:
    with Image.open(source_path) as source, Image.open(template_path) as template:
        source.load()
        template.load()
        if template.size != CANVAS:
            raise SystemExit(f"{template_path}: expected {CANVAS[0]}x{CANVAS[1]}, found {template.width}x{template.height}")
        template_layer = template.convert("RGBA")
        canvas = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
        canvas.alpha_composite(fit_art_under_template(source, template_layer), (0, 0))
        canvas.alpha_composite(template_layer)
        final = draw_title(canvas, title)
        final = apply_card_alpha_mask(final)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        final.save(output_path)


def snag_cards() -> list[dict]:
    data = read_json(ROOT / "data/game/alpha-cards.json")
    return [card for card in data["cards"] if card.get("kind") == "snag"]


def main() -> None:
    parser = argparse.ArgumentParser(description="Compose Bird Squad Snag center art under the transparent Snag tarot border.")
    parser.add_argument("--source-root", type=Path, default=Path("assets/concept-art/snag-cards/sources"))
    parser.add_argument("--output-root", type=Path, default=Path(".generated/imagegen/tarot/selected"))
    parser.add_argument("--template", type=Path, default=Path("assets/templates/snag-card/snag-border.png"))
    parser.add_argument("--title-font", type=Path, default=None)
    parser.add_argument("--strict", action="store_true", help="Fail if any expected Snag center-art source image is missing.")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    global TITLE_FONT_PATH
    TITLE_FONT_PATH = resolve_title_font(args.title_font)

    source_root = (ROOT / args.source_root).resolve()
    output_root = (ROOT / args.output_root).resolve()
    template = (ROOT / args.template).resolve()
    assert_isolated_art_source(source_root)

    if not template.exists():
        raise SystemExit(f"{template}: missing transparent border template")

    missing: list[str] = []
    composed: list[Path] = []
    for card in snag_cards():
        card_id = card["id"]
        source = find_source(source_root, card_id)
        if source is None:
            missing.append(f"{card_id}.png")
            continue
        output = output_root / f"{card_id}.png"
        if not args.dry_run:
            compose_card(source, output, template, card["displayName"])
        composed.append(output)

    action = "Would compose" if args.dry_run else "Composed"
    print(f"{action} {len(composed)} Snag card(s).")
    if missing:
        print(f"Missing {len(missing)} center-art source file(s):")
        for item in missing:
            print(f"- {item}")
    if missing and args.strict:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
