"""Objek puzzle, balance scale, UI kit, ikon."""
import math
from core import *

# ------------------------------------------------------------------ KRISTAL 16x16
# Bentuk = tanda (naik = positif, turun = negatif) + glyph nilai + warna  → tidak bergantung warna saja.
CRYSTALS = {
    "unit":  dict(ramp="blue", glyph="1", pts=[(8, 1), (13, 8), (8, 14), (3, 8)]),
    "x":     dict(ramp="gold", glyph="x", pts=[(5, 2), (10, 2), (13, 8), (10, 14), (5, 14), (2, 8)]),
    "neg1":  dict(ramp="red",  glyph="1", pts=[(3, 2), (12, 2), (13, 5), (8, 14), (2, 5)]),
    "negx":  dict(ramp="vio",  glyph="x", pts=[(2, 2), (13, 2), (8, 14)]),
}


def crystal(kind, state="normal"):
    c = CRYSTALS[kind]; s = Spr(16, 16)
    if state == "ghost":
        s.poly(c["pts"], "stone0")
        for y in range(16):
            for x in range(16):
                if s.get(x, y)[3] and (x + y) % 2 == 0:
                    s.px(x, y, "stone1")
        return s.outline("stone2")
    s.shade_poly(c["pts"], c["ramp"], mid=2)
    s.px(5 if kind != "negx" else 4, 4, "snow3")
    gx, gy = 6, (5 if kind != "negx" else 4)
    s.glyph(c["glyph"], gx, gy, f"{c['ramp']}0")
    return s.outline("snow3" if state == "selected" else "ink")


def mystery_box(open_=False):
    s = Spr(16, 16)
    s.rect(2, 5, 13, 14, "stone1"); s.rect(2, 5, 4, 14, "stone2"); s.rect(11, 5, 13, 14, "stone0")
    s.rect(2, 2, 13, 5, "stone2"); s.rect(2, 2, 13, 2, "stone3")
    s.rect(2, 8, 13, 8, "gold1")
    if open_:
        s.rect(4, 3, 11, 6, "gold3"); s.pts([(5, 4), (9, 5)], "snow3")
    else:
        s.glyph("?", 6, 8 + 0, "gold3") if False else s.glyph("?", 6, 8, "gold3")
    return s.outline()


# ------------------------------------------------------------------ OBJEK 32x32
def chest(open_=False):
    s = Spr(32, 32)
    s.rect(4, 15, 27, 28, "cream1"); s.rect(4, 15, 7, 28, "cream2"); s.rect(24, 15, 27, 28, "cream0")
    s.rect(4, 26, 27, 28, "cream0"); s.rect(4, 19, 27, 20, "gold1"); s.rect(4, 19, 27, 19, "gold2")
    if open_:
        s.rect(6, 12, 25, 16, "gold3")
        for x in range(6, 26, 2): s.px(x, 13, "gold2")
        s.poly([(4, 12), (7, 3), (24, 3), (27, 12)], "cream2"); s.rect(7, 3, 24, 4, "cream3")
        s.rect(7, 7, 24, 8, "gold1")
        for p in [(11, 8), (16, 5), (20, 9)]: s.px(*p, "snow3")
    else:
        s.rect(4, 9, 27, 15, "cream2"); s.rect(4, 9, 27, 10, "cream3"); s.rect(4, 12, 27, 13, "gold1")
        s.rect(14, 16, 17, 22, "gold2"); s.rect(15, 18, 16, 19, "ink")
    return s.outline()


def energy_node(on):
    s = Spr(32, 32)
    s.ell(5, 5, 26, 26, "stone2"); s.ell(7, 7, 24, 24, "stone1")
    s.ell(10, 10, 21, 21, "cyan2" if on else "stone0")
    if on:
        s.ell(12, 12, 19, 19, "cyan3"); s.rect(15, 14, 16, 17, "snow3")
    else:
        s.ell(12, 12, 19, 19, "stone1")
    for a in range(0, 360, 45):
        x = 15.5 + 12 * math.cos(math.radians(a)); y = 15.5 + 12 * math.sin(math.radians(a))
        s.px(round(x), round(y), "gold2" if on else "stone3")
    return s.outline()


