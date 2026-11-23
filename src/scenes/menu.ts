/** Boot, Menu Utama, Pengaturan, Pencapaian. */
import { C, Gfx, W, H } from '../engine/gfx';
import { app, Button, Scene, UI } from '../engine/core';
import { audio } from '../engine/audio';
import { save } from '../engine/save';
import { setLang, t, tb } from '../engine/i18n';
import { nav } from '../engine/nav';
import { TOPICS } from '../data/topics';
import { warehouse } from '../archivist/warehouse';
import { ACHIEVEMENTS } from '../data/achievements';
import { TUTORIAL } from '../data/story';
import { drawBg, panel, sparkle, bar } from './common';
import { DialogueScene } from './dialogue';
import { PuzzleScene } from './puzzle';
import { ConfirmScene } from './modals';

export class BootScene implements Scene {
  private p = 0;
  private stage: 'assets' | 'foundry' | 'done' = 'assets';
  private fq = 0;
  constructor(private load: (cb: (p: number) => void) => Promise<void>, private next: () => Scene) {}
  enter(): void {
    void this.load((p) => (this.p = p * 0.6)).then(() => {
      save.load();
      this.stage = 'foundry';
    });
  }
  update(): void {
    if (this.stage === 'foundry') {
      // Archivist Engine menyiapkan gudang soal bertahap (offline, tanpa membekukan layar)
      const t0 = performance.now();
      while (this.fq < TOPICS.length * 2 && performance.now() - t0 < 10) {
        const topic = TOPICS[this.fq >> 1].code;
        warehouse.foundry(topic, this.fq % 2 ? 4 : 2, 2, 5000 + this.fq * 131);
        this.fq++;
      }
      this.p = 0.6 + 0.4 * (this.fq / (TOPICS.length * 2));
      if (this.fq >= TOPICS.length * 2) {
        this.stage = 'done';
        app.reset(this.next());
      }
    }
  }
  draw(g: Gfx): void {
    g.rect(0, 0, W, H, C.ind0);
    sparkle(g, app.time, 30, 0, 0, W, H);
    g.text('ARCHON OF VARIABLES', 160, 66, { size: 12, align: 'center', color: C.gold2, bold: true });
    bar(g, 90, 96, 140, 10, this.p, C.cyan2);
    g.text(this.stage === 'foundry' ? 'Archivist Engine menyiapkan soal…' : 'Memuat…', 160, 112, { size: 8, align: 'center', color: C.blue3 });
  }
}

export class TitleScene implements Scene {
  private ui = new UI();
  constructor() {
    const items: Array<[string, () => void]> = [
      ['continue', () => app.push(nav.campaign())],
      ['campaign', () => app.push(nav.campaign())],
      ['codex', () => app.push(nav.codex())],
      ['sandbox', () => app.push(new (SceneRegistry.lab!)())],
      ['challenge', () => app.push(new (SceneRegistry.challenge!)())],
      ['settings', () => app.push(nav.settings())],
    ];
    items.forEach(([key, fn], i) => {
      const b = this.ui.add(new Button(20 + (i % 2) * 150, 96 + Math.floor(i / 2) * 25, 130, 21, () => t(key), fn, { size: 8 }));
      if (key === 'continue') b.enabled = Object.keys(save.data.floors).length > 0;
    });
  }
  enter(): void {
    audio.setMood(1, 0);
    const b = this.ui.items[0];
    b.enabled = Object.keys(save.data.floors).length > 0;
  }
  update(dt: number): void {
    this.ui.update(dt);
  }
  draw(g: Gfx): void {
    const n = Object.values(save.data.floors).filter((f) => f.cleared).length;
    drawBg(g, n >= 20 ? 4 : n >= 12 ? 3 : n >= 5 ? 2 : 1, n >= 1 && n % 5 !== 0, 0.2);
    sparkle(g, app.time, 24, 0, 0, W, 90);
    g.text(t('title'), 160, 18, { size: 16, align: 'center', color: C.gold2, bold: true });
    g.text(t('tagline'), 160, 40, { size: 8, align: 'center', color: C.cyan3 });
    g.spr('characters', `axiom_idle_${Math.floor(app.time * 3) % 3}`, 160, 88, { pivot: true, s: 1 });
    this.ui.draw(g);
    g.icon('arcane_shard', 6, 164);
    g.text(String(save.data.shards), 24, 168, { size: 8, color: C.gold3 });
    g.icon('knowledge_point', 62, 164);
    g.text(String(save.data.kp), 80, 168, { size: 8, color: C.cyan3 });
    g.text('v1.0', 314, 170, { size: 6, align: 'right', color: C.stone3, shadow: null });
  }
  down(x: number, y: number): void { this.ui.down(x, y); }
  move(x: number, y: number): void { this.ui.move(x, y); }
  up(x: number, y: number): void { this.ui.up(x, y); }
  back(): boolean { return false; }
}

/** Registri untuk scene yang diimpor belakangan (menghindari impor melingkar). */
export const SceneRegistry: { lab?: new () => Scene; challenge?: new () => Scene } = {};

const cycle = <T,>(arr: readonly T[], cur: T): T => arr[(arr.indexOf(cur) + 1) % arr.length];

