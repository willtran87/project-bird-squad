from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path.cwd()
CANVAS = (1024, 1536)


@dataclass(frozen=True)
class SuitSpec:
    key: str
    name: str
    file: str
    accent: tuple[int, int, int]
    accent2: tuple[int, int, int]
    enamel: tuple[int, int, int]


SUITS = [
    SuitSpec("plumes", "Plumes", "data/cards/arcana/minor-arcana-wands.json", (213, 130, 53), (184, 77, 119), (60, 36, 64)),
    SuitSpec("basins", "Basins", "data/cards/arcana/minor-arcana-cups.json", (74, 167, 165), (143, 185, 211), (23, 56, 74)),
    SuitSpec("quills", "Quills", "data/cards/arcana/minor-arcana-swords.json", (139, 183, 215), (214, 229, 238), (27, 43, 61)),
    SuitSpec("nests", "Nests", "data/cards/arcana/minor-arcana-pentacles.json", (200, 155, 79), (127, 154, 102), (53, 44, 31)),
]

GEOMETRY = {
    "outer": (32, 32, 992, 1504),
    "inner": (58, 58, 966, 1478),
    "trim": (76, 76, 948, 1460),
    "image_window": (104, 164, 920, 1310),
    "title_cartouche": (154, 1310, 870, 1422),
    "title_inner": (174, 1328, 850, 1404),
    "top_medallion": (512, 92, 46),
    "corner_medallions": [(88, 88, 38), (936, 88, 38), (88, 1448, 38), (936, 1448, 38)],
    "side_rails": [(60, 176, 106, 1266), (918, 176, 964, 1266)],
}

ART_OPENING_SEED = (512, 700)
TITLE_VERTICAL_OFFSET = 18

RANK_NAMES = {
    "Ace": "Ace",
    "2": "Two",
    "3": "Three",
    "4": "Four",
    "5": "Five",
    "6": "Six",
    "7": "Seven",
    "8": "Eight",
    "9": "Nine",
    "10": "Ten",
}


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def display_title(card: dict, data: dict, suit: SuitSpec) -> str:
    rank = RANK_NAMES.get(card["rank"], data["courtNaming"].get(card["rank"], card["rank"]))
    return f"{rank} of {suit.name}"


def card_source_candidates(source_root: Path, suit: SuitSpec, card_id: str) -> list[Path]:
    return [
        source_root / suit.key / f"{card_id}.png",
        source_root / f"{card_id}.png",
        source_root / suit.key / f"{card_id}.jpg",
        source_root / f"{card_id}.jpg",
        source_root / suit.key / f"{card_id}.jpeg",
        source_root / f"{card_id}.jpeg",
    ]


def find_source(source_root: Path, suit: SuitSpec, card_id: str) -> Path | None:
    for candidate in card_source_candidates(source_root, suit, card_id):
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


TEMPLATE_MASK_CACHE: dict[str, Image.Image] = {}


def template_art_opening_mask(template: Image.Image | None = None, template_path: Path | None = None) -> Image.Image:
    cache_key = str(template_path.resolve()) if template_path else None
    if cache_key and cache_key in TEMPLATE_MASK_CACHE:
        return TEMPLATE_MASK_CACHE[cache_key].copy()

    if template is None:
        mask = Image.new("L", CANVAS, 0)
        ImageDraw.Draw(mask).rectangle(GEOMETRY["image_window"], fill=255)
        return mask

    template_alpha = template.convert("RGBA").split()[3]
    seed_x, seed_y = ART_OPENING_SEED
    if template_alpha.getpixel((seed_x, seed_y)) > 16:
        fallback = Image.new("L", CANVAS, 0)
        ImageDraw.Draw(fallback).rectangle(GEOMETRY["image_window"], fill=255)
        if cache_key:
            TEMPLATE_MASK_CACHE[cache_key] = fallback.copy()
        return fallback

    opening = template_alpha.point(lambda alpha: 255 if alpha <= 16 else 0)
    filled = opening.copy()
    ImageDraw.floodfill(filled, ART_OPENING_SEED, 128, thresh=0)
    mask = filled.point(lambda value: 255 if value == 128 else 0)
    if cache_key:
        TEMPLATE_MASK_CACHE[cache_key] = mask.copy()
    return mask