def gate(on):
    s = Spr(32, 32)
    for x0 in (3, 23):
        s.rect(x0, 6, x0 + 5, 29, "stone2"); s.rect(x0, 6, x0 + 1, 29, "stone3"); s.rect(x0 + 4, 6, x0 + 5, 29, "stone1")
        s.rect(x0 - 1, 27, x0 + 6, 29, "stone1"); s.rect(x0 - 1, 4, x0 + 6, 7, "gold2"); s.rect(x0 - 1, 4, x0 + 6, 4, "gold3")
    s.rect(9, 4, 22, 8, "stone2"); s.rect(9, 4, 22, 5, "stone3")
    if on:
        dither_gradient(s, 9, 9, 22, 28, ["cyan1", "cyan2", "cyan3"], vertical=True)
        for p in [(12, 14), (18, 20), (15, 24), (20, 12)]: s.px(*p, "snow3")
    else:
        s.rect(9, 9, 22, 28, "void0")
        for y in range(9, 29):
            for x in range(9, 23):
                if (x + y) % 4 == 0: s.px(x, y, "void1")
    return s.outline()


def ring():
    s = Spr(32, 32)
    s.ell(2, 2, 29, 29, "gold2"); s.ell(5, 5, 26, 26, (0, 0, 0, 0))
    for y in range(32):
        for x in range(32):
            if s.get(x, y)[3] and x + y < 26: s.px(x, y, "gold3")
            elif s.get(x, y)[3] and x + y > 36: s.px(x, y, "gold1")
    return s.outline()


def target_marker():
    s = Spr(32, 32)
    s.ell(4, 4, 27, 27, "cyan2"); s.ell(6, 6, 25, 25, (0, 0, 0, 0))
    s.rect(15, 0, 16, 9, "cyan3"); s.rect(15, 22, 16, 31, "cyan3")
    s.rect(0, 15, 9, 16, "cyan3"); s.rect(22, 15, 31, 16, "cyan3")
    s.ell(12, 12, 19, 19, "gold2"); s.ell(14, 14, 17, 17, "gold3")
    return s.outline()


def barrier():
    s = Spr(32, 32)
    for y in range(0, 32, 6):
        s.rect(13, y, 18, y + 3, "red2"); s.rect(13, y, 14, y + 3, "red3"); s.rect(17, y, 18, y + 3, "red1")
    s.glyph("x", 14, 1, "snow3"); s.glyph("x", 14, 25, "snow3")
    return s.outline()


def factor_machine(active):
    s = Spr(32, 32)
    s.rect(5, 8, 26, 24, "stone2"); s.rect(5, 8, 8, 24, "stone3"); s.rect(23, 8, 26, 24, "stone1")
    s.poly([(2, 2), (29, 2), (23, 8), (8, 8)], "stone1"); s.rect(2, 2, 29, 3, "stone2")
    s.rect(7, 24, 12, 30, "stone1"); s.rect(19, 24, 24, 30, "stone1")
    s.rect(8, 28, 11, 29, "cyan2" if active else "stone0"); s.rect(20, 28, 23, 29, "cyan2" if active else "stone0")
    s.ell(10, 10, 21, 21, "gold1" if not active else "gold2")
    s.ell(13, 13, 18, 18, "stone0" if not active else "gold3")
    for a in range(0, 360, 60):
        x = 15.5 + 7 * math.cos(math.radians(a)); y = 15.5 + 7 * math.sin(math.radians(a))
        s.px(round(x), round(y), "gold3" if active else "gold1")
    if active:
        for p in [(9, 26), (22, 26), (15, 5)]: s.px(*p, "cyan3")
    return s.outline()


