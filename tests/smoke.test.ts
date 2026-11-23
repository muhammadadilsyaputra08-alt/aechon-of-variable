import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Gfx } from '../src/engine/gfx';
import { App, Scene, setApp } from '../src/engine/core';
import { save } from '../src/engine/save';
import { nav } from '../src/engine/nav';
import { FLOORS, GUARDIANS } from '../src/data/floors';
import { TOPICS } from '../src/data/topics';
import { warehouse } from '../src/archivist/warehouse';
import { foundryOne } from '../src/archivist/pipeline';
import { PuzzleScene } from '../src/scenes/puzzle';
import { CampaignScene, BossScene } from '../src/scenes/campaign';
import { CodexScene } from '../src/scenes/codex';
import { LabMenuScene, LABS } from '../src/scenes/lab';
import { ChallengeScene } from '../src/scenes/challenge';
import { SettingsScene, TitleScene, AchievementsScene } from '../src/scenes/menu';
import { DialogueScene } from '../src/scenes/dialogue';
import { PROLOGUE, TUTORIAL, TIER_INTRO, FLOOR_INTRO, FLOOR_OUTRO, GUARDIAN_PRE, GUARDIAN_POST, EPILOGUE } from '../src/data/story';
import { NumpadScene, HintScene, PauseScene } from '../src/scenes/modals';
import { Candidate } from '../src/archivist/types';
import { q } from '../src/math/rational';

