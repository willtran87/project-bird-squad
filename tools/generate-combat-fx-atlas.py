from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw


FRAME = 64
COLS = 8
ROWS = 6
OUT = Path("assets/runtime/fx/combat-fx-atlas.png")

PALETTES = {
    "plumes": ((255, 226, 154, 255), (255, 171, 72, 240), (36, 208, 214, 230), (8, 14, 24, 210)),
    "quills": ((231, 239, 245, 255), (139, 193, 218, 245), (76, 105, 132, 230), (9, 12, 18, 210)),
    "basins": ((151, 235, 218, 255), (80, 185, 205, 240), (255, 225, 163, 230), (8, 16, 22, 210)),
    "nests": ((255, 222, 156, 255), (138, 210, 150, 245), (82, 103, 69, 235), (11, 13, 8, 210)),
    "heal": ((180, 255, 194, 255), (91, 213, 142, 245), (255, 241, 178, 235), (8, 19, 12, 210)),
    "winded": ((210, 139, 255, 255), (150, 83, 216, 245), (255, 202, 125, 230), (16, 9, 25, 210)),
    "open": ((255, 208, 106, 255), (255, 120, 74, 245), (255, 244, 177, 235), (26, 12, 8, 210)),
    "hostile": ((255, 142, 111, 255), (255, 76, 82, 245), (255, 213, 135, 235), (31, 7, 8, 210)),
}


def rgba(color, alpha=1.0):
    r, g, b, a = color
    return (r, g, b, max(0, min(255, int(a * alpha))))


def line_px(d: ImageDraw.ImageDraw, pts, color, width=2):
    d.line([(round(x), round(y)) for x, y in pts], fill=color, width=width, joint="curve")


def diamond(d, x, y, r, color, outline=None):
    pts = [(x, y - r), (x + r, y), (x, y + r), (x - r, y)]
    d.polygon(pts, fill=color)
    if outline:
        d.line(pts + [pts[0]], fill=outline, width=1)


def plus(d, x, y, r, color, outline=None):
    if outline:
        d.line((x - r - 1, y, x + r + 1, y), fill=outline, width=2)
        d.line((x, y - r - 1, x, y + r + 1), fill=outline, width=2)
    d.line((x - r, y, x + r, y), fill=color, width=1)
    d.line((x, y - r, x, y + r), fill=color, width=1)


def sparkle_field(d, phase, pal, count=8, x0=8, y0=8, w=48, h=44):
    for i in range(count):
        x = x0 + ((i * 13 + phase * 5) % w)
        y = y0 + ((i * 17 + phase * 7) % h)
        if i % 3 == 0:
            plus(d, x, y, 2, rgba(pal[i % 3], 0.78), rgba(pal[3], 0.22))
        else:
            diamond(d, x, y, 1 + (i + phase) % 2, rgba(pal[i % 3], 0.7), rgba(pal[3], 0.24))


def plume(frame, phase, pal):
    d = ImageDraw.Draw(frame)
    burst = 0.55 + phase * 0.14
    cx, cy = 24 - phase * 1.2, 40 - phase * 1.5
    for i in range(4):
        ox = i * 7 + phase * 2
        line_px(d, [(12 + ox, 46 - i * 2), (24 + ox, 34 - i * 3), (38 + ox, 24 - i * 2)], rgba(pal[3], 0.85), 3)
        line_px(d, [(12 + ox, 45 - i * 2), (25 + ox, 33 - i * 3), (39 + ox, 23 - i * 2)], rgba(pal[i % 3], burst), 2)
    for i in range(7):
        diamond(d, 18 + i * 6 + phase, 17 + ((i * 7 + phase * 2) % 11), 2 if i % 2 else 1, rgba(pal[i % 3], 0.8 - phase * 0.08), rgba(pal[3], 0.35))
    sparkle_field(d, phase, pal, 7, 11, 9, 46, 34)