def reactor(on):
    s = Spr(32, 32)
    s.rect(7, 25, 24, 29, "stone1"); s.rect(7, 25, 24, 26, "stone2"); s.rect(7, 3, 24, 6, "stone1"); s.rect(7, 3, 24, 4, "stone2")
    s.rect(10, 7, 21, 24, "ind0")
    if on:
        dither_gradient(s, 10, 7, 21, 24, ["cyan1", "cyan2", "cyan3"], vertical=False)
        s.rect(14, 8, 17, 23, "snow3")
        for p in [(11, 10), (20, 14), (12, 20), (19, 22)]: s.px(*p, "gold3")
    else:
        s.rect(14, 8, 17, 23, "stone1")
    s.rect(8, 10, 9, 22, "stone2"); s.rect(22, 10, 23, 22, "stone2")
    for y in (10, 16, 22): s.rect(9, y, 22, y, "gold1" if on else "stone1")
    return s.outline()


def tome():
    s = Spr(32, 32)
    s.poly([(2, 10), (15, 7), (15, 26), (2, 29)], "cream2"); s.poly([(16, 7), (29, 10), (29, 29), (16, 26)], "cream3")
    s.rect(15, 7, 16, 26, "vio1")
    for i in range(4):
        s.line((4, 13 + i * 3), (13, 11 + i * 3), "cream0"); s.line((18, 11 + i * 3), (27, 13 + i * 3), "cream1")
    s.glyph("=", 21, 17, "gold1")
    glow(s, 23, 17, 6, "gold2", 0.6)
    s.glyph("=", 21, 17, "gold1")
    return s.outline()


def matrix_cell():
    s = Spr(32, 32)
    for x0, y0, g in [(6, 6, "2"), (17, 6, "0"), (6, 17, "0"), (17, 17, "2")]:
        s.rect(x0, y0, x0 + 8, y0 + 8, "ind1"); s.frame(x0, y0, x0 + 8, y0 + 8, "ind2")
        s.glyph(g, x0 + 3, y0 + 2, "snow3" if g != "0" else "ind3")
    for x0, dx in [(2, 1), (29, -1)]:
        s.rect(x0, 3, x0, 28, "gold2"); s.rect(x0, 3, x0 + 2 * dx, 3, "gold2"); s.rect(x0, 28, x0 + 2 * dx, 28, "gold2")
    return s.outline()


def eigen_arrow():
    s = Spr(32, 32)
    for y in range(2, 32, 6):
        for x in range(2, 32, 6): s.px(x, y, "ind2")
    s.line((4, 28), (23, 9), "gold2"); s.line((5, 28), (24, 9), "gold3"); s.line((4, 27), (23, 8), "gold2")
    s.poly([(28, 4), (17, 8), (24, 15)], "gold3")
    return s.outline()


def complex_orb():
    s = Spr(32, 32)
    s.ell(3, 3, 28, 28, "ind1"); s.ell(5, 5, 26, 26, "ind0")
    s.rect(5, 15, 26, 15, "ind2"); s.rect(15, 5, 15, 26, "ind2")
    s.line((15, 15), (22, 8), "mag2"); s.ell(21, 7, 23, 9, "mag3")
    s.glyph("i", 17, 6, "snow2")
    glow(s, 22, 8, 5, "mag1", 0.5); s.ell(21, 7, 23, 9, "mag3")
    return s.outline()


OBJECTS = {
    "chest_closed": lambda: chest(False), "chest_open": lambda: chest(True),
    "energy_node_off": lambda: energy_node(False), "energy_node_on": lambda: energy_node(True),
    "gate_off": lambda: gate(False), "gate_on": lambda: gate(True),
    "ring_target": ring, "coord_target": target_marker, "forbidden_barrier": barrier,
    "factor_machine_idle": lambda: factor_machine(False), "factor_machine_active": lambda: factor_machine(True),
    "exponent_reactor_off": lambda: reactor(False), "exponent_reactor_on": lambda: reactor(True),
    "log_archive_tome": tome, "matrix_cell": matrix_cell, "eigen_arrow": eigen_arrow, "complex_orb": complex_orb,
}