def fit_art_under_template(source: Image.Image, template: Image.Image | None = None, template_path: Path | None = None) -> Image.Image:
    art = fit_to_box(source, CANVAS)
    if template is None:
        return art

    art.putalpha(template_art_opening_mask(template, template_path))
    return art


TITLE_FONT_PATH: Path | None = None


def resolve_title_font(path: Path | None) -> Path | None:
    candidates = []
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


def draw_rounded(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], radius: int, fill=None, outline=None, width: int = 1) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def draw_medallion(draw: ImageDraw.ImageDraw, cx: int, cy: int, r: int, suit: SuitSpec) -> None:
    box = (cx - r, cy - r, cx + r, cy + r)
    draw.ellipse(box, fill=suit.enamel, outline=(229, 184, 92), width=7)
    draw.ellipse((cx - r + 9, cy - r + 9, cx + r - 9, cy + r - 9), outline=suit.accent, width=3)


def draw_suit_motif(draw: ImageDraw.ImageDraw, x: int, y: int, suit: SuitSpec, scale: float = 1.0) -> None:
    color = suit.accent
    if suit.key == "plumes":
        pts = [(x - int(18 * scale), y + int(24 * scale)), (x, y - int(30 * scale)), (x + int(24 * scale), y + int(18 * scale))]
        draw.line(pts, fill=color, width=max(2, int(4 * scale)), joint="curve")
        draw.line((x, y - int(28 * scale), x - int(5 * scale), y + int(26 * scale)), fill=color, width=max(2, int(3 * scale)))
    elif suit.key == "basins":
        draw.arc((x - int(30 * scale), y - int(18 * scale), x + int(30 * scale), y + int(34 * scale)), 0, 180, fill=color, width=max(2, int(4 * scale)))
        draw.arc((x - int(36 * scale), y - int(26 * scale), x + int(36 * scale), y + int(8 * scale)), 10, 170, fill=color, width=max(2, int(4 * scale)))
    elif suit.key == "quills":
        draw.line((x - int(24 * scale), y + int(30 * scale), x + int(22 * scale), y - int(30 * scale)), fill=color, width=max(2, int(4 * scale)))
        draw.arc((x - int(26 * scale), y - int(35 * scale), x + int(30 * scale), y + int(30 * scale)), 100, 270, fill=color, width=max(2, int(4 * scale)))
    else:
        draw.arc((x - int(34 * scale), y - int(10 * scale), x + int(34 * scale), y + int(34 * scale)), 0, 180, fill=color, width=max(2, int(4 * scale)))
        draw.arc((x - int(24 * scale), y - int(4 * scale), x + int(24 * scale), y + int(24 * scale)), 0, 180, fill=color, width=max(2, int(3 * scale)))