def quill(frame, phase, pal):
    d = ImageDraw.Draw(frame)
    spread = phase * 2
    for i, y in enumerate((20, 30, 40)):
        x0 = 16 - spread + i * 2
        pts = [(x0, y + 13), (34 + spread, y - 4), (50 + spread, y - 10)]
        line_px(d, pts, rgba(pal[3], 0.75), 4)
        line_px(d, pts, rgba(pal[i], 0.96), 2)
        line_px(d, [(34 + spread, y - 4), (29 + spread, y + 6)], rgba(pal[1], 0.7), 1)
        line_px(d, [(34 + spread, y - 4), (43 + spread, y - 1)], rgba(pal[0], 0.7), 1)
    for i in range(5):
        d.rectangle((9 + i * 8 + phase, 50 - i * 5, 11 + i * 8 + phase, 52 - i * 5), fill=rgba(pal[1], 0.78))
    sparkle_field(d, phase, pal, 6, 8, 10, 44, 44)


def basins(frame, phase, pal):
    d = ImageDraw.Draw(frame)
    cx, cy = 32, 38
    for ring in range(3):
        r = 10 + ring * 7 + phase * 2
        alpha = 0.78 - ring * 0.16 - phase * 0.07
        d.arc((cx - r, cy - r // 3, cx + r, cy + r // 2), 5, 175, fill=rgba(pal[ring], alpha), width=2)
    d.polygon([(18, 38), (46, 38), (40, 49), (24, 49)], fill=rgba(pal[3], 0.78))
    d.polygon([(20, 36), (44, 36), (39, 46), (25, 46)], fill=rgba(pal[1], 0.7))
    d.line([(21, 36), (43, 36)], fill=rgba(pal[2], 0.95), width=2)
    for i in range(4):
        x = 21 + i * 7 + ((phase + i) % 2)
        y = 17 + ((phase * 4 + i * 5) % 12)
        diamond(d, x, y, 2, rgba(pal[i % 3], 0.8), rgba(pal[3], 0.35))
    for i in range(5):
        d.arc((15 + i * 7, 39 - i % 2, 25 + i * 7, 48 + i % 2), 190, 344, fill=rgba(pal[0], 0.45), width=1)
    sparkle_field(d, phase, pal, 6, 12, 10, 40, 30)


def nests(frame, phase, pal):
    d = ImageDraw.Draw(frame)
    cx, cy = 32, 35
    r = 17 + phase
    for i in range(8):
        a = (math.tau * i / 8) + phase * 0.12
        b = a + math.pi * 0.78
        p1 = (cx + math.cos(a) * r, cy + math.sin(a) * (r * 0.72))
        p2 = (cx + math.cos(b) * (r - 4), cy + math.sin(b) * ((r - 4) * 0.68))
        line_px(d, [p1, p2], rgba(pal[3], 0.62), 3)
        line_px(d, [p1, p2], rgba(pal[i % 3], 0.86), 2)
    d.polygon([(32, 16), (49, 26), (44, 47), (32, 54), (20, 47), (15, 26)], fill=rgba(pal[2], 0.2), outline=rgba(pal[1], 0.82))
    d.polygon([(32, 21), (44, 28), (40, 44), (32, 49), (24, 44), (20, 28)], outline=rgba(pal[0], 0.85))
    d.polygon([(32, 25), (40, 30), (37, 41), (32, 45), (27, 41), (24, 30)], outline=rgba(pal[0], 0.5))
    for i in range(5):
        diamond(d, 18 + i * 7, 50 + ((i + phase) % 2), 1, rgba(pal[1], 0.6))
    sparkle_field(d, phase, pal, 5, 12, 12, 40, 42)


def heal(frame, phase, pal):
    d = ImageDraw.Draw(frame)
    cx, cy = 32, 36
    for i in range(6):
        a = math.tau * i / 6 + phase * 0.18
        x = cx + math.cos(a) * (9 + phase * 2)
        y = cy + math.sin(a) * (7 + phase)
        d.ellipse((x - 5, y - 3, x + 5, y + 3), fill=rgba(pal[1 if i % 2 else 0], 0.62), outline=rgba(pal[3], 0.28))
    d.rectangle((30, 16 - phase, 34, 52 - phase), fill=rgba(pal[3], 0.48))
    d.rectangle((28, 28 - phase, 36, 40 - phase), fill=rgba(pal[2], 0.92))
    d.rectangle((31, 19 - phase, 33, 49 - phase), fill=rgba(pal[0], 0.95))
    for i in range(8):
        diamond(d, 12 + i * 6, 16 + ((i * 5 + phase * 3) % 28), 1 + (i + phase) % 2, rgba(pal[i % 3], 0.72))
    sparkle_field(d, phase, pal, 10, 10, 8, 44, 44)


def winded(frame, phase, pal):
    d = ImageDraw.Draw(frame)
    for i in range(3):
        y = 23 + i * 9
        x = 13 + phase * 3 - i * 2
        pts = [(x, y), (28 + phase * 2, y - 7), (43 + phase, y), (29 + phase * 2, y + 6), (52 + phase, y + 8)]
        line_px(d, pts, rgba(pal[3], 0.72), 4)
        line_px(d, pts, rgba(pal[i], 0.86), 2)
    for i in range(4):
        d.rectangle((45 + i * 3, 15 + i * 9, 48 + i * 3, 18 + i * 9), fill=rgba(pal[2], 0.72))
    sparkle_field(d, phase, pal, 7, 10, 10, 44, 42)


def open_sky(frame, phase, pal):
    d = ImageDraw.Draw(frame)
    cx, cy = 32, 32
    r = 8 + phase * 4
    for i in range(8):
        a = math.tau * i / 8
        inner = (cx + math.cos(a) * (r + 3), cy + math.sin(a) * (r + 3))
        outer = (cx + math.cos(a) * (r + 15), cy + math.sin(a) * (r + 15))
        line_px(d, [inner, outer], rgba(pal[1 if i % 2 else 0], 0.72 - phase * 0.06), 2)
    d.rectangle((28, 28, 36, 36), fill=rgba(pal[3], 0.65))
    diamond(d, cx, cy, 7 + phase, rgba(pal[2], 0.92), rgba(pal[3], 0.45))
    sparkle_field(d, phase, pal, 8, 8, 8, 48, 48)


def hostile(frame, phase, pal):
    d = ImageDraw.Draw(frame)
    slash = [(13 + phase * 2, 19), (30 + phase, 30), (52 - phase, 46)]
    line_px(d, slash, rgba(pal[3], 0.88), 7)
    line_px(d, slash, rgba(pal[1], 0.95), 4)
    line_px(d, [(18, 44 - phase), (32, 32), (46, 19 + phase)], rgba(pal[0], 0.86), 3)
    for i in range(9):
        x = 11 + ((i * 7 + phase * 5) % 43)
        y = 14 + ((i * 11 + phase * 3) % 35)
        diamond(d, x, y, 1 + (i % 2), rgba(pal[i % 3], 0.72))
    sparkle_field(d, phase, pal, 7, 9, 10, 46, 42)


DRAWERS = [
    ("plumes", plume),
    ("quills", quill),
    ("basins", basins),
    ("nests", nests),
    ("heal", heal),
    ("winded", winded),
    ("open", open_sky),
    ("hostile", hostile),
]


def main():
    atlas = Image.new("RGBA", (COLS * FRAME, ROWS * FRAME), (0, 0, 0, 0))
    for effect_index, (name, draw_fn) in enumerate(DRAWERS):
        pal = PALETTES[name]
        for phase in range(6):
            frame = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
            draw_fn(frame, phase, pal)
            idx = effect_index * 6 + phase
            atlas.alpha_composite(frame, ((idx % COLS) * FRAME, (idx // COLS) * FRAME))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(OUT)
    print(f"wrote {OUT} ({atlas.width}x{atlas.height})")


if __name__ == "__main__":
    main()
