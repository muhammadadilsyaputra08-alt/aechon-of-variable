"""Tileset 16x16 per tier dan latar belakang VN 320x180 (ruined / restored)."""
import math
import random
from core import *

TIERS = {
    1: dict(name="foundation", arch=["cream0", "cream1", "cream2", "cream3"], acc=["gold0", "gold1", "gold2", "gold3"],
            sky_ok=["blue1", "blue2", "blue3", "cream3"], sky_ruin=["ind0", "stone1", "stone2", "cream1"], moss=True),
    2: dict(name="energy_network", arch=["stone0", "stone1", "stone2", "stone3"], acc=["cyan0", "cyan1", "cyan2", "cyan3"],
            sky_ok=["cyan0", "cyan1", "cyan2", "snow2"], sky_ruin=["ind0", "stone0", "stone1", "stone2"], moss=False),
    3: dict(name="resonance_chambers", arch=["vio0", "vio1", "stone2", "stone3"], acc=["mag0", "mag1", "mag2", "mag3"],
            sky_ok=["vio0", "vio1", "mag1", "gold2"], sky_ruin=["void0", "ind0", "vio0", "stone1"], moss=False),
    4: dict(name="dimensional_sanctum", arch=["ind0", "ind1", "ind2", "snow1"], acc=["gold1", "gold2", "gold3", "snow3"],
            sky_ok=["void0", "ind0", "ind1", "ind2"], sky_ruin=["void0", "void1", "ind0", "stone0"], moss=False),
}
DEAD = ["stone0", "stone1", "stone2", "stone3"]

TILE_NAMES = ["floor", "floor_cracked", "floor_rune", "wall_brick", "wall_brick_cracked", "wall_top",
              "pillar_base", "pillar_shaft", "pillar_cap", "crystal_lit", "crystal_dead", "platform_edge"]


def tile(tier, name):
    T = TIERS[tier]; A = T["arch"]; C = T["acc"]
    s = Spr(16, 16); r = random.Random(tier * 100 + TILE_NAMES.index(name))
    def noise(base, light, dark, n=10):
        for _ in range(n):
            x, y = r.randrange(16), r.randrange(16); s.px(x, y, r.choice([light, dark]))
    if name in ("floor", "floor_cracked", "floor_rune"):
        s.rect(0, 0, 15, 15, A[1]); s.rect(0, 0, 15, 0, A[2]); s.rect(0, 15, 15, 15, A[0]); s.rect(0, 0, 0, 15, A[2]); s.rect(15, 0, 15, 15, A[0])
        noise(A[1], A[2], A[0], 12)
        if name == "floor_cracked":
            for p in [(3, 2), (4, 3), (5, 4), (5, 5), (6, 6), (7, 7), (8, 7), (9, 8), (10, 9), (10, 10), (11, 11)]: s.px(*p, A[0])
        if name == "floor_rune":
            s.frame(4, 4, 11, 11, C[2]); s.px(7, 7, C[3]); s.px(8, 8, C[3]); s.px(7, 8, C[1]); s.px(8, 7, C[1])
    elif name in ("wall_brick", "wall_brick_cracked"):
        s.rect(0, 0, 15, 15, A[1])
        for y in (0, 5, 10, 15): s.rect(0, y, 15, y, A[0])
        for y, off in ((0, 0), (5, 4), (10, 0)):
            for x in range(off, 16, 8): s.rect(x, y, x, y + 4, A[0])
        for y in (1, 6, 11): s.rect(0, y, 15, y, A[2])
        noise(A[1], A[2], A[0], 8)
        if name == "wall_brick_cracked":
            for p in [(7, 0), (7, 1), (8, 2), (8, 3), (9, 4), (10, 5), (10, 6), (11, 7), (11, 8), (12, 9)]: s.px(*p, A[0])
            s.rect(12, 10, 14, 11, "void0")
    elif name == "wall_top":
        s.rect(0, 4, 15, 15, A[1]); s.rect(0, 2, 15, 5, A[2]); s.rect(0, 2, 15, 2, A[3]); s.rect(0, 5, 15, 5, A[0])
        for x in range(0, 16, 4): s.rect(x, 0, x + 2, 2, A[2]); s.rect(x, 0, x + 2, 0, A[3])
        for y in (9, 14): s.rect(0, y, 15, y, A[0])
    elif name == "pillar_base":
        s.rect(1, 8, 14, 15, A[1]); s.rect(1, 8, 14, 9, A[2]); s.rect(3, 4, 12, 8, A[2]); s.rect(1, 14, 14, 15, A[0])
        s.rect(3, 4, 4, 8, A[3]); s.rect(11, 4, 12, 8, A[1])
    elif name == "pillar_shaft":
        s.rect(3, 0, 12, 15, A[2]); s.rect(3, 0, 5, 15, A[3]); s.rect(10, 0, 12, 15, A[1]); s.rect(12, 0, 12, 15, A[0])
        for y in range(0, 16, 4): s.rect(6, y, 8, y, A[1])
    elif name == "pillar_cap":
        s.rect(3, 8, 12, 15, A[2]); s.rect(3, 8, 5, 15, A[3]); s.rect(10, 8, 12, 15, A[1])
        s.rect(0, 3, 15, 8, A[2]); s.rect(0, 3, 15, 4, A[3]); s.rect(0, 8, 15, 8, A[0]); s.rect(0, 1, 15, 2, C[2]); s.rect(0, 1, 15, 1, C[3])
    elif name in ("crystal_lit", "crystal_dead"):
        s.rect(2, 12, 13, 15, A[1]); s.rect(2, 12, 13, 12, A[2])
        ramp = "cyan" if False else None
        cols = C if name == "crystal_lit" else DEAD
        s.poly([(8, 0), (13, 6), (12, 12), (4, 12), (3, 6)], cols[2]); s.poly([(8, 0), (3, 6), (4, 12), (7, 12)], cols[3])
        s.poly([(8, 0), (13, 6), (12, 12), (10, 12)], cols[1]); s.px(6, 4, "snow3" if name == "crystal_lit" else DEAD[3])
        if name == "crystal_lit": glow(s, 8, 6, 8, C[1], 0.35); s.poly([(8, 0), (13, 6), (12, 12), (4, 12), (3, 6)], cols[2]); s.poly([(8, 0), (3, 6), (4, 12), (7, 12)], cols[3]); s.poly([(8, 0), (13, 6), (12, 12), (10, 12)], cols[1]); s.px(6, 4, "snow3")
    elif name == "platform_edge":
        s.rect(0, 0, 15, 5, A[2]); s.rect(0, 0, 15, 1, A[3]); s.rect(0, 5, 15, 5, A[0])
        s.poly([(0, 6), (15, 6), (12, 15), (3, 15)], A[1]); s.poly([(0, 6), (3, 6), (4, 15), (3, 15)], A[2])
        for x in range(2, 14, 3): s.px(x, 3, C[2])
    return s


