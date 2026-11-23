"""Orkestrasi: bangun semua aset → PNG sheet + manifest + palet + QA palette-lock."""
import json
import os
import sys
from PIL import Image, ImageDraw, ImageFont
from core import *
import art_objects as O
import art_chars as C
import scenes as S

OUT = "/home/claude/archon_assets/out"
for d in ("sprites", "ui", "tiles", "backgrounds", "palette", "preview"):
    os.makedirs(f"{OUT}/{d}", exist_ok=True)

manifest = {"game": "Archon of Variables", "version": "1.0.0", "base_resolution": [320, 180],
            "scale_policy": "integer nearest-neighbor (6x=1920x1080, 4x=1280x720); letterbox sisanya",
            "palette": "palette/archon_master.json", "sheets": {}, "images": {}, "nine_slice": {}}


def save_sheet(sh, sub):
    im, meta = sh.render()
    meta["file"] = f"{sub}/{sh.name}.png"
    im.save(f"{OUT}/{sub}/{sh.name}.png")
    manifest["sheets"][sh.name] = meta
    return im


# ---- kristal
sh = Sheet("crystals", 16, 16, 12)
for k in ["unit", "x", "neg1", "negx"]:
    for st in ("normal", "selected", "ghost"):
        sh.add(f"{k}_{st}", O.crystal(k, st), pivot=(8, 8))
sh.add("mystery_box_closed", O.mystery_box(False), (8, 8)); sh.add("mystery_box_open", O.mystery_box(True), (8, 8))
save_sheet(sh, "sprites")

# ---- objek puzzle
sh = Sheet("puzzle_objects", 32, 32, 6)
for k, fn in O.OBJECTS.items(): sh.add(k, fn(), (16, 16))
for st in ("off", "on"): pass
sh.anim("gate_activate", ["gate_off", "gate_on"], 4, False)
sh.anim("node_pulse", ["energy_node_off", "energy_node_on"], 2)
sh.anim("chest_open", ["chest_closed", "chest_open"], 4, False)
save_sheet(sh, "sprites")

# ---- timbangan
sh = Sheet("balance_scale", 96, 64, 3)
for n, t in (("left_heavy", -1), ("balanced", 0), ("right_heavy", 1)): sh.add(n, O.balance_scale(t), (48, 63))
sh.anim("settle", ["left_heavy", "balanced"], 3, False)
save_sheet(sh, "sprites")

# ---- potret VN 64x64
sh = Sheet("portraits", 64, 64, 4)
for e in C.EXPR: sh.add(f"axiom_{e}", C.axiom_portrait(e), (32, 63))
for e in C.EXPR: sh.add(f"elyra_{e}", C.elyra_portrait(e), (32, 63))
for e in C.EXPR: sh.add(f"null_{e}", C.null_portrait(e), (32, 63))
save_sheet(sh, "sprites")

# ---- sprite karakter
sh = Sheet("characters", 48, 48, 6)
for i in range(4): sh.add(f"axiom_idle_{i}", C.axiom_sprite(i), (16, 40))
for i in range(2): sh.add(f"elyra_idle_{i}", C.elyra_sprite(i), (16, 47))
for i in range(2): sh.add(f"architect_idle_{i}", C.architect_sprite(i), (16, 47))
for i in range(2): sh.add(f"null_idle_{i}", C.null_sprite(i), (24, 47))
sh.anim("axiom_idle", [f"axiom_idle_{i}" for i in range(4)], 6)
sh.anim("elyra_idle", ["elyra_idle_0", "elyra_idle_1"], 2)
sh.anim("architect_idle", ["architect_idle_0", "architect_idle_1"], 2)
sh.anim("null_idle", ["null_idle_0", "null_idle_1"], 2)
save_sheet(sh, "sprites")

# ---- Guardian
guard = [("keeper_of_balance", C.guardian_keeper, (96, 112)), ("twin_sentinels", C.guardian_twins, (160, 112)),
         ("polynomial_devourer", C.guardian_devourer, (128, 112)), ("null_architect", C.guardian_null_architect, (128, 128))]
