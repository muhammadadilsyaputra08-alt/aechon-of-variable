"""Karakter, potret VN, Guardian, The Null."""
import math
import random
from core import *

EXPR = ["neutral", "happy", "surprised", "thinking"]


# ------------------------------------------------------------------ AXIOM (kubus-roh penuntun)
def cube(s, x, y, w, h, d):
    s.poly([(x, y), (x + d, y - d), (x + w - 1 + d, y - d), (x + w - 1, y)], "blue3")
    s.poly([(x + w - 1, y), (x + w - 1 + d, y - d), (x + w - 1 + d, y + h - 1 - d), (x + w - 1, y + h - 1)], "blue1")
    s.rect(x, y, x + w - 1, y + h - 1, "blue2")
    s.rect(x, y, x, y + h - 1, "blue3"); s.rect(x, y + h - 1, x + w - 1, y + h - 1, "blue1")
    s.frame(x + 1, y + 1, x + w - 2, y + h - 2, "gold2")


def axiom_eyes(s, sx0, sy0, sx1, sy1, expr, big):
    cy = (sy0 + sy1) // 2 - (1 if big else 0)
    lx, rx = (sx0 + sx1) // 2 - (4 if big else 2), (sx0 + sx1) // 2 + (4 if big else 2)
    C, D = "cyan3", "cyan2"
    if big:
        if expr == "neutral":
            for ex in (lx, rx): s.rect(ex - 1, cy - 2, ex + 1, cy + 2, C); s.px(ex - 1, cy - 2, D)
            s.rect(lx + 2, cy + 5, rx - 2, cy + 5, D)
        elif expr == "happy":
            for ex in (lx, rx):
                s.pts([(ex - 2, cy + 1), (ex - 1, cy), (ex, cy - 1), (ex + 1, cy), (ex + 2, cy + 1)], C)
                s.pts([(ex - 2, cy + 2), (ex + 2, cy + 2)], D)
            s.pts([(lx + 1, cy + 4), (lx + 2, cy + 5), (rx - 2, cy + 5), (rx - 1, cy + 4)], C)
            s.rect(lx + 3, cy + 5, rx - 3, cy + 5, C)
        elif expr == "surprised":
            for ex in (lx, rx): s.frame(ex - 2, cy - 2, ex + 2, cy + 2, C); s.px(ex, cy, D)
            s.rect((lx + rx) // 2 - 1, cy + 4, (lx + rx) // 2, cy + 5, C)
        else:
            s.rect(lx - 1, cy - 2, lx + 1, cy + 2, C)
            s.rect(rx - 2, cy, rx + 2, cy, C)
            s.pts([(rx + 4, cy - 4), (rx + 5, cy - 5)], D) if rx + 5 <= sx1 else None
            s.pts([(lx + 3, cy + 5), (lx + 4, cy + 4), (lx + 5, cy + 5), (lx + 6, cy + 4)], D)
    else:
        if expr == "neutral":
            for ex in (lx, rx): s.rect(ex, cy - 1, ex, cy + 1, C)
        elif expr == "happy":
            for ex in (lx, rx): s.pts([(ex - 1, cy + 1), (ex, cy), (ex + 1, cy + 1)], C)
        elif expr == "surprised":
            for ex in (lx, rx): s.rect(ex - 1, cy - 1, ex + 1, cy + 1, C); s.px(ex, cy, D)
        else:
            s.rect(lx, cy - 1, lx, cy + 1, C); s.rect(rx - 1, cy, rx + 1, cy, C)


def axiom_portrait(expr):
    s = Spr(64, 64)
    x, y, w, h, d = 12, 24, 30, 30, 9
    # kristal melayang di atas
    s.shade_poly([(30, 1), (34, 6), (30, 12), (26, 6)], "gold", mid=2); s.px(29, 4, "snow3")
    cube(s, x, y, w, h, d)
    sx0, sy0, sx1, sy1 = x + 4, y + 5, x + w - 5, y + h - 10
    s.rect(sx0, sy0, sx1, sy1, "ind0"); s.frame(sx0, sy0, sx1, sy1, "ind1")
    axiom_eyes(s, sx0, sy0, sx1, sy1, expr, True)
    for i, c in enumerate(("gold3", "gold2", "gold3")):
        s.rect(x + 9 + i * 4, y + h - 6, x + 10 + i * 4, y + h - 5, c)
    # rune pada sisi samping
    s.pts([(x + w + 2, y - 2), (x + w + 4, y - 4)], "gold3")
    s.pts([(x + w + 3, y + 6), (x + w + 4, y + 10), (x + w + 3, y + 14)], "gold2")
    for p in [(6, 20), (58, 30), (50, 8)]: s.px(*p, "snow3")
    glow(s, 32, 6, 9, "gold1", 0.5); s.shade_poly([(30, 1), (34, 6), (30, 12), (26, 6)], "gold", mid=2)
    return s.outline()


def axiom_sprite(frame):
    s = Spr(32, 32)
    bob = (0, 1, 0, -1)[frame % 4]
    x, y, w, h, d = 6, 12 + bob, 16, 15, 5
    s.shade_poly([(15, 1 + bob), (17, 4 + bob), (15, 7 + bob), (13, 4 + bob)], "gold", mid=2)
    cube(s, x, y, w, h, d)
    s.rect(x + 3, y + 4, x + w - 4, y + h - 5, "ind0")
    axiom_eyes(s, x + 3, y + 4, x + w - 4, y + h - 5, "neutral", False)
    s.rect(x + 5, y + h - 3, x + w - 6, y + h - 3, "gold3")
    # bayangan di tanah (dither)
    for xx in range(8, 25):
        if (xx + frame) % 2 == 0: s.px(xx, 30, "stone1")
    return s.outline()


# ------------------------------------------------------------------ ELYRA (penjaga arsip)
def elyra_portrait(expr):
    s = Spr(64, 64)
    # rambut belakang
    s.poly([(14, 24), (17, 10), (46, 10), (50, 24), (53, 52), (47, 62), (17, 62), (11, 52)], "plum1")
    s.poly([(14, 30), (16, 56), (20, 60), (20, 30)], "plum2")
    s.ell(25, 0, 38, 11, "plum2"); s.ell(28, 2, 33, 6, "plum3"); s.px(31, 10, "gold3"); s.rect(30, 11, 33, 11, "gold2")
    # jubah
    s.poly([(2, 63), (8, 51), (21, 46), (43, 46), (56, 51), (62, 63)], "ind1")
    s.poly([(2, 63), (8, 51), (14, 49), (12, 63)], "ind2")
    s.poly([(56, 51), (62, 63), (52, 63), (50, 49)], "ind0")
    s.poly([(25, 46), (32, 58), (39, 46)], "cream3"); s.line((24, 46), (32, 59), "gold2"); s.line((40, 46), (32, 59), "gold2")
    s.line((20, 47), (10, 62), "gold2"); s.line((44, 47), (54, 62), "gold2")
    s.px(32, 60, "gold3"); s.rect(31, 61, 32, 62, "gold2")
    # leher + wajah
    s.rect(28, 40, 35, 48, "skin1"); s.rect(28, 40, 35, 43, "skin0")
    s.ell(18, 12, 45, 46, "skin2")
    for y in range(12, 47):
        for x in range(18, 46):
            if s.get(x, y) == rgba("skin2") and x > 39: s.px(x, y, "skin1")
    s.rect(24, 17, 36, 18, "skin3")
    s.pts([(17, 30), (17, 31), (46, 30), (46, 31)], "skin2")
    # poni
    s.poly([(17, 28), (17, 14), (24, 8), (40, 8), (47, 14), (47, 28), (43, 21), (37, 16), (31, 21), (26, 22), (21, 26)], "plum2")
    s.poly([(24, 8), (40, 8), (44, 11), (36, 12), (28, 12), (20, 11)], "plum3")
    s.pts([(29, 10), (33, 11)], "snow3")
    # pipi
    s.pts([(22, 36), (23, 37), (41, 36), (40, 37)], "red3")
    # kacamata
    for x0 in (21, 35):
        s.frame(x0, 27, x0 + 8, 34, "gold2"); s.rect(x0 + 1, 28, x0 + 7, 33, "snow3")
    s.rect(30, 29, 34, 29, "gold2")
    ey = 31
    def eyes(kind):
        for ex in (25, 39):
            if kind == "neutral":
                s.rect(ex, ey - 1, ex + 1, ey + 1, "ind0"); s.px(ex, ey - 1, "snow3")
            elif kind == "happy":
                s.pts([(ex - 2, ey + 1), (ex - 1, ey), (ex, ey - 1), (ex + 1, ey - 1), (ex + 2, ey), (ex + 3, ey + 1)], "ind0")
            elif kind == "surprised":
                s.rect(ex - 1, ey - 2, ex + 2, ey + 2, "ind0"); s.rect(ex, ey - 1, ex, ey - 1, "snow3")
            else:
                s.rect(ex - 1, ey - 2, ex, ey, "ind0"); s.px(ex - 1, ey - 2, "snow3")
    eyes(expr)
    brow_y = {"neutral": 24, "happy": 23, "surprised": 21, "thinking": 24}[expr]
    s.rect(23, brow_y, 28, brow_y, "plum1"); s.rect(36, brow_y if expr != "thinking" else brow_y - 1, 41, brow_y if expr != "thinking" else brow_y - 1, "plum1")
    # mulut
    if expr == "neutral": s.rect(29, 40, 34, 40, "skin0")
    elif expr == "happy": s.pts([(28, 39), (29, 40), (30, 41), (31, 41), (32, 41), (33, 41), (34, 40), (35, 39)], "skin0"); s.rect(30, 40, 33, 40, "snow3")
    elif expr == "surprised": s.rect(30, 39, 33, 42, "skin0"); s.rect(31, 40, 32, 41, "red0")
    else: s.pts([(29, 41), (30, 40), (31, 40), (32, 40), (33, 40), (34, 39)], "skin0")
    # buku yang dipeluk (kanan bawah)
    return s.outline()


def elyra_sprite(frame):
    s = Spr(32, 48)
    sway = (0, 1)[frame % 2]
    # rambut
    s.poly([(9, 12), (11, 4), (21, 4), (23, 12), (24, 26), (22, 31), (10, 31), (8, 26)], "plum1")
    s.ell(13, 0, 19, 5, "plum2"); s.px(16, 5, "gold3")
    # jubah
    s.poly([(7, 47), (9, 26), (13, 22), (19, 22), (23, 26), (25, 47)], "ind1")
    s.poly([(7, 47), (9, 26), (11, 25), (11, 47)], "ind2"); s.poly([(21, 25), (25, 47), (20, 47), (19, 24)], "ind0")
    s.poly([(14, 22), (16, 29), (18, 22)], "cream3")
    s.rect(7, 45, 25, 46, "gold2")
    # kepala
    s.ell(10, 8, 21, 22, "skin2"); s.rect(19, 10, 21, 20, "skin1") if False else None
    for y in range(8, 23):
        for x in range(10, 22):
            if s.get(x, y) == rgba("skin2") and x > 18: s.px(x, y, "skin1")
    s.poly([(9, 14), (9, 8), (13, 5), (19, 5), (22, 8), (22, 14), (19, 10), (16, 9), (13, 11)], "plum2")
    s.frame(11, 13, 14, 16, "gold2"); s.frame(17, 13, 20, 16, "gold2"); s.px(15, 14, "gold2")
    s.px(12, 15, "ind0"); s.px(18, 15, "ind0"); s.px(13, 19, "skin0"); s.px(14, 19, "skin0")
    # buku
    s.rect(11, 28 + sway, 20, 35 + sway, "gold1"); s.rect(11, 28 + sway, 20, 29 + sway, "gold2"); s.rect(12, 31 + sway, 19, 31 + sway, "cream3")
    s.rect(15, 28 + sway, 16, 35 + sway, "gold3")
    # tangan
    s.rect(10, 32 + sway, 12, 34 + sway, "skin2"); s.rect(19, 32 + sway, 21, 34 + sway, "skin1")
    return s.outline()


# ------------------------------------------------------------------ ARSITEK (pemain)
def architect_sprite(frame):
    s = Spr(32, 48)
    sway = (0, 1)[frame % 2]
    s.poly([(7, 47), (10, 20), (14, 14), (18, 14), (22, 20), (25, 47)], "cream1")
    s.poly([(7, 47), (10, 20), (12, 19), (12, 47)], "cream2"); s.poly([(22, 20), (25, 47), (20, 47), (19, 19)], "cream0")
    s.rect(7, 44, 25, 46, "blue1"); s.rect(7, 44, 25, 44, "blue2")
    s.ell(9, 3, 22, 20, "blue1"); s.ell(11, 6, 20, 18, "ind0")
    s.poly([(9, 12), (11, 4), (16, 1), (21, 4), (23, 12), (21, 8), (16, 6), (11, 8)], "blue2")
    s.px(13, 13, "cyan3"); s.px(18, 13, "cyan3"); s.px(13, 14, "cyan2"); s.px(18, 14, "cyan2")
    s.shade_poly([(16, 24 + sway), (19, 28 + sway), (16, 32 + sway), (13, 28 + sway)], "gold", mid=2)
    s.px(16, 27 + sway, "snow3")
    glow(s, 16, 28 + sway, 6, "cyan1", 0.45)
    s.shade_poly([(16, 24 + sway), (19, 28 + sway), (16, 32 + sway), (13, 28 + sway)], "gold", mid=2)
    s.rect(8, 30, 10, 32, "skin2"); s.rect(22, 30, 24, 32, "skin1")
    return s.outline()


# ------------------------------------------------------------------ THE NULL
def null_portrait(expr, size=64):
    s = Spr(size, size); c = size // 2; r = size // 2 - 10
    rnd = random.Random(11)
    for i in range(14):
        a = rnd.uniform(0, 2 * math.pi); dist = r + rnd.randint(2, 8)
        px_, py_ = c + dist * math.cos(a), c + dist * math.sin(a)
        sz = rnd.randint(2, 4)
        s.poly([(px_, py_ - sz), (px_ + sz, py_), (px_, py_ + sz), (px_ - sz, py_)], rnd.choice(["mag1", "ind1", "mag0"]))
    s.ell(c - r, c - r, c + r, c + r, "void1"); s.ell(c - r + 3, c - r + 3, c + r - 3, c + r - 3, "void0")
    for k in range(7):
        a = rnd.uniform(0, 2 * math.pi)
        x1, y1 = c + (r - 1) * math.cos(a), c + (r - 1) * math.sin(a)
        x2, y2 = c + (r * 0.55) * math.cos(a + rnd.uniform(-.3, .3)), c + (r * 0.55) * math.sin(a + rnd.uniform(-.3, .3))
        s.line((round(x1), round(y1)), (round(x2), round(y2)), "mag1")
    ey = c - 3; dx = size // 7
    L, R = c - dx, c + dx
    if expr == "neutral":
        for ex in (L, R): s.poly([(ex - 4, ey), (ex, ey - 3), (ex + 4, ey), (ex, ey + 3)], "mag2"); s.px(ex, ey, "snow3")
    elif expr == "happy":
        for ex in (L, R): s.pts([(ex - 4, ey + 2), (ex - 2, ey), (ex, ey - 1), (ex + 2, ey), (ex + 4, ey + 2)], "mag3")
        s.pts([(c - 5, ey + 9), (c - 3, ey + 11), (c, ey + 12), (c + 3, ey + 11), (c + 5, ey + 9)], "mag2")
    elif expr == "surprised":
        for ex in (L, R): s.ell(ex - 3, ey - 4, ex + 3, ey + 4, "mag2"); s.px(ex, ey, "snow3")
        s.ell(c - 2, ey + 9, c + 2, ey + 13, "mag1")
    else:  # glitch / marah
        s.poly([(L - 5, ey - 4), (L + 4, ey), (L - 3, ey + 3)], "mag2"); s.poly([(R + 5, ey - 4), (R - 4, ey), (R + 3, ey + 3)], "mag2")
        s.rect(L - 6, ey + 6, L + 2, ey + 7, "snow3"); s.rect(R - 2, ey + 9, R + 6, ey + 10, "mag3")
    return s.outline()


def null_sprite(frame):
    return null_portrait("neutral", 48) if frame % 2 == 0 else null_portrait("surprised", 48)


# ------------------------------------------------------------------ GUARDIAN
def guardian_keeper(frame):
    s = Spr(96, 112); b = (0, 2)[frame % 2]
    # tubuh melayang (kerucut batu)
    s.shade_poly([(34, 70 + b), (62, 70 + b), (56, 108 + b), (40, 108 + b)], "stone", mid=1)
    s.shade_poly([(26, 38 + b), (70, 38 + b), (66, 76 + b), (30, 76 + b)], "stone", mid=2)
    s.rect(26, 56 + b, 70, 58 + b, "gold2"); s.rect(26, 56 + b, 70, 56 + b, "gold3")
    s.shade_poly([(36, 12 + b), (60, 12 + b), (62, 36 + b), (34, 36 + b)], "stone", mid=2)
    s.ell(43, 18 + b, 53, 30 + b, "gold1"); s.ell(45, 20 + b, 51, 28 + b, "gold2"); s.rect(47, 21 + b, 48, 24 + b, "snow3")
    s.poly([(34, 12 + b), (40, 6 + b), (56, 6 + b), (62, 12 + b)], "gold2")
    # lengan membentuk balok timbangan
    s.rect(2, 42 + b, 28, 46 + b, "stone2"); s.rect(68, 42 + b, 94, 46 + b, "stone2")
    s.rect(2, 42 + b, 28, 42 + b, "stone3"); s.rect(68, 42 + b, 94, 42 + b, "stone3")
    for x, off in ((8, 0), (88, 0)):
        s.line((x, 46 + b), (x - 7, 62 + b), "cream2"); s.line((x, 46 + b), (x + 7, 62 + b), "cream2")
        s.ell(x - 10, 60 + b, x + 10, 68 + b, "gold2"); s.ell(x - 8, 61 + b, x + 8, 65 + b, "gold0")
    # simbol = dan ±
    s.glyph("=", 46, 44 + b, "gold3") if False else s.glyph("=", 46, 44 + b, "gold3")
    return s.outline()


def guardian_twins(frame):
    s = Spr(160, 112); b = (0, 2)[frame % 2]
    def sentinel(x0, body, trim, eye):
        s.shade_poly([(x0 + 10, 30 + b), (x0 + 50, 30 + b), (x0 + 56, 100 + b), (x0 + 4, 100 + b)], body, mid=2)
        s.shade_poly([(x0 + 4, 12 + b), (x0 + 56, 12 + b), (x0 + 50, 34 + b), (x0 + 10, 34 + b)], body, mid=2)
        s.rect(x0 + 12, 18 + b, x0 + 48, 26 + b, "ind0"); s.rect(x0 + 16, 20 + b, x0 + 44, 24 + b, eye)
        s.rect(x0 + 28, 20 + b, x0 + 32, 24 + b, "snow3")
        s.rect(x0 + 8, 56 + b, x0 + 52, 58 + b, trim); s.rect(x0 + 8, 82 + b, x0 + 52, 83 + b, trim)
        s.poly([(x0 + 24, 4 + b), (x0 + 30, 0 + b), (x0 + 36, 4 + b), (x0 + 30, 12 + b)], trim)
        s.shade_poly([(x0 + 26, 62 + b), (x0 + 34, 62 + b), (x0 + 36, 76 + b), (x0 + 24, 76 + b)], "ind", mid=1)
    sentinel(4, "cyan", "gold2", "cyan3")
    sentinel(96, "snow", "cyan2", "gold3")
    for x in range(66, 96, 3):
        s.px(x, 46 + b + int(3 * math.sin(x / 3 + frame)), "cyan3"); s.px(x, 47 + b + int(3 * math.sin(x / 3 + frame)), "cyan2")
    s.ell(76, 42 + b, 84, 52 + b, "cyan2"); s.ell(78, 44 + b, 82, 50 + b, "snow3")
    return s.outline()


def guardian_devourer(frame):
    s = Spr(128, 112); b = (0, 2)[frame % 2]
    # tubuh blok-polinomial menjulur ke kiri
    for i, (x0, lab) in enumerate([(2, "x"), (22, "2"), (42, "x")]):
        yy = 66 + i * 6 + b
        s.shade_poly([(x0, yy), (x0 + 20, yy), (x0 + 20, yy + 30), (x0, yy + 30)], "vio", mid=1)
        s.glyph(lab, x0 + 8, yy + 12, "mag3")
        s.rect(x0, yy, x0 + 20, yy, "gold2")
    # mulut besar
    cx, cy = 86, 56 + b
    s.ell(cx - 40, cy - 46, cx + 40, cy + 46, "vio1"); s.ell(cx - 34, cy - 40, cx + 34, cy + 40, "vio2")
    s.ell(cx - 26, cy - 32, cx + 26, cy + 32, "mag0"); s.ell(cx - 18, cy - 24, cx + 18, cy + 24, "void0")
    s.ell(cx - 8, cy - 12, cx + 8, cy + 12, "mag1"); s.ell(cx - 4, cy - 6, cx + 4, cy + 6, "mag3")
    for a in range(0, 360, 20):
        x1 = cx + 26 * math.cos(math.radians(a)); y1 = cy + 32 * math.sin(math.radians(a))
        x2 = cx + 15 * math.cos(math.radians(a + 5)); y2 = cy + 19 * math.sin(math.radians(a + 5))
        x3 = cx + 26 * math.cos(math.radians(a + 12)); y3 = cy + 32 * math.sin(math.radians(a + 12))
        s.poly([(x1, y1), (x2, y2), (x3, y3)], "snow3")
    for dxy in [(-30, -34), (30, -34)]:
        s.ell(cx + dxy[0] - 5, cy + dxy[1] - 3, cx + dxy[0] + 5, cy + dxy[1] + 3, "gold2"); s.px(cx + dxy[0], cy + dxy[1], "snow3")
    s.glyph("2", cx + 36, cy - 44, "gold3"); s.glyph("x", cx + 30, cy - 38, "gold3")
    return s.outline()


def guardian_null_architect(frame):
    s = Spr(128, 128); b = (0, 2)[frame % 2]
    rnd = random.Random(5)
    # halo pecah
    for i in range(18):
        a = math.radians(i * 20 + 8); rr = 54
        x, y = 64 + rr * math.cos(a), 52 + b + rr * 0.8 * math.sin(a)
        sz = 3 + (i % 3)
        s.poly([(x, y - sz), (x + sz, y), (x, y + sz), (x - sz, y)], ["mag2", "snow2", "ind2"][i % 3])
    # jubah
    s.poly([(64, 18 + b), (92, 52 + b), (104, 118), (24, 118), (36, 52 + b)], "void1")
    s.poly([(64, 18 + b), (36, 52 + b), (24, 118), (50, 118), (56, 60 + b)], "void0")
    for k in range(5):
        x1 = 40 + k * 12; s.line((x1, 118), (x1 + rnd.randint(-8, 8), 70 + b), "ind1")
    # tudung & wajah kosong
    s.ell(46, 22 + b, 82, 62 + b, "void0"); s.ell(50, 28 + b, 78, 58 + b, "void1") if False else None
    s.ell(50, 30 + b, 78, 58 + b, "void0")
    s.poly([(52, 42 + b), (60, 40 + b), (62, 46 + b), (54, 46 + b)], "mag2"); s.poly([(76, 42 + b), (68, 40 + b), (66, 46 + b), (74, 46 + b)], "mag2")
    s.px(57, 43 + b, "snow3"); s.px(71, 43 + b, "snow3")
    # inti matriks di dada
    s.rect(52, 70 + b, 76, 94 + b, "ind0")
    for i in range(2):
        for j in range(2):
            c = ["mag2", "cyan2", "gold2", "snow2"][(i * 2 + j + frame) % 4]
            s.rect(54 + j * 11, 72 + b + i * 11, 63 + j * 11 - 0, 81 + b + i * 11, c)
    s.frame(52, 70 + b, 76, 94 + b, "gold2")
    # tangan melayang
    for sx in (14, 114):
        s.ell(sx - 7, 84 + b, sx + 7, 98 + b, "void1"); s.px(sx, 90 + b, "mag3")
    return s.outline("ind1")
