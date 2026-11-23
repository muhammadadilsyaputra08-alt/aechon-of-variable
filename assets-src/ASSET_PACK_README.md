# Archon of Variables — Pixel Asset Pack v1.0
Base 320x180, skala integer nearest-neighbor (6x=1920x1080, 4x=1280x720). Semua piksel terkunci ke `palette/archon_master.*` (alpha biner).
- `manifest.json` — atlas frame (x,y,w,h,pivot), animasi (fps), 9-slice, daftar gambar.
- `sprites/` crystals (4 jenis × normal/selected/ghost; bentuk naik=positif, turun=negatif + glyph nilai), puzzle_objects (17), balance_scale (3 keadaan), portraits VN 64×64 (Axiom, Elyra, The Null × 4 ekspresi), characters, guardian_* (4 boss, 2 frame idle).
- `tiles/tileset.png` 16×16, 12 tile × 4 tier. `backgrounds/` 8 latar (4 tier × ruined/restored).
- `ui/` 9-slice dialog/nameplate/button/panel, ikon 16×16, bintang, shard, KP, app icon.
- Teks UI dirender engine (font OFL disarankan: Silkscreen / Pixelify Sans).
Sumber: `build.py` (dapat dibangun ulang deterministik).