export class SettingsScene implements Scene {
  private ui = new UI();
  constructor() {
    const s = save.data.settings;
    const row = (i: number, label: string, val: () => string, fn: () => void): void => {
      const col = i % 2;
      const y = 28 + Math.floor(i / 2) * 26;
      this.rows.push({ x: 12 + col * 154, y, label });
      this.ui.add(new Button(12 + col * 154 + 74, y - 3, 70, 18, val, () => {
        fn();
        save.commit();
        audio.applyVolumes();
      }, { size: 8 }));
    };
    const vol = [0, 0.25, 0.5, 0.75, 1];
    row(0, t('language'), () => (s.lang === 'id' ? 'Indonesia' : 'English'), () => {
      s.lang = s.lang === 'id' ? 'en' : 'id';
      setLang(s.lang);
      this.labelsRefresh();
    });
    row(1, t('textSize'), () => (s.textScale === 1 ? t('small') : t('large')), () => (s.textScale = s.textScale === 1 ? 1.25 : 1));
    row(2, t('animSpeed'), () => ({ 0.6: t('slow'), 1: t('normal'), 1.6: t('fast') })[s.animSpeed], () => (s.animSpeed = cycle([0.6, 1, 1.6] as const, s.animSpeed)));
    row(3, t('typeSpeed'), () => ({ 0.6: t('slow'), 1: t('normal'), 2: t('fast') })[s.typeSpeed], () => (s.typeSpeed = cycle([0.6, 1, 2] as const, s.typeSpeed)));
    row(4, t('reduceFx'), () => (s.reduceFx ? t('on') : t('off')), () => (s.reduceFx = !s.reduceFx));
    row(5, t('music'), () => `${Math.round(s.music * 100)}%`, () => (s.music = cycle(vol, s.music)));
    row(6, t('sfx'), () => `${Math.round(s.sfx * 100)}%`, () => (s.sfx = cycle(vol, s.sfx)));
    this.ui.add(new Button(12, 130, 142, 18, () => t('replayTutorial'), () => this.replayTutorial(), { size: 8 }));
    this.ui.add(new Button(166, 130, 142, 18, () => t('achievements'), () => app.push(new AchievementsScene()), { size: 8 }));
    this.ui.add(new Button(12, 152, 142, 18, () => t('resetSave'), () => app.push(new ConfirmScene(t('confirmReset'), () => {
      save.reset();
      app.reset(new TitleScene());
    }), false), { size: 8, color: C.red3 }));
    this.ui.add(new Button(166, 152, 142, 18, () => t('back'), () => app.pop(), { size: 8 }));
  }
  private rows: Array<{ x: number; y: number; label: string }> = [];
  private labelsRefresh(): void {
    // label baris dibaca ulang saat gambar; tidak perlu tindakan tambahan
  }
  private replayTutorial(): void {
    app.push(new DialogueScene(TUTORIAL, {
      tier: 1,
      onDone: () => {
        const c = warehouse.curated('A01', 777, 2);
        app.replace(new PuzzleScene({ cand: c, tier: 1, badge: 'Tutor', practice: true, onDone: () => app.reset(new TitleScene()), onQuit: () => app.reset(new TitleScene()) }));
      },
    }));
  }
  update(dt: number): void { this.ui.update(dt); }
  draw(g: Gfx): void {
    drawBg(g, 1, false, 0.5);
    panel(g, 4, 4, 312, 172);
    g.text(t('settings'), 160, 10, { size: 10, align: 'center', color: C.gold3 });
    const labels = [t('language'), t('textSize'), t('animSpeed'), t('typeSpeed'), t('reduceFx'), t('music'), t('sfx')];
    this.rows.forEach((r, i) => g.text(labels[i], r.x, r.y, { size: 6, color: C.cream3, shadow: null }));
    this.ui.draw(g);
  }
  down(x: number, y: number): void { this.ui.down(x, y); }
  move(x: number, y: number): void { this.ui.move(x, y); }
  up(x: number, y: number): void { this.ui.up(x, y); }
}

export class AchievementsScene implements Scene {
  private ui = new UI();
  constructor() {
    this.ui.add(new Button(120, 156, 80, 18, () => t('back'), () => app.pop()));
  }
  draw(g: Gfx): void {
    drawBg(g, 1, false, 0.55);
    panel(g, 10, 6, 300, 172);
    g.text(t('achievements'), 160, 12, { size: 10, align: 'center', color: C.gold3 });
    ACHIEVEMENTS.forEach((a, i) => {
      const y = 28 + i * 16;
      const ok = !!save.data.achievements[a.id];
      g.icon(ok ? 'star_full' : 'icon_lock', 20, y - 3, ok ? 1 : 0.6);
      g.text(tb(a.name), 42, y, { size: 8, color: ok ? C.gold3 : C.stone3 });
      g.text(tb(a.desc), 42, y + 8, { size: 6, color: ok ? C.cream3 : C.stone2, shadow: null });
    });
    this.ui.draw(g);
  }
  down(x: number, y: number): void { this.ui.down(x, y); }
  move(x: number, y: number): void { this.ui.move(x, y); }
  up(x: number, y: number): void { this.ui.up(x, y); }
}
