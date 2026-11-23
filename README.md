# Archon of Variables

Game edukasi aljabar **pixel art visual novel + puzzle-strategy**, Android-first, offline-first, landscape.
Dibangun dari PRD *Archon of Variables* dan asset pack `archon_of_variables_assets.zip`.

> **Restore the Tower. Master the Unknown.**

## Isi game
| Fitur PRD | Implementasi |
|---|---|
| Campaign 30 lantai / 4 tier | `src/data/floors.ts` — data-driven; tiap lantai: dialog → kartu konsep → 3 puzzle → (Guardian) → restorasi → dialog |
| Visual novel | `scenes/dialogue.ts` — potret, mesin tik, auto/skip (hanya teks yang sudah dibaca), riwayat, pilihan naratif |
| Tier I Balance Scale | `scenes/puzzle.ts` — operasi sama di kedua sisi, ketuk satu kristal → timbangan miring (edukatif) |
| Tier II–IV mekanik | `scenes/views.ts` — Energy Rail, Dual Gate, Boundary Field, Parabolic Launcher, Factor Machine, Exponent Reactor, Log Archive, Rational Bridge, Matrix Grid, Determinant Collapse, Transformation Grid, Vector Arrows, Complex Resonance, Eigen Stabilizer |
| Math Engine | `src/math/` — pecahan **eksak**, parser aman (tanpa `eval`), solver linear/kuadrat/sistem/matriks/eigen/kompleks |
| Archivist Engine | `src/archivist/` — Generator → **Internal Solver** → Validator → Ambiguity → Difficulty → Tagging → Hint dari jejak solver → Duplicate Check → Warehouse (status Candidate…Retired/Rejected) |
| X-Ray Steps (5 hint) | `archivist/pipeline.ts` + `scenes/modals.ts` |
| Algebra Codex | `scenes/codex.ts` + `data/codex.ts` — 30 materi, cari, bookmark, formula sheet, glosarium, contoh dari gudang Archivist |
| Sandbox Lab | `scenes/lab.ts` — 10 lab real-time, preset, mode panduan, simpan/muat |
| Challenge / Review / Guardian Rematch | `scenes/challenge.ts` — medali, kesulitan adaptif |
| Boss (4 Guardian, multi-fase, tanpa timer) | `scenes/campaign.ts` |
| Achievement, Settings, Save otomatis | `data/achievements.ts`, `scenes/menu.ts`, `engine/save.ts` |
| Audio | `engine/audio.ts` — SFX & musik ambient prosedural per tier (tanpa berkas audio) |

## Menjalankan
```bash
npm ci
npm run dev        # http://localhost:5173  (tambah ?debug untuk hook QA)
npm test           # 22 uji: Math Engine, Archivist (30 topik × 5 tingkat), smoke 90 puzzle + semua scene
npm run build      # dist/ (web)
```

## Build Android (lokal)
Butuh JDK 21 + Android SDK.
```bash
npm run build && npx cap sync android
cd android && ./gradlew assembleDebug      # app/build/outputs/apk/debug/app-debug.apk
```
Ikon/splash & patch (landscape, immersive, versi, signing) dibuat ulang dengan `npm run android:setup` bila `android/` dihasilkan ulang via `npx cap add android`.

## GitHub Actions — `.github/workflows/build.yml`
| Job | Fungsi |
|---|---|
| `verify` | lint, typecheck, test, build web (artifact `web-dist`) |
| `android` | `cap sync` → **APK debug** (selalu) → **APK + AAB rilis ditandatangani** (bila secrets ada) → artifact `android-build` |
| `release` | tag `v*` → GitHub Release berisi APK/AAB |
| `pages` | opsional: deploy web ke GitHub Pages bila repo variable `DEPLOY_PAGES=true` |

Secrets untuk build rilis (opsional): `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
Buat keystore: `keytool -genkeypair -v -keystore release.keystore -alias archon -keyalg RSA -keysize 2048 -validity 10000` lalu `base64 -w0 release.keystore`.
Rilis: `git tag v1.0.0 && git push --tags`.

## Catatan batasan saat ini
- Gesture **pinch/swipe** belum ada; puzzle non-timbangan memakai stepper, keypad angka, dan ketuk/seret pada grid/garis bilangan.
- Bahasa Inggris: UI, cerita, judul/prompt puzzle ✔; **hint/jejak solver dan isi Codex masih Bahasa Indonesia**.
- Lisensi font: Silkscreen & Pixelify Sans (SIL OFL) di `public/fonts/`.
