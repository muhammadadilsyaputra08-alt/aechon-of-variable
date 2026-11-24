# PROJECT_MAP — Archon of Variables (peta untuk AI & kontributor)

> Baca file ini dulu sebelum mengubah apa pun. Game: pixel-art visual novel + puzzle belajar aljabar. TypeScript + Canvas 2D + Vite + Capacitor (Android). Logis 320×180, skala pecahan memenuhi layar apa pun (`engine/gfx.ts#resize`, `main.ts#fit`, safe-area).

## 1. Struktur & alur utama
```
Title ─┬─ Continue/Campaign ─ CampaignScene (peta 30 lantai) ─ startFloor(n)
       │      startFloor: dialog → IntroCard → runGoals(floorGoals(n))   ← sublevel per materi (resume)
       │                  → [dialog pra-boss → runBoss(guardian)]  → RestoreScene → dialog
       ├─ The Infinite Archive ─ ArchiveMenuScene → startArchive → ReportScene
       ├─ Algebra Codex · Sandbox Lab · Challenge/Review/Rematch · Curriculum · Settings
```
**Hierarki belajar**: Tier(4) → Level(30, satu materi A01–A30) → Sublevel (Guide, Basic, Inter, Adv, Mastery, Challenge; 7–11 per level, 252 total) → soal.
**Lantai ≠ level**: lantai = bingkai cerita; `floorGoals(n)` menentukan berapa sublevel tiap materi yang harus selesai (materi yang muncul di >1 lantai dibagi rata; lantai 30 = ujian akhir boss).

## 2. Peta modul
| Area | File | Tanggung jawab |
|---|---|---|
| Math | `math/rational.ts`, `poly.ts` (parser aman, pembagian monomial), `solve.ts`, `special.ts` (bentuk akar √ numerik + matriks Q: parse/×/det/invers) | Aritmetika eksak, polinomial multivariabel, solver |
| Archivist (puzzle visual) | `archivist/generators.ts`, `kinds.ts`, `pipeline.ts`, `warehouse.ts`, `rng.ts`, `types.ts` | Generator → solver → validator → difficulty → hint → gudang; `warehouse.curated(topic,seed,target)` deterministik |
| **Learn (baru)** | `learn/curriculum.ts` | Spesifikasi level/sublevel (`SPECS`, token `PZ`=puzzle visual), `floorGoals` |
| | `learn/wbgen.ts` + `wbgen_adv.ts` | Question Factory ekspresi (Workboard): 102 varian (`wbgen_adv` = A12–A13, A18–A20, A22–A25; hanya `import type` dari wbgen), kunci langkah, jebakan, hint 5 tingkat, `signature` & `shape` |
| | `learn/stepcheck.ts` | Step Validator matematis (setara/sederhana/tanda/operasi/konsep/sintaks); jenis soal: expr, equation, factor, value, ineq, roots, point, **rad** (akar, keypad √), **matrix** (`[[1,2],[3,4]]`, keypad `[` `]`) |
| | `learn/factory.ts` | `makeQuestion` terpadu (wb + puzzle) dengan `exclude` anti-ulang |
| | `learn/store.ts` | Progres kampanye, riwayat soal, mastery, migrasi save v1→v2 |
| | `learn/boss.ts` | Boss engine: HP, antrean soal baru, resume, reset saat kalah |
| | `learn/archive.ts` | Sesi Infinite Archive: free/adaptive/mixed/weakness, statistik |
| | `learn/types.ts` | Tipe data yang disimpan di `save.data.learn` |
| Scenes | `scenes/workboard.ts` | Question Panel · Work Area · keypad matematika · undo/redo · highlight suku · hint · papan coret |
| | `scenes/learn.ts` | `questionScene`, `runGoals`, `GuideScene`, `InfoCard`, `BossArena`, `runBoss`, `SceneSlot` |
| | `scenes/curriculum.ts`, `archive.ts` | Peta kurikulum; menu/laporan Archive |
| | `scenes/campaign.ts`, `puzzle.ts`, `views.ts`, `modals.ts`, `menu.ts`, `codex.ts`, `lab.ts`, `challenge.ts`, `dialogue.ts` | Alur lama (dipertahankan); `puzzle.ts` kini punya `oneShot` + tombol Wb |
| Engine | `engine/core.ts` (App, Scene, UI), `gfx.ts`, `save.ts` (v2), `progress.ts`, `audio.ts`, `i18n.ts`, `nav.ts` | |
| Data | `data/topics.ts` (A01–A30), `floors.ts`, `story.ts`, `codex.ts`, `achievements.ts` | |
| Aset | `public/assets/**`, `assets-src/pixel-build-scripts/art_learn_ui.py` → `ui/ui_learn.png` (heart, pip, bolt, ikon) | Palet terkunci `archon_master` |

