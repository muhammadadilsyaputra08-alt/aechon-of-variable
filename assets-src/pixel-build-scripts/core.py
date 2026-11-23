"""Core: palet master terkunci, primitif gambar pixel-perfect, sheet packer."""
import math
import random
from PIL import Image, ImageDraw

# ---------------------------------------------------------------- PALET MASTER
P = {"ink": "#1b1530"}
RAMPS = {
    "blue":  ["#1f2a5a", "#2f4fa0", "#4f86dc", "#9cc8f8"],
    "gold":  ["#7a3e12", "#c8821a", "#f4c038", "#fff0a0"],
    "red":   ["#4e0e28", "#a21e42", "#e8485a", "#ffa8a0"],
    "vio":   ["#2a1450", "#5a2c92", "#9a54d2", "#dca4f4"],
    "cyan":  ["#0b3550", "#127c9e", "#30c8dc", "#b0f6f2"],
    "mag":   ["#5e1456", "#b02a8c", "#f062bc", "#ffb4e2"],
    "ind":   ["#14123a", "#2c2c7c", "#5c5cc8", "#a4acf6"],
    "stone": ["#2a2542", "#4a4268", "#7a7298", "#b8b2d0"],
    "cream": ["#7a6450", "#b8a084", "#e6d4ac", "#fbf0d2"],
    "skin":  ["#5a3426", "#8e5c3c", "#c88c60", "#f2c496"],
    "plum":  ["#26142e", "#4a2450", "#7a3c78", "#b0689e"],
    "moss":  ["#1f4a3a", "#3a7a52", "#6cb070", "#b8e090"],
    "snow":  ["#8c9cc0", "#c8d8f0", "#eef6ff", "#ffffff"],
    "void":  ["#08060f", "#1a0f2a"],
}
for _n, _cols in RAMPS.items():
    for _i, _c in enumerate(_cols):
        P[f"{_n}{_i}"] = _c


def rgba(c):
    if isinstance(c, tuple):
        return c if len(c) == 4 else c + (255,)
    h = P.get(c, c).lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]

# font 3x5 (hanya untuk glyph matematika di dalam sprite)
F35 = {
    "0": ["###", "#.#", "#.#", "#.#", "###"], "1": [".#.", "##.", ".#.", ".#.", "###"],
    "2": ["###", "..#", "###", "#..", "###"], "3": ["###", "..#", "###", "..#", "###"],
    "4": ["#.#", "#.#", "###", "..#", "..#"], "5": ["###", "#..", "###", "..#", "###"],
    "6": ["###", "#..", "###", "#.#", "###"], "7": ["###", "..#", "..#", ".#.", ".#."],
    "8": ["###", "#.#", "###", "#.#", "###"], "9": ["###", "#.#", "###", "..#", "###"],
    "x": ["#.#", "#.#", ".#.", "#.#", "#.#"], "y": ["#.#", "#.#", ".#.", ".#.", ".#."],
    "+": ["...", ".#.", "###", ".#.", "..."], "-": ["...", "...", "###", "...", "..."],
    "=": ["...", "###", "...", "###", "..."], "?": ["###", "..#", ".##", "...", ".#."],
    "i": [".#.", "...", ".#.", ".#.", ".#."], "l": ["#..", "#..", "#..", "#..", "###"],
}