def draw_overlay(image: Image.Image, suit: SuitSpec, title: str) -> Image.Image:
    draw = ImageDraw.Draw(image)

    draw_rounded(draw, GEOMETRY["outer"], 28, fill=None, outline=(6, 9, 19), width=30)
    draw_rounded(draw, GEOMETRY["inner"], 22, fill=None, outline=(229, 184, 92), width=14)
    draw_rounded(draw, GEOMETRY["trim"], 18, fill=None, outline=suit.accent, width=3)

    for rail in GEOMETRY["side_rails"]:
        draw_rounded(draw, rail, 18, fill=(12, 16, 32), outline=(229, 184, 92), width=7)

    for cx, cy, r in GEOMETRY["corner_medallions"]:
        draw_medallion(draw, cx, cy, r, suit)
        draw_suit_motif(draw, cx, cy, suit, 0.7)

    cx, cy, r = GEOMETRY["top_medallion"]
    draw_medallion(draw, cx, cy, r, suit)
    draw_suit_motif(draw, cx, cy, suit, 0.9)

    for x in [83, 941]:
        for y in [370, 640, 910]:
            draw_suit_motif(draw, x, y, suit, 0.55)

    cartouche = GEOMETRY["title_cartouche"]
    draw_rounded(draw, cartouche, 32, fill=(232, 214, 171), outline=(229, 184, 92), width=7)
    draw_rounded(draw, GEOMETRY["title_inner"], 22, fill=None, outline=(104, 69, 30), width=3)

    font = title_font(draw, title, cartouche[2] - cartouche[0] - 220)
    bbox = draw.textbbox((0, 0), title, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = cartouche[0] + ((cartouche[2] - cartouche[0]) - text_w) / 2 - bbox[0]
    y = cartouche[1] + ((cartouche[3] - cartouche[1]) - text_h) / 2 - 6 - bbox[1]
    draw.text((x, y), title, fill=(36, 22, 6), font=font)

    return image


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


def find_template(template_root: Path | None, suit: SuitSpec) -> Path | None:
    if template_root is None:
        return None
    for candidate in [template_root / f"{suit.key}.png", template_root / "master.png"]:
        if candidate.exists():
            return candidate
    return None


def assert_isolated_art_source(source_root: Path) -> None:
    normalized = source_root.as_posix().lower()
    forbidden_fragments = [
        "/minor-arcana-border-first-runs/",
        "/minor-arcana-composited/",
        "/runtime/cards/",
    ]
    for fragment in forbidden_fragments:
        if fragment in normalized:
            raise SystemExit(
                f"{source_root}: source-root must point to isolated borderless art, not finished/composited card output"
            )


def compose_card(source_path: Path, output_path: Path, suit: SuitSpec, title: str, template_path: Path | None = None) -> None:
    with Image.open(source_path) as source:
        source.load()
        canvas = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
        if template_path:
            with Image.open(template_path) as template:
                template.load()
                if template.size != CANVAS:
                    raise SystemExit(f"{template_path}: expected {CANVAS[0]}x{CANVAS[1]}, found {template.width}x{template.height}")
                template_layer = template.convert("RGBA")
                canvas.alpha_composite(fit_art_under_template(source, template_layer, template_path), (0, 0))
                canvas.alpha_composite(template_layer)
            final = draw_title(canvas, title)
        else:
            canvas.alpha_composite(fit_to_box(source, CANVAS), (0, 0))
            final = draw_overlay(canvas, suit, title)
        final = apply_card_alpha_mask(final)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        final.save(output_path)


def main() -> None:
    parser = argparse.ArgumentParser(description="Compose generated Minor Arcana center art under deterministic Bird Squad borders and titles.")
    parser.add_argument("--source-root", type=Path, default=Path(".generated/imagegen/tarot/minor-arcana-center-art"))
    parser.add_argument("--output-root", type=Path, default=Path(".generated/imagegen/tarot/minor-arcana-composited"))
    parser.add_argument("--template-root", type=Path, default=None, help="Optional raster border template root. Uses {suit}.png, then master.png, then procedural fallback.")
    parser.add_argument("--title-font", type=Path, default=None, help="Optional local title font override. Useful for prototype-only licensed fonts kept outside tracked assets.")
    parser.add_argument("--strict", action="store_true", help="Fail if any expected center-art source image is missing.")
    parser.add_argument("--dry-run", action="store_true", help="List work without writing final PNGs.")
    args = parser.parse_args()

    global TITLE_FONT_PATH
    TITLE_FONT_PATH = resolve_title_font(args.title_font)

    source_root = (ROOT / args.source_root).resolve()
    output_root = (ROOT / args.output_root).resolve()
    template_root = (ROOT / args.template_root).resolve() if args.template_root else None
    assert_isolated_art_source(source_root)
    missing: list[str] = []
    composed: list[Path] = []

    for suit in SUITS:
        data = read_json(ROOT / suit.file)
        for card in data["cards"]:
            card_id = card["id"]
            source = find_source(source_root, suit, card_id)
            if source is None:
                missing.append(f"{suit.key}/{card_id}.png")
                continue

            output = output_root / suit.key / f"{card_id}.png"
            if not args.dry_run:
                compose_card(source, output, suit, display_title(card, data, suit), find_template(template_root, suit))
            composed.append(output)

    action = "Would compose" if args.dry_run else "Composed"
    print(f"{action} {len(composed)} Minor Arcana card(s).")
    if missing:
      print(f"Missing {len(missing)} center-art source file(s):")
      for item in missing:
          print(f"- {item}")

    if missing and args.strict:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
