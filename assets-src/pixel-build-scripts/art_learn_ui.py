"""Aset tambahan fase pembelajaran: HP, kombo, lencana langkah, ikon menu. Palet = archon_master (tanpa warna baru).
Jalankan: python3 assets-src/pixel-build-scripts/art_learn_ui.py  → public/assets/ui/ui_learn.png (+ entri manifest)."""
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
PAL = {
    'o': '#1b1530', 'r': '#e8485a', 'h': '#ffa8a0', 'd': '#a21e42',
    's': '#4a4268', 't': '#7a7298', 'e': '#14123a',
    'g': '#f4c038', 'G': '#fff0a0', 'b': '#c8821a',
    'm': '#6cb070', 'M': '#b8e090', 'c': '#30c8dc', 'C': '#b0f6f2',
    'v': '#9a54d2', 'p': '#f062bc', 'w': '#fbf0d2', 'n': '#8e5c3c', 'k': '#5a3426',
}
HEART = ["..ooo.ooo..", ".orrrorrro.", "orhhrrrrrro", "orhrrrrrrdo", "orrrrrrrrdo", ".orrrrrrdo.", "..orrrrdo..", "...orrdo...", "....odo....", ".....o....."]
HEART_E = [row.replace('r', 'e').replace('h', 'e').replace('d', 'e').replace('o', 't') for row in HEART]
PIP = ["....o....", "...ooo...", "..orhro..", ".orhrrro.", "orhrrrrdo", ".orrrrdo.", "..orrdo..", "...ooo...", "....o...."]
PIP_E = [row.replace('r', 's').replace('h', 's').replace('d', 's').replace('o', 't') for row in PIP]
BOLT = ["....oooo.", "...oggGo.", "..oggGo..", ".oggGo...", "oggggggo.", ".ooggGo..", "...oggo..", "...ogo...", "....oo..."]
CHECK = ["..........o", "........omo", ".......omMo", "o.....omMo.", "mo...omMo..", "Mmo.omMo...", ".MmomMo....", "..oMMo.....", "...oo......"]
CROSS = ["or.....ro", ".or...ro.", "..or.ro..", "...oro...", "....o....", "...oro...", "..or.ro..", ".or...ro.", "or.....ro"]
TILDE = ["..........", "..oo...oo.", ".ogGo.ogo.", "ogGoogGo..", "oGo.oGo...", "..........", "..........", "..........", ".........."]

def blit(img, rows, ox, oy, pal=PAL):
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != '.' and ch in pal:
                img.putpixel((ox + x, oy + y), Image.new('RGB', (1, 1), pal[ch]).getpixel((0, 0)) + (255,))

def cell(sheet, col, row):
    return col * 16, row * 16

def main():
    img = Image.new('RGBA', (128, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    frames = {}
    def put(name, rows, col, row):
        ox, oy = cell(img, col, row)
        w, h = len(rows[0]), len(rows)
        blit(img, rows, ox + (16 - w) // 2, oy + (16 - h) // 2)
        frames[name] = (ox, oy)
    put('heart_full', HEART, 0, 0); put('heart_empty', HEART_E, 1, 0)
    put('pip_full', PIP, 2, 0); put('pip_empty', PIP_E, 3, 0)
    put('bolt', BOLT, 4, 0); put('mark_ok', CHECK, 5, 0); put('mark_bad', CROSS, 6, 0); put('mark_part', TILDE, 7, 0)
    # ikon menu 16x16 (digambar prosedural)
    ox, oy = cell(img, 0, 1)   # infinity
    for cx in (5, 10):
        d.ellipse([ox + cx - 4, oy + 4, ox + cx + 3, oy + 11], outline=PAL['g'], width=1)
    d.line([ox + 4, oy + 7, ox + 11, oy + 8], fill=PAL['G']); d.point((ox + 8, oy + 7), PAL['w']); d.point((ox + 8, oy + 8), PAL['w'])
    d.point((ox + 2, oy + 5), PAL['G']); d.point((ox + 13, oy + 10), PAL['G'])
    frames['icon_infinity'] = (ox, oy)
    ox, oy = cell(img, 1, 1)   # pensil
    d.polygon([(ox + 11, oy + 2), (ox + 13, oy + 4), (ox + 5, oy + 12), (ox + 3, oy + 12), (ox + 3, oy + 10)], fill=PAL['g'], outline=PAL['o'])
    d.polygon([(ox + 3, oy + 10), (ox + 5, oy + 12), (ox + 2, oy + 13)], fill=PAL['w'], outline=PAL['o'])
    d.line([ox + 11, oy + 2, ox + 13, oy + 4], fill=PAL['p'], width=2)
    frames['icon_pencil'] = (ox, oy)
    ox, oy = cell(img, 2, 1)   # buku terbuka
    d.polygon([(ox + 1, oy + 4), (ox + 7, oy + 5), (ox + 7, oy + 13), (ox + 1, oy + 12)], fill=PAL['w'], outline=PAL['o'])
    d.polygon([(ox + 14, oy + 4), (ox + 8, oy + 5), (ox + 8, oy + 13), (ox + 14, oy + 12)], fill=PAL['w'], outline=PAL['o'])
    for yy in (7, 9, 11):
        d.line([ox + 2, oy + yy, ox + 6, oy + yy + 0], fill=PAL['t']); d.line([ox + 9, oy + yy, ox + 13, oy + yy], fill=PAL['t'])
    d.line([ox + 7, oy + 3, ox + 7, oy + 13], fill=PAL['c'])
    frames['icon_book'] = (ox, oy)
    ox, oy = cell(img, 3, 1)   # pedang bersilang
    d.line([ox + 2, oy + 2, ox + 13, oy + 13], fill=PAL['C'], width=2); d.line([ox + 13, oy + 2, ox + 2, oy + 13], fill=PAL['C'], width=2)
    d.line([ox + 2, oy + 9, ox + 6, oy + 13], fill=PAL['g'], width=1); d.line([ox + 13, oy + 9, ox + 9, oy + 13], fill=PAL['g'], width=1)
    d.rectangle([ox + 1, oy + 12, ox + 3, oy + 14], fill=PAL['b']); d.rectangle([ox + 12, oy + 12, ox + 14, oy + 14], fill=PAL['b'])
    frames['icon_swords'] = (ox, oy)
    ox, oy = cell(img, 4, 1)   # kurikulum (tangga)
    for i in range(4):
        d.rectangle([ox + 2 + i * 3, oy + 11 - i * 3, ox + 4 + i * 3, oy + 13], fill=PAL['c'] if i % 2 == 0 else PAL['v'], outline=PAL['o'])
    frames['icon_stairs'] = (ox, oy)
    out = ROOT / 'public/assets/ui/ui_learn.png'
    img.save(out)
    mf = ROOT / 'public/assets/manifest.json'
    m = json.loads(mf.read_text())
    m['sheets']['ui_learn'] = {'file': 'ui/ui_learn.png', 'size': [128, 32], 'cell': [16, 16],
                               'frames': {k: {'x': x, 'y': y, 'w': 16, 'h': 16, 'pivot': [8, 8]} for k, (x, y) in frames.items()}}
    mf.write_text(json.dumps(m, indent=2))
    big = img.resize((512, 128), Image.NEAREST)
    big.save(Path('/tmp/claude-0/-home-claude/19327244-0c0a-50a7-a1ef-5ac375bdad2b/scratchpad/ui_learn_preview.png'))
    print('ok', list(frames))

if __name__ == '__main__':
    main()