class Spr:
    def __init__(s, w, h):
        s.w, s.h = w, h
        s.im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        s.d = ImageDraw.Draw(s.im)

    def px(s, x, y, c):
        if 0 <= x < s.w and 0 <= y < s.h:
            s.im.putpixel((int(x), int(y)), rgba(c))

    def get(s, x, y):
        return s.im.getpixel((x, y)) if 0 <= x < s.w and 0 <= y < s.h else (0, 0, 0, 0)

    def rect(s, x0, y0, x1, y1, c):
        if x1 < x0: x0, x1 = x1, x0
        if y1 < y0: y0, y1 = y1, y0
        s.d.rectangle([x0, y0, x1, y1], fill=rgba(c))

    def frame(s, x0, y0, x1, y1, c):
        s.d.rectangle([x0, y0, x1, y1], outline=rgba(c))

    def ell(s, x0, y0, x1, y1, c):
        s.d.ellipse([x0, y0, x1, y1], fill=rgba(c))

    def poly(s, pts, c):
        s.d.polygon([(int(a), int(b)) for a, b in pts], fill=rgba(c))

    def line(s, a, b, c):
        s.d.line([a, b], fill=rgba(c), width=1)

    def pts(s, pl, c):
        for x, y in pl:
            s.px(x, y, c)

    def paste(s, o, x, y):
        s.im.alpha_composite(o.im, (int(x), int(y)))

    def glyph(s, ch, x, y, c):
        for r, row in enumerate(F35[ch]):
            for k, v in enumerate(row):
                if v == "#":
                    s.px(x + k, y + r, c)

    def text(s, t, x, y, c):
        for i, ch in enumerate(t):
            s.glyph(ch, x + i * 4, y, c)

    def art(s, rows, mapping, ox=0, oy=0):
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch in mapping:
                    s.px(ox + x, oy + y, mapping[ch])

    def shade_poly(s, pts, ramp, mid=2, hi_edge=0.22, lo_edge=0.68, top=0.1):
        """Isi poligon 3-nada: kiri terang, kanan gelap, sedikit highlight atas."""
        m = Image.new("L", (s.w, s.h), 0)
        ImageDraw.Draw(m).polygon([(int(a), int(b)) for a, b in pts], fill=255)
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
        mp = m.load()
        for y in range(s.h):
            for x in range(s.w):
                if mp[x, y]:
                    t = (x - x0) / max(1, x1 - x0)
                    v = mid
                    if t < hi_edge: v = mid + 1
                    elif t > lo_edge: v = mid - 1
                    if (y - y0) / max(1, y1 - y0) < top and v < 3: v += 1
                    s.px(x, y, f"{ramp}{max(0, min(3, v))}")

    def outline(s, col="ink"):
        a = s.im.load(); w, h = s.im.size
        mk = []
        for y in range(h):
            for x in range(w):
                if a[x, y][3] == 0:
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < w and 0 <= ny < h and a[nx, ny][3] > 0:
                            mk.append((x, y)); break
        for x, y in mk:
            s.px(x, y, col)
        return s

    def copy(s):
        n = Spr(s.w, s.h); n.im = s.im.copy(); n.d = ImageDraw.Draw(n.im); return n

    def flip(s):
        n = Spr(s.w, s.h); n.im = s.im.transpose(Image.FLIP_LEFT_RIGHT); n.d = ImageDraw.Draw(n.im); return n


def dither_gradient(s, x0, y0, x1, y1, steps, vertical=True):
    """Gradien berpalet-terkunci: dither Bayer hanya antar warna ramp bertetangga."""
    n = len(steps)
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            t = (y - y0) / max(1, y1 - y0) if vertical else (x - x0) / max(1, x1 - x0)
            v = t * (n - 1); i = min(n - 2, int(v)); f = v - i
            s.px(x, y, steps[i + 1] if BAYER[y % 4][x % 4] / 16 < f else steps[i])


def glow(s, cx, cy, r, col, strength=0.9, only_over=None):
    for y in range(int(cy - r), int(cy + r) + 1):
        for x in range(int(cx - r), int(cx + r) + 1):
            d = math.hypot(x - cx, y - cy) / r
            if d < 1 and BAYER[y % 4][x % 4] / 16 < (1 - d) * strength:
                s.px(x, y, col)


class Sheet:
    def __init__(s, name, cw, ch, cols):
        s.name, s.cw, s.ch, s.cols = name, cw, ch, cols
        s.items = []; s.anims = {}

    def add(s, fname, spr, pivot=None):
        assert spr.w <= s.cw and spr.h <= s.ch, (fname, spr.w, spr.h)
        s.items.append((fname, spr, pivot or (spr.w // 2, spr.h - 1)))

    def anim(s, name, frames, fps, loop=True):
        s.anims[name] = {"frames": frames, "fps": fps, "loop": loop}

    def render(s):
        rows = -(-len(s.items) // s.cols)
        im = Image.new("RGBA", (s.cols * s.cw, rows * s.ch), (0, 0, 0, 0))
        meta = {}
        for i, (n, sp, pv) in enumerate(s.items):
            x, y = (i % s.cols) * s.cw, (i // s.cols) * s.ch
            im.alpha_composite(sp.im, (x, y))
            meta[n] = {"x": x, "y": y, "w": sp.w, "h": sp.h, "pivot": list(pv)}
        return im, {"file": f"{s.name}.png", "size": list(im.size), "cell": [s.cw, s.ch],
                    "frames": meta, "animations": s.anims}