## 3. Aturan inti
1. **Satu level = satu kompetensi.** Sublevel baru dibuat dengan menambah entri di `SPECS` (wb) atau otomatis `ladder()` (puzzle).
2. **Sumber soal tunggal**: selalu lewat `makeQuestion` (kampanye, boss, Archive). Jangan memanggil generator langsung dari scene.
3. **Anti-ulang**: kampanye memakai `learn.hist` (signature soal yang sudah diselesaikan); boss memakai `session.sigs` + seed baru tiap pertarungan; Archive memakai `session.sigs` + `arch.recent`.
4. **Resume**: `LevelProg {done, qDone, seeds}` — seed soal disimpan sehingga soal yang sama dibuat ulang setelah keluar. Simpan lewat `persist()` (flush langsung), bukan hanya autosave.
5. **Mastery**: Level Challenge butuh akurasi percobaan-pertama ≥ `passAccuracy` (0.8); gagal → soal baru. Status: learning / proficient / mastered (`store.mastery`).
6. **Boss**: HP pemain & boss (`BOSS_CFG`), 1 kesempatan/soal (`oneShot`), fase mengikuti sisa HP boss, keluar di tengah soal = serangan tak terjawab, kalah = sesi reset (progres sublevel aman).
7. Validator Workboard memeriksa **kesetaraan polinomial**, bukan teks; bentuk akhir wajib sederhana (`isSimplified`) / terfaktor (`isFactored`) / `x = k`.
8. UI selalu di koordinat logis 320×180; jangan mengandalkan rasio layar. Teks kecil ≥ 6 px logis; tombol sentuh ≥ 14 px.

## 4. Menambah konten
- **Varian soal wb**: tambah fungsi di `M` (wbgen) → daftarkan di `WB_VARIANTS`, `WB_BY_TOPIC`, (opsional `TIPS`/`VAR_PROMPT`) → pakai di `SPECS`. Uji: `tests/learn.test.ts` memeriksa kunci langkah & jebakan otomatis.
- **Materi baru dengan Workboard**: tambah spec di `SPECS` (lain-lain otomatis tangga puzzle).
- **Boss**: `data/floors.ts#GUARDIANS` (fase) + `learn/boss.ts#BOSS_CFG` (HP).

## 5. Status & backlog
Selesai: kurikulum level/sublevel, Workboard (A01–A20, A22–A25), Guide, mastery, save v2 + migrasi, boss ber-HP, Infinite Archive (4 mode + laporan), layar adaptif.
Belum: Workboard untuk A21 dan A26–A30 (masih puzzle visual: sistem 3 variabel, transformasi linear, vektor, ruang vektor, kompleks, eigen); dokumentasi Codex diperluas ke 19 bagian seragam; Level Guide interaktif per sublevel; terjemahan EN untuk teks baru; tuning keseimbangan HP/jumlah soal dengan data bermain nyata; tes visual di perangkat Android (termasuk lebar `expr` matriks ≤ 296 px logis dan tombol √ / [ ] kontekstual).
Verifikasi terakhir: typecheck bersih; 36.000 soal wb valid; autoplay lantai 1–12 (termasuk Keeper & Twin Sentinels) tuntas; boss lose/win/resume, migrasi, anti-duplikat lolos. `npm run build`/`vitest` belum dijalankan (tanpa akses jaringan di sesi ini) — jalankan `npm ci && npm test && npm run build`.
