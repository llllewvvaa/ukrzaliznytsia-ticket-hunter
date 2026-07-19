#!/usr/bin/env python3
"""Regenerate the colored state variants of the toolbar action icon.

The base icon (public/icon/128.png) is a white rail glyph on a dark rounded
square. For each state we recolor the background to the state's color, keep
the glyph white and preserve the original alpha/antialiasing, then downscale
to every action-icon size.

Usage (isolated env, requires network for pip):
  python3 -m venv .venv-icons
  .venv-icons/bin/pip install pillow
  .venv-icons/bin/python scripts/generate-state-icons.py
"""

from collections import Counter
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public" / "icon" / "128.png"
OUT = ROOT / "public" / "icon" / "states"
SIZES = (16, 32, 48, 128)

# state -> background color (kept in sync with src/lib/action-icon.ts)
STATES = {
    "active": (22, 163, 74),  # green  #16a34a — session active
    "off": (107, 114, 128),  # gray   #6b7280 — no session
    "hunts": (37, 99, 235),  # blue   #2563eb — hunts running
    "reserved": (217, 119, 6),  # amber #d97706 — payment pending
}


def luminance(rgb: tuple[int, int, int]) -> float:
    r, g, b = rgb
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def main() -> None:
    img = Image.open(SRC).convert("RGBA")
    px = img.load()

    # background = the most common fully opaque color (the dark square)
    opaque: Counter[tuple[int, int, int]] = Counter()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if a == 255:
                opaque[(r, g, b)] += 1
    bg_lum = luminance(opaque.most_common(1)[0][0])

    def recolor(state_rgb: tuple[int, int, int]) -> Image.Image:
        out = Image.new("RGBA", img.size)
        op = out.load()
        for y in range(img.height):
            for x in range(img.width):
                r, g, b, a = px[x, y]
                if a == 0:
                    continue
                # 0 = background -> state color, 1 = glyph -> white
                t = max(0.0, min(1.0, (luminance((r, g, b)) - bg_lum) / (255 - bg_lum)))
                op[x, y] = (
                    round(state_rgb[0] + (255 - state_rgb[0]) * t),
                    round(state_rgb[1] + (255 - state_rgb[1]) * t),
                    round(state_rgb[2] + (255 - state_rgb[2]) * t),
                    a,
                )
        return out

    OUT.mkdir(parents=True, exist_ok=True)
    for state, rgb in STATES.items():
        full = recolor(rgb)
        for size in SIZES:
            variant = full if size == img.width else full.resize((size, size), Image.LANCZOS)
            variant.save(OUT / f"{state}-{size}.png")
        print(f"{state}: {len(SIZES)} sizes")


if __name__ == "__main__":
    main()
