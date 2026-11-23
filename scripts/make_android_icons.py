#!/usr/bin/env python3
"""Membuat ikon launcher Android (adaptive + legacy) dan splash dari app_icon_512.png milik asset pack."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public/assets/ui/app_icon_512.png"
RES = ROOT / "android/app/src/main/res"
BG = (20, 18, 58, 255)  # #14123a

icon = Image.open(SRC).convert("RGBA")
legacy = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
fore = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}

def fit(img, size):
    return img.resize((size, size), Image.NEAREST if size < img.width and size % 16 == 0 else Image.LANCZOS)

for d, s in legacy.items():
    out = RES / f"mipmap-{d}"
    out.mkdir(parents=True, exist_ok=True)
    im = fit(icon, s)
    im.save(out / "ic_launcher.png")
    # ikon bulat: potong lingkaran
    mask = Image.new("L", (s, s), 0)
    from PIL import ImageDraw
    ImageDraw.Draw(mask).ellipse((0, 0, s - 1, s - 1), fill=255)
    rnd = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    rnd.paste(im, (0, 0), mask)
    rnd.save(out / "ic_launcher_round.png")
for d, s in fore.items():
    # foreground adaptive: ikon di zona aman 66%
    canvas = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    inner = int(s * 0.66)
    canvas.paste(fit(icon, inner), ((s - inner) // 2, (s - inner) // 2))
    canvas.save(RES / f"mipmap-{d}" / "ic_launcher_foreground.png")

(RES / "values/ic_launcher_background.xml").write_text(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#14123A</color>\n</resources>\n'
)
# splash landscape sederhana: latar indigo + ikon di tengah
for folder in RES.glob("drawable*"):
    sp = folder / "splash.png"
    if sp.exists():
        old = Image.open(sp)
        w, h = old.size
        im = Image.new("RGBA", (w, h), BG)
        side = int(min(w, h) * 0.34)
        im.paste(fit(icon, side), ((w - side) // 2, (h - side) // 2), fit(icon, side))
        im.save(sp)
print("ikon & splash Android dibuat")