for nm, fn, (w, h) in guard:
    sh = Sheet(f"guardian_{nm}", w, h, 2)
    for i in range(2): sh.add(f"idle_{i}", fn(i), (w // 2, h - 1))
    sh.anim("idle", ["idle_0", "idle_1"], 2)
    save_sheet(sh, "sprites")

# ---- tiles
sh = Sheet("tileset", 16, 16, len(S.TILE_NAMES))
for t in (1, 2, 3, 4):
    for n in S.TILE_NAMES: sh.add(f"t{t}_{n}", S.tile(t, n), (8, 8))
im = save_sheet(sh, "tiles")
manifest["sheets"]["tileset"]["rows"] = {f"tier{t}": S.TIERS[t]["name"] for t in (1, 2, 3, 4)}

# ---- latar
for t in (1, 2, 3, 4):
    for rest in (False, True):
        nm = f"bg_t{t}_{S.TIERS[t]['name']}_{'restored' if rest else 'ruined'}"
        S.background(t, rest).im.save(f"{OUT}/backgrounds/{nm}.png")
        manifest["images"][nm] = {"file": f"backgrounds/{nm}.png", "size": [320, 180]}

# ---- UI
ui = Sheet("ui_icons", 16, 16, 8)
for n in O.GLYPHS: ui.add(f"icon_{n}", O.icon_glyph(n), (8, 8))
ui.add("star_full", O.star_icon(True), (8, 8)); ui.add("star_empty", O.star_icon(False), (8, 8))
ui.add("arcane_shard", O.shard_icon(), (8, 8)); ui.add("knowledge_point", O.kp_icon(), (8, 8))
save_sheet(ui, "ui")

panels = {
    "dialogue_box": O.nine_panel(48, 48), "name_plate": O.nine_panel(48, 16, fill="ind1", inner="ind2", corner=False),
    "codex_panel": O.nine_panel(48, 48, trim="cream0", fill="cream2", inner="cream1"),
    "button_normal": O.button9("normal"), "button_pressed": O.button9("pressed"), "button_disabled": O.button9("disabled"),
    "floor_badge": O.floor_badge(), "progress_frame": O.progress_frame(), "progress_fill": O.progress_fill(),
}
slice_border = {"dialogue_box": 8, "name_plate": 6, "codex_panel": 8, "button_normal": 6, "button_pressed": 6,
                "button_disabled": 6, "floor_badge": 6, "progress_frame": 3}
for n, sp in panels.items():
    sp.im.save(f"{OUT}/ui/{n}.png")
    manifest["images"][n] = {"file": f"ui/{n}.png", "size": [sp.w, sp.h]}
    if n in slice_border: manifest["nine_slice"][n] = {"border": slice_border[n]}

icon = O.app_icon(); icon.im.save(f"{OUT}/ui/app_icon_64.png")
icon.im.resize((512, 512), Image.NEAREST).save(f"{OUT}/ui/app_icon_512.png")
manifest["images"]["app_icon_64"] = {"file": "ui/app_icon_64.png", "size": [64, 64]}
manifest["images"]["app_icon_512"] = {"file": "ui/app_icon_512.png", "size": [512, 512], "note": "8x nearest dari 64"}

# ---- palet
pal = {"id": "archon_master", "colors": {k: v for k, v in P.items()}, "ramps": RAMPS,
       "tier_themes": {str(t): {"name": S.TIERS[t]["name"], "architecture": [P[c] for c in S.TIERS[t]["arch"]],
                                "accent": [P[c] for c in S.TIERS[t]["acc"]]} for t in (1, 2, 3, 4)},
       "semantic": {"unit_1": P["blue2"], "variable_x": P["gold2"], "neg_unit": P["red2"], "neg_x": P["vio2"],
                    "outline": P["ink"]}}
json.dump(pal, open(f"{OUT}/palette/archon_master.json", "w"), indent=2)
with open(f"{OUT}/palette/archon_master.hex", "w") as f: f.write("\n".join(sorted({v.lstrip('#') for v in P.values()})) + "\n")
with open(f"{OUT}/palette/archon_master.gpl", "w") as f:
    f.write("GIMP Palette\nName: Archon Master\nColumns: 8\n#\n")
    for k, v in P.items():
        h = v.lstrip("#"); f.write(f"{int(h[0:2],16):3d} {int(h[2:4],16):3d} {int(h[4:6],16):3d} {k}\n")
sw = Image.new("RGBA", (16 * 8, 16 * ((len(P) + 7) // 8)), (0, 0, 0, 0))
for i, (k, v) in enumerate(P.items()):
    ImageDraw.Draw(sw).rectangle([(i % 8) * 16, (i // 8) * 16, (i % 8) * 16 + 15, (i // 8) * 16 + 15], fill=rgba(v))
sw.save(f"{OUT}/palette/swatches.png")

json.dump(manifest, open(f"{OUT}/manifest.json", "w"), indent=2)
print("built", len(manifest["sheets"]), "sheets,", len(manifest["images"]), "images")