/** Konteks 2D palsu: semua metode no-op; cukup untuk menjalankan seluruh jalur gambar tanpa browser. */
function fakeCtx(): CanvasRenderingContext2D {
  const store: Record<string, unknown> = {};
  return new Proxy(store, {
    get(t, p: string) {
      if (p === 'measureText') return (s: string) => ({ width: s.length * 4 });
      if (p in t) return t[p];
      return () => undefined;
    },
    set(t, p: string, v) {
      t[p] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

let app: App;
let g: Gfx;
type Priv = Record<string, unknown> & { vals: Record<string, ReturnType<typeof q>> };

beforeAll(() => {
  const canvas = { getContext: () => fakeCtx(), style: {}, width: 320, height: 180 } as unknown as HTMLCanvasElement;
  g = new Gfx(canvas);
  g.manifest = JSON.parse(readFileSync('public/assets/manifest.json', 'utf8'));
  app = new App(g);
  setApp(app);
  save.reset();
  save.data.settings.reduceFx = true;
  nav.title = () => new TitleScene();
  nav.codex = (t) => new CodexScene(t);
  nav.settings = () => new SettingsScene();
  nav.campaign = () => new CampaignScene();
});

function run(s: Scene, frames = 3): void {
  s.enter?.();
  for (let i = 0; i < frames; i++) {
    s.update?.(0.016);
    app.time += 0.016;
    g.begin();
    s.draw(g);
  }
}
const tap = (s: Scene, x: number, y: number): void => {
  s.down?.(x, y);
  s.up?.(x, y);
};

describe('Smoke: scene & puzzle', () => {
  it('semua 30 lantai: puzzle dapat digambar, jawaban solver diterima, jawaban salah ditolak', () => {
    let total = 0;
    for (const f of FLOORS) {
      for (const s of f.slots) {
        const cand = warehouse.curated(s.topic, s.seed, s.target);
        let done = false;
        const sc = new PuzzleScene({ cand, tier: f.tier, badge: `Lt ${f.n}`, onDone: () => (done = true) });
        run(sc, 2);
        // gambar pada nilai ekstrem agar tampilan tidak melempar galat
        for (const edge of ['min', 'max'] as const) {
          const p = sc as unknown as Priv;
          const saved = { ...p.vals };
          for (const k of cand.knobs) p.vals[k.id] = q(Math.round(k[edge]));
          run(sc, 1);
          p.vals = saved;
        }
        const p = sc as unknown as { vals: Record<string, ReturnType<typeof q>>; submit(): void; guideStep(): void; solved: boolean; isBalance: boolean };
        if (cand.kind === 'balance') {
          for (let i = 0; i < 8 && !p.solved; i++) p.guideStep();
        } else {
          p.vals = { ...p.vals, ...cand.solution! };
          p.submit();
        }
        expect(p.solved, `${cand.id} ${cand.kind} ${JSON.stringify(cand.data)}`).toBe(true);
        run(sc, 40); // animasi hasil
        total++;
        void done;
      }
    }
    expect(total).toBe(90);
  });

  it('jawaban salah tidak menyelesaikan puzzle dan memberi umpan balik', () => {
    const cand = foundryOne('A10', 31, 3);
    const sc = new PuzzleScene({ cand, tier: 2, badge: 'x', onDone: () => undefined });
    run(sc, 1);
    const p = sc as unknown as { vals: Record<string, ReturnType<typeof q>>; submit(): void; solved: boolean; fails: number };
    p.vals = { x: q(99), y: q(99) };
    p.submit();
    expect(p.solved).toBe(false);
    expect(p.fails).toBe(1);
  });

  it('fase guardian & boss', () => {
    for (const def of Object.values(GUARDIANS)) {
      def.phases.forEach((ph, i) => {
        run(new BossScene(def, i, 'start', 1, () => undefined), 2);
        run(new BossScene(def, i, 'hit', 1, () => undefined), 60);
        const cand = warehouse.curated(ph.topic, 9001 + i, ph.target);
        run(new PuzzleScene({ cand, tier: 2, badge: 'Boss', onDone: () => undefined }), 2);
      });
    }
  });

  it('dialog: seluruh naskah dapat dimainkan sampai selesai (termasuk pilihan)', () => {
    const scripts = [PROLOGUE, TUTORIAL, ...Object.values(TIER_INTRO), FLOOR_INTRO, FLOOR_OUTRO, ...Object.values(GUARDIAN_PRE), ...Object.values(GUARDIAN_POST), EPILOGUE];
    for (const lines of scripts) {
      let finished = false;
      const d = new DialogueScene(lines, { tier: 1, onDone: () => (finished = true) });
      d.enter?.();
      for (let i = 0; i < 4000 && !finished; i++) {
        d.update?.(0.5);
        g.begin();
        d.draw(g);
        tap(d, 160, 150);
        // pilihan naratif: ketuk tombol pertama
        tap(d, 160, 72);
      }
      expect(finished).toBe(true);
    }
  });

  it('menu, campaign, codex (30 materi), lab (10), tantangan, pengaturan', () => {
    run(new TitleScene());
    run(new CampaignScene());
    run(new SettingsScene());
    run(new AchievementsScene());
    run(new ChallengeScene());
    run(new LabMenuScene());
    for (const t of TOPICS) run(new CodexScene(t.code), 2);
    const cx = new CodexScene();
    run(cx);
    for (let i = 0; i < 6; i++) tap(cx, 40 + i * 36, 28);
    for (const lab of LABS) {
      const probe = { knobs: lab.knobs, id: lab.id };
      expect(probe.knobs.length).toBeGreaterThan(0);
      for (const edge of ['min', 'max', 'init'] as const) {
        const vals: Record<string, number> = {};
        const vq: Record<string, ReturnType<typeof q>> = {};
        for (const k of lab.knobs) {
          vals[k.id] = k[edge];
          vq[k.id] = Number.isInteger(k[edge]) ? q(k[edge]) : q(Math.round(k[edge] * 2), 2);
        }
        g.begin();
        const info = lab.draw(g, vals, vq, true);
        expect(Array.isArray(info)).toBe(true);
      }
    }
  });

  it('modal: numpad, hint, jeda', () => {
    const cand = foundryOne('A05', 5, 3);
    run(new NumpadScene('x', q(3), () => undefined));
    run(new HintScene(cand, 0, () => undefined, () => undefined));
    run(new PauseScene(cand, () => undefined));
  });

  it('penyimpanan & progres lantai', () => {
    save.data.floors[1] = { cleared: true, stars: [3, 3, 3] };
    expect(save.floorState(1)).toBe('full');
    save.data.floors[2] = { cleared: true, stars: [1, 3, 3] };
    expect(save.floorState(2)).toBe('partial');
    expect(save.floorState(3)).toBe('ruined');
    expect(save.highestUnlocked()).toBe(3);
    run(new CampaignScene());
    const c: Candidate = foundryOne('A01', 3, 1);
    expect(c.status).toBe('Active');
  });
});