# ------------------------------------------------------------------ BALANCE SCALE 96x64
def balance_scale(tilt):
    """tilt: -1 kiri berat, 0 seimbang, +1 kanan berat"""
    s = Spr(96, 64)
    dy = {-1: 6, 0: 0, 1: -6}[tilt]
    yl, yr = 18 + dy, 18 - dy
    s.poly([(36, 63), (59, 63), (54, 54), (41, 54)], "stone1"); s.rect(36, 62, 59, 63, "stone0")
    s.rect(41, 52, 54, 55, "stone2")
    s.rect(46, 22, 49, 52, "stone2"); s.rect(46, 22, 47, 52, "stone3"); s.rect(49, 22, 49, 52, "stone1")
    for k in (-1, 0, 1):
        s.line((16, yl + k), (79, yr + k), "cream1")
    s.line((16, yl - 1), (79, yr - 1), "cream2")
    s.ell(43, 14, 52, 23, "gold2"); s.ell(45, 16, 50, 21, "gold3")
    for x, y in ((16, yl), (79, yr)):
        s.ell(x - 2, y - 2, x + 2, y + 2, "gold2")
        s.line((x, y), (x - 12, y + 16), "stone3"); s.line((x, y), (x + 12, y + 16), "stone3")
        s.ell(x - 14, y + 13, x + 14, y + 23, "gold1")
        s.rect(x - 14, y + 17, x + 14, y + 18, (0, 0, 0, 0))
        s.ell(x - 14, y + 13, x + 14, y + 20, "gold2")
        s.ell(x - 12, y + 14, x + 12, y + 18, "gold0")
        s.line((x - 12, y + 16), (x + 12, y + 16), "gold3") if False else None
    return s.outline()


# ------------------------------------------------------------------ UI
def nine_panel(w, h, outer="ink", trim="gold2", fill="ind0", inner="ind1", corner=True):
    s = Spr(w, h)
    s.rect(1, 0, w - 2, h - 1, outer); s.rect(0, 1, w - 1, h - 2, outer)
    s.rect(1, 1, w - 2, h - 2, trim); s.rect(2, 2, w - 3, h - 3, fill)
    s.frame(3, 3, w - 4, h - 4, inner)
    s.rect(2, 2, w - 3, 2, "gold3" if trim == "gold2" else trim)
    if corner:
        for x, y in ((2, 2), (w - 5, 2), (2, h - 5), (w - 5, h - 5)):
            s.rect(x, y, x + 2, y + 2, "gold3"); s.px(x + 1, y + 1, "gold1")
    return s


def button9(state):
    fill = {"normal": "ind2", "pressed": "ind1", "disabled": "stone1"}[state]
    hi = {"normal": "ind3", "pressed": "ind2", "disabled": "stone2"}[state]
    lo = {"normal": "ind1", "pressed": "ind0", "disabled": "stone0"}[state]
    s = Spr(32, 32)
    s.rect(1, 0, 30, 31, "ink"); s.rect(0, 1, 31, 30, "ink")
    s.rect(1, 1, 30, 30, "gold2" if state != "disabled" else "stone2")
    s.rect(2, 2, 29, 29, fill)
    off = 1 if state == "pressed" else 0
    s.rect(2, 2 + off, 29, 3 + off, hi); s.rect(2, 28, 29, 29, lo)
    s.rect(2, 2, 2, 29, hi) if state != "pressed" else None
    return s


def g_grid(fn):
    g = [[0] * 12 for _ in range(12)]
    fn(g); return g