# ---------------------------------------------------------------- LATAR 320x180
W, H = 320, 180


def column(s, x, y_top, y_bot, A, broken=False, r=None):
    w = 14
    for i in range(w):
        t = y_top + (r.randint(0, 7) if broken else 0)
        col = A[2] if i < 4 else (A[0] if i >= w - 3 else A[1])
        s.rect(x + i, t, x + i, y_bot, col)
    for y in range(y_top + 8, y_bot, 9):
        s.rect(x + 5, y, x + 8, y, A[0])
    s.rect(x - 3, y_bot - 5, x + w + 2, y_bot, A[2]); s.rect(x - 3, y_bot - 5, x + w + 2, y_bot - 5, A[3])
    if not broken:
        s.rect(x - 3, y_top - 6, x + w + 2, y_top, A[2]); s.rect(x - 3, y_top - 6, x + w + 2, y_top - 6, A[3])
        s.rect(x - 5, y_top - 9, x + w + 4, y_top - 6, A[3]); s.rect(x - 5, y_top - 9, x + w + 4, y_top - 9, "snow2" if A[3] != "snow1" else "snow3")


def crystal_big(s, cx, base, h, cols, w=10):
    s.poly([(cx, base - h), (cx + w // 2 + 1, base - h * 0.6), (cx + w // 2, base), (cx - w // 2, base), (cx - w // 2 - 1, base - h * 0.6)], cols[2])
    s.poly([(cx, base - h), (cx - w // 2 - 1, base - h * 0.6), (cx - w // 2, base), (cx - 1, base)], cols[3])
    s.poly([(cx, base - h), (cx + w // 2 + 1, base - h * 0.6), (cx + w // 2, base), (cx + 2, base)], cols[1])
    s.px(cx - 2, base - h * 0.7, "snow3" if cols[3] != "stone3" else "stone3")


def background(tier, restored, seed=1):
    T = TIERS[tier]; r = random.Random(tier * 31 + (1 if restored else 0) + seed)
    A = T["arch"] if restored else DEAD
    C = T["acc"] if restored else DEAD
    sky = T["sky_ok"] if restored else T["sky_ruin"]
    s = Spr(W, H)
    dither_gradient(s, 0, 0, W - 1, 139, sky)
    # bintang / debu
    for _ in range(70 if restored else 26):
        x, y = r.randrange(W), r.randrange(0, 110)
        s.px(x, y, r.choice([C[3], "snow3"]) if restored else r.choice(["stone2", "stone1"]))
    # menara jauh (siluet)
    far = (A[1] if tier == 1 else A[0]) if restored else "stone0"
    x = -4
    while x < W:
        w_, h_ = r.randint(10, 22), r.randint(35, 95)
        if not restored: h_ = int(h_ * r.uniform(0.35, 0.9))
        s.rect(x, 140 - h_, x + w_, 140, far)
        if r.random() < .6 and restored: s.poly([(x, 140 - h_), (x + w_ // 2, 140 - h_ - 10), (x + w_, 140 - h_)], far)
        if restored:
            for yy in range(140 - h_ + 6, 138, 9):
                if r.random() < .5: s.px(x + w_ // 2, yy, C[3])
        x += w_ + r.randint(2, 12)
    # lantai
    for y in range(140, H):
        for x in range(W):
            k = (y - 140) // 10
            s.px(x, y, A[1] if (x // 20 + k) % 2 == 0 else A[0])
    for y in range(140, H, 10): s.rect(0, y, W - 1, y, A[2])
    s.rect(0, 140, W - 1, 141, A[3] if restored else "stone2")
    for y in range(142, H):
        for x in range(W):
            if BAYER[y % 4][x % 4] < (y - 142) / (H - 142) * 5 and s.get(x, y)[3]: s.px(x, y, "ink" if False else A[0])
    # kolom sisi
    for i, cx in enumerate((14, 52, 252, 290)):
        top = 36 + i % 2 * 12
        if restored: column(s, cx, top, 139, A)
        else:
            tt = top + r.randint(10, 60) if i != 1 else 100
            column(s, cx, tt, 139, A, broken=True, r=r)
    # dekor khas tier
    decor(s, tier, restored, A, C, r)
    # reruntuhan / balok jatuh
    if not restored:
        for _ in range(16):
            x, y = r.choice([r.randrange(0, 100), r.randrange(220, 316)]), r.randrange(144, 176)
            w_ = r.randint(3, 8); s.rect(x, y, x + w_, y + r.randint(2, 4), r.choice(["stone1", "stone2"])); s.rect(x, y, x + w_, y, "stone3")
    else:
        # sorot cahaya diagonal (dither)
        for y in range(0, 140):
            for x in range(W):
                x0 = 150 + (y * 0.5)
                if abs(x - x0) < 18 and BAYER[y % 4][x % 4] < 3 and (x + y) % 2 == 0: s.px(x, y, sky[-1])
    return s


def decor(s, tier, restored, A, C, r):
    if tier == 1:
        # pedestal dengan kristal emas + sulur lumut
        for cx in (30, 290):
            s.rect(cx - 8, 128, cx + 8, 139, A[2]); s.rect(cx - 8, 128, cx + 8, 128, A[3])
            crystal_big(s, cx, 127, 22 if restored else 12, C)
        if restored:
            for x in range(0, W, 7):
                n = r.randint(3, 10)
                if x < 80 or x > 240:
                    for y in range(0, n): s.px(x, y, "moss1" if y % 3 else "moss2")
            for _ in range(14):
                s.px(r.choice([r.randrange(4, 80), r.randrange(240, 316)]), r.randrange(150, 176), "moss2")
    elif tier == 2:
        # rel energi + node
        ys = (60, 90, 120)
        for i, y in enumerate(ys):
            for x in range(0, W):
                if restored: s.px(x, y, C[2] if (x // 6 + i) % 4 else C[3])
                elif x % 6 < 3: s.px(x, y, "stone1")
            for nx in (40 + i * 40, 280 - i * 40):
                s.ell(nx - 5, y - 5, nx + 5, y + 5, A[2]); s.ell(nx - 3, y - 3, nx + 3, y + 3, C[2] if restored else "stone0")
                if restored: s.px(nx, y, "snow3")
        for px_ in (96, 224):
            s.rect(px_, 140, px_ + 3, 146, A[2])
    elif tier == 3:
        # kristal resonansi besar + cincin parabola
        for cx, h in ((70, 70), (250, 76), (36, 44), (284, 40)):
            crystal_big(s, cx, 139, h if restored else h // 2, C, w=14)
        for a in range(200, 341, 3):
            x = 160 + 90 * math.cos(math.radians(a)); y = 100 + 70 * math.sin(math.radians(a))
            s.px(round(x), round(y), C[3] if restored else "stone2")
        if restored:
            glow(s, 160, 40, 26, C[1], 0.5)
    else:
        # portal cincin + pulau melayang + garis grid
        cx, cy = 160, 78
        for a in range(0, 360, 2):
            for rr in (44, 45, 46):
                x = cx + rr * math.cos(math.radians(a)); y = cy + rr * 0.95 * math.sin(math.radians(a))
                s.px(round(x), round(y), C[3] if (a // 10) % 2 == 0 else C[1]) if restored else s.px(round(x), round(y), "stone2" if a % 12 < 6 else "stone1")
        if restored:
            for i in range(-40, 41, 10):
                s.line((cx + i, cy - 40), (cx + i, cy + 40), "ind2") if abs(i) < 38 else None
                s.line((cx - 40, cy + i), (cx + 40, cy + i), "ind2") if abs(i) < 38 else None
            glow(s, cx, cy, 36, "ind3", 0.4)
        for fx, fy, fw in ((44, 70, 36), (236, 56, 40), (110, 24, 20)):
            if not restored: fy += 20
            s.poly([(fx, fy), (fx + fw, fy), (fx + fw - 6, fy + 10), (fx + fw // 2, fy + 16), (fx + 6, fy + 10)], A[2])
            s.rect(fx, fy, fx + fw, fy, A[3])