def _g_bulb(g):
    rows = ["....####....", "..########..", ".##########.", ".##########.", ".##########.", ".##########.",
            "..########..", "...######...", "....####....", "....####....", "....####....", ".....##....."]
    for y, r in enumerate(rows):
        for x, c in enumerate(r): g[y][x] = c == "#"
    g[3][4] = g[3][5] = 0


def _g_undo(g):
    rows = ["............", "....#.......", "...##.......", "..###.......", ".###########", ".###########",
            "..###.......", "...##.......", "....#.......", "............", "............", "............"]
    for y, r in enumerate(rows):
        for x, c in enumerate(r): g[y][x] = c == "#"


def _g_reset(g):
    for y in range(12):
        for x in range(12):
            d = math.hypot(x - 5.5, y - 6.5); a = math.degrees(math.atan2(6.5 - y, x - 5.5)) % 360
            if 2.6 <= d <= 5.2 and not (15 < a < 75): g[y][x] = 1
    for p in [(7, 0), (8, 0), (9, 0), (10, 0), (11, 0), (9, 1), (10, 1), (11, 1), (11, 2), (10, 2), (11, 3)]: g[p[1]][p[0]] = 1


def _g_book(g):
    for y in range(2, 11):
        for x in range(12): g[y][x] = 1
    for y in range(2, 11): g[y][5] = g[y][6] = 0
    for y in (4, 6, 8):
        for x in list(range(1, 5)) + list(range(7, 11)): g[y][x] = 0


def _g_pause(g):
    for y in range(1, 11):
        for x in (2, 3, 4, 7, 8, 9): g[y][x] = 1


def _g_play(g):
    for y in range(1, 11):
        w = min(y, 11 - y) + 1
        for x in range(2, 2 + w + 1): g[y][x] = 1


def _g_skip(g):
    for y in range(1, 11):
        w = (min(y, 11 - y) + 1) // 2 + 1
        for x in range(0, w + 1): g[y][x] = 1
        for x in range(6, 6 + w + 1): g[y][x] = 1
    for y in range(1, 11): g[y][11] = 1


def _g_hist(g):
    for y in (2, 5, 8):
        g[y][0] = g[y][1] = 1
        for x in range(3, 12): g[y][x] = 1
        for x in range(3, 12): g[y + 1][x] = 1 if x < 9 else 0


def _g_gear(g):
    for y in range(12):
        for x in range(12):
            d = math.hypot(x - 5.5, y - 5.5)
            if 1.8 <= d <= 4.0: g[y][x] = 1
    for a in range(0, 360, 45):
        for r in (4.5, 5.2):
            g[round(5.5 + r * math.sin(math.radians(a)))][round(5.5 + r * math.cos(math.radians(a)))] = 1


def _g_lock(g):
    for y in range(5, 12):
        for x in range(2, 10): g[y][x] = 1
    for y in range(1, 6):
        g[y][3] = g[y][4] = g[y][7] = g[y][8] = 1
    for x in range(3, 9): g[1][x] = 1
    g[8][5] = g[8][6] = g[9][5] = g[9][6] = 0


def _g_check(g):
    for p in [(1, 6), (2, 7), (3, 8), (4, 9), (5, 8), (6, 7), (7, 6), (8, 5), (9, 4), (10, 3)]:
        g[p[1]][p[0]] = 1; g[p[1] + 1 if p[1] < 11 else p[1]][p[0]] = 1


def _g_close(g):
    for i in range(1, 11):
        g[i][i] = g[i][11 - i] = 1; g[i][min(11, i + 1)] = 1; g[i][max(0, 10 - i)] = 1


GLYPHS = {"hint": _g_bulb, "undo": _g_undo, "reset": _g_reset, "codex": _g_book, "pause": _g_pause,
          "auto": _g_play, "skip": _g_skip, "history": _g_hist, "settings": _g_gear, "lock": _g_lock,
          "check": _g_check, "close": _g_close}


def icon_glyph(name, col="cream3"):
    g = g_grid(GLYPHS[name]); s = Spr(16, 16)
    for y in range(12):
        for x in range(12):
            if g[y][x]: s.px(x + 2, y + 2, col)
    if name == "hint":
        for y in range(12):
            for x in range(12):
                if g[y][x]: s.px(x + 2, y + 2, "gold3" if y < 8 else "cream2")
    return s.outline()


def star_icon(full):
    s = Spr(16, 16)
    pts = []
    for i in range(10):
        r = 7 if i % 2 == 0 else 3.2
        a = math.radians(-90 + i * 36)
        pts.append((7.5 + r * math.cos(a), 8 + r * math.sin(a)))
    if full:
        s.shade_poly(pts, "gold", mid=2); s.px(5, 5, "snow3")
        return s.outline()
    s.poly(pts, "stone0")
    for y in range(16):
        for x in range(16):
            if s.get(x, y)[3] and (x + y) % 2: s.px(x, y, "stone1")
    return s.outline("stone2")


def shard_icon():
    s = Spr(16, 16)
    s.shade_poly([(8, 1), (12, 5), (10, 14), (6, 14), (4, 5)], "cyan", mid=2)
    s.rect(7, 3, 7, 5, "snow3"); s.px(6, 7, "cyan3")
    return s.outline()


def kp_icon():
    s = Spr(16, 16)
    s.ell(2, 2, 13, 13, "vio2"); s.ell(4, 4, 11, 11, "vio1")
    s.shade_poly([(8, 3), (10, 8), (8, 12), (6, 8)], "snow", mid=2)
    s.pts([(4, 4), (5, 3)], "vio3")
    return s.outline()


def floor_badge():
    s = nine_panel(40, 16, fill="ind1", inner="ind2", corner=False)
    return s


def progress_frame():
    s = Spr(24, 8)
    s.rect(0, 1, 23, 6, "ink"); s.rect(1, 0, 22, 7, "ink"); s.rect(1, 1, 22, 6, "gold1"); s.rect(2, 2, 21, 5, "ind0")
    return s


def progress_fill():
    s = Spr(4, 4); s.rect(0, 0, 3, 3, "cyan2"); s.rect(0, 0, 3, 0, "cyan3"); s.rect(0, 3, 3, 3, "cyan1"); return s


def app_icon():
    s = Spr(64, 64)
    dither_gradient(s, 0, 0, 63, 63, ["void0", "ind0", "ind1", "ind2"])
    import random as R
    r = R.Random(7)
    for _ in range(26): s.px(r.randrange(2, 62), r.randrange(2, 40), r.choice(["snow2", "ind3", "gold3"]))
    glow(s, 32, 30, 28, "ind2", 0.5)
    # menara
    s.poly([(24, 63), (27, 20), (37, 20), (40, 63)], "stone1"); s.poly([(27, 20), (29, 12), (35, 12), (37, 20)], "stone2")
    s.rect(24, 40, 40, 41, "gold1"); s.rect(25, 52, 39, 53, "gold1")
    for y in (26, 33, 46, 58):
        s.rect(31, y, 32, y + 2, "gold3")
    s.rect(27, 20, 28, 63, "stone2") if False else None
    s.poly([(10, 63), (18, 50), (26, 56), (26, 63)], "stone0"); s.poly([(38, 58), (46, 50), (54, 63), (38, 63)], "stone0")
    # kristal 'x' melayang
    s.shade_poly([(32, 2), (40, 8), (40, 16), (32, 22), (24, 16), (24, 8)], "gold", mid=2)
    s.glyph("x", 30, 8, "gold0")
    s.ell(14, 6, 49, 41, (0, 0, 0, 0)) if False else None
    # cincin
    for a in range(0, 360, 6):
        x = 32 + 27 * math.cos(math.radians(a)); y = 14 + 9 * math.sin(math.radians(a))
        if 0 <= x < 64: s.px(round(x), round(y), "cyan3" if a % 12 == 0 else "cyan2")
    return s.outline()
