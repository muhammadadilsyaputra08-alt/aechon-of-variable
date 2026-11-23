/** Kampanye: peta menara, alur lantai (cerita → konsep → puzzle → guardian → restorasi → cerita), boss. */
import { C, Gfx, W, H } from '../engine/gfx';
import { app, Button, Scene, UI, ease } from '../engine/core';
import { audio } from '../engine/audio';
import { save } from '../engine/save';
import { t, tb } from '../engine/i18n';
import { nav } from '../engine/nav';
import { FLOORS, FloorDef, GUARDIANS, GuardianDef, TIERS, floorByN, tierInfo } from '../data/floors';
import { TOPIC_BY_CODE } from '../data/topics';
import { EPILOGUE, FLOOR_INTRO, FLOOR_OUTRO, GUARDIAN_POST, GUARDIAN_PRE, PROLOGUE, TIER_INTRO, TUTORIAL } from '../data/story';
import { warehouse } from '../archivist/warehouse';
import { PuzzleResult, checkAchievements, markLearned } from '../engine/progress';
import { DialogueScene } from './dialogue';
import { PuzzleScene } from './puzzle';
import { bar, drawBg, drawStars, panel, sparkle } from './common';
import { AchievementsScene } from './menu';

export type Step = (next: () => void) => void;

/** Menjalankan urutan scene; scene pertama di-push, berikutnya me-replace. */
export function runSteps(steps: Step[], depth: number, onEnd: () => void): void {
  let i = 0;
  const next = (): void => {
    if (i >= steps.length) return onEnd();
    const s = steps[i++];
    s(next);
  };
  void depth;
  next();
}

export class SceneSlot {
  first = true;
  go(s: Scene): void {
    if (this.first) {
      this.first = false;
      app.push(s);
    } else app.replace(s);
  }
}

export function guardianSteps(def: GuardianDef, tier: number, slot: SceneSlot, depth: number, story: boolean, seedBase: number): Step[] {
  const steps: Step[] = [];
  const quit = (): void => app.popTo(depth);
  if (story) steps.push((next) => slot.go(new DialogueScene(GUARDIAN_PRE[def.id], { tier, onDone: next })));
  def.phases.forEach((ph, i) => {
    steps.push((next) => slot.go(new BossScene(def, i, 'start', tier, next)));
    steps.push((next) => {
      const cand = warehouse.curated(ph.topic, seedBase + i * 131 + 3, ph.target);
      slot.go(new PuzzleScene({ cand, tier, badge: 'Boss', progress: `${i + 1}/${def.phases.length} ${tb(ph.label)}`, onDone: () => next(), onQuit: quit }));
    });
    steps.push((next) => slot.go(new BossScene(def, i, 'hit', tier, next)));
  });
  if (story) steps.push((next) => slot.go(new DialogueScene(GUARDIAN_POST[def.id], { tier, onDone: next })));
  return steps;
}
export const GUARDIAN_INDEX: Record<GuardianDef['id'], number> = { keeper: 1, twins: 2, devourer: 3, null: 4 };

export function startFloor(n: number): void {
  const f = floorByN(n);
  const depth = app.stack.length;
  const slot = new SceneSlot();
  const quit = (): void => app.popTo(depth);
  const tier = f.tier;
  const steps: Step[] = [];
  const stars: number[] = [...save.floorRec(n).stars];
  const hadCleared = save.floorRec(n).cleared;

  if (n === 1 && !save.data.prologueDone) steps.push((next) => slot.go(new DialogueScene(PROLOGUE, { tier, onDone: () => ((save.data.prologueDone = true), save.commit(), next()) })));
  if (n === 1 && !save.data.tutorialDone) steps.push((next) => slot.go(new DialogueScene(TUTORIAL, { tier, onDone: () => ((save.data.tutorialDone = true), save.commit(), next()) })));
  const tinfo = tierInfo(tier);
  if (n === tinfo.from && !save.data.flags[`tier${tier}`]) steps.push((next) => slot.go(new DialogueScene(TIER_INTRO[tier], { tier, onDone: () => ((save.data.flags[`tier${tier}`] = 1), save.commit(), next()) })));
  steps.push((next) => slot.go(new DialogueScene([FLOOR_INTRO[n - 1]], { tier, onDone: next })));
  steps.push((next) => slot.go(new IntroCard(f, next, quit)));
  f.slots.forEach((s, i) => {
    steps.push((next) => {
      const cand = warehouse.curated(s.topic, s.seed, s.target);
      slot.go(new PuzzleScene({
        cand, tier, badge: `Lt ${n}`, progress: `${i + 1}/${f.slots.length}`,
        onDone: (r: PuzzleResult) => {
          stars[i] = Math.max(stars[i] ?? 0, r.stars);
          next();
        },
        onQuit: quit,
      }));
    });
  });
  if (f.guardian) {
    const def = GUARDIANS[f.guardian];
    steps.push(...guardianSteps(def, tier, slot, depth, true, n * 4001));
    steps.push((next) => {
      if (!save.data.guardians.includes(GUARDIAN_INDEX[def.id])) save.data.guardians.push(GUARDIAN_INDEX[def.id]);
      next();
    });
  }
  steps.push((next) => {
    const first = !hadCleared;
    save.data.floors[n] = { cleared: true, stars: f.slots.map((_, i) => stars[i] ?? 1) };
    if (first) {
      save.data.shards += f.rewards.shard;
      save.data.kp += f.rewards.kp;
    }
    checkAchievements();
    save.commit();
    slot.go(new RestoreScene(f, first, next));
  });
  steps.push((next) => slot.go(new DialogueScene([FLOOR_OUTRO[n - 1]], { tier, restored: true, onDone: next })));
  if (n === 30) steps.push((next) => slot.go(new DialogueScene(EPILOGUE, { tier: 4, restored: true, onDone: next })));
  runSteps(steps, depth, () => {
    app.popTo(depth);
    if (n < 30) app.toast(`${t('floor')} ${n + 1} ${t('on') === 'Nyala' ? 'terbuka' : 'unlocked'}`);
  });
}

/* ---------- Kartu pengenalan konsep ---------- */
class IntroCard implements Scene {
  private ui = new UI();
  constructor(private f: FloorDef, onStart: () => void, onQuit: () => void) {
    f.topics.slice(0, 2).forEach((c) => markLearned(c));
    this.ui.add(new Button(24, 152, 84, 20, () => t('codex'), () => app.push(nav.codex(f.topics[0]), false)));
    this.ui.add(new Button(116, 152, 84, 20, () => t('start'), onStart));
    this.ui.add(new Button(208, 152, 88, 20, () => t('quit'), onQuit));
  }
  enter(): void { audio.setMood(this.f.tier, 0); }
  draw(g: Gfx): void {
    drawBg(g, this.f.tier, false, 0.45);
    panel(g, 14, 10, 292, 168);
    g.text(`${t('floor')} ${this.f.n}: ${tb(this.f.name)}`, 160, 18, { size: 10, align: 'center', color: C.gold3 });
    g.text(tb(this.f.challenge), 160, 32, { size: 8, align: 'center', color: C.cyan3 });
    let y = 48;
    for (const code of this.f.topics.slice(0, 2)) {
      const m = TOPIC_BY_CODE[code];
      g.text(`${m.code}  ${tb(m.title)}`, 26, y, { size: 8, color: C.gold2 });
      g.text(`Visual: ${m.vis}`, 26, y + 10, { size: 6, color: C.blue3, shadow: null });
      g.wrap(m.concept, 262, 8).slice(0, 3).forEach((l, i) => g.math(l, 26, y + 20 + i * 10, { size: 8, color: C.cream3 }));
      y += 56;
    }
    this.ui.draw(g);
  }
  update(dt: number): void { this.ui.update(dt); }
  down(x: number, y: number): void { this.ui.down(x, y); }
  move(x: number, y: number): void { this.ui.move(x, y); }
  up(x: number, y: number): void { this.ui.up(x, y); }
}

/* ---------- Boss ---------- */
export class BossScene implements Scene {
  ambient = true;
  private ui = new UI();
  private tt = 0;
  private btn: Button;
  constructor(private def: GuardianDef, private phase: number, private mode: 'start' | 'hit', private tier: number, onNext: () => void) {
    this.btn = this.ui.add(new Button(120, 152, 80, 20, () => (mode === 'start' ? t('start') : t('next')), onNext));
    this.btn.visible = mode === 'start';
  }
  enter(): void {
    audio.setMood(this.tier, 2);
    audio.sfx(this.mode === 'start' ? 'boss' : 'ok');
  }
  update(dt: number): void {
    this.tt += dt;
    this.ui.update(dt);
    if (this.mode === 'hit') this.btn.visible = this.tt > 1.4;
  }
  draw(g: Gfx): void {
    const n = this.def.phases.length;
    drawBg(g, this.tier, false, 0.5);
    const hit = this.mode === 'hit';
    const frac0 = (n - this.phase) / n;
    const frac1 = (n - this.phase - 1) / n;
    const frac = hit ? frac0 + (frac1 - frac0) * ease(this.tt / 1.2) : frac0;
    const flash = hit && this.tt < 0.8 && Math.floor(this.tt * 14) % 2 === 0;
    const sx = hit && this.tt < 0.6 ? Math.round(Math.sin(this.tt * 70) * 3) : 0;
    sparkle(g, app.time, 20, 0, 20, W, 100);
    g.spr(this.def.sprite, Math.floor(app.time * 2) % 2 ? 'idle_1' : 'idle_0', 160 - this.def.frameW / 2 + sx, 146 - this.def.frameH, { a: flash ? 0.35 : 1 });
    g.nine('name_plate', 60, 4, 200, 16);
    g.text(tb(this.def.name), 160, 7, { size: 8, align: 'center', color: C.red3 });
    bar(g, 60, 22, 200, 10, frac, C.red2);
    const ph = this.def.phases[this.phase];
    if (this.mode === 'start') {
      g.text(`Fase ${this.phase + 1}/${n}`, 160, 38, { size: 8, align: 'center', color: C.gold3 });
      g.text(tb(ph.label), 160, 48, { size: 8, align: 'center', color: C.cyan3 });
      g.text('Tanpa tekanan waktu. Kesalahan = kesempatan belajar.', 160, 134, { size: 6, align: 'center', color: C.stone3, shadow: null });
    } else g.text(this.phase === n - 1 ? 'Guardian dikalahkan!' : 'Serangan berhasil!', 160, 40, { size: 10, align: 'center', color: C.moss3 });
    this.ui.draw(g);
  }
  down(x: number, y: number): void { this.ui.down(x, y); }
  move(x: number, y: number): void { this.ui.move(x, y); }
  up(x: number, y: number): void { this.ui.up(x, y); }
}

/* ---------- Restorasi ---------- */
class RestoreScene implements Scene {
  private ui = new UI();
  private tt = 0;
  private btn: Button;
  private state: 'partial' | 'full';
  private avg: number;
  constructor(private f: FloorDef, private first: boolean, onNext: () => void) {
    this.btn = this.ui.add(new Button(120, 154, 80, 20, () => t('next'), onNext));
    this.btn.visible = false;
    this.state = save.floorState(f.n) === 'full' ? 'full' : 'partial';
    this.avg = save.floorRec(f.n).stars.reduce((a, b) => a + b, 0);
  }
  enter(): void { audio.setMood(this.f.tier, 0); audio.sfx('restore'); }
  update(dt: number): void {
    this.tt += dt * (save.data.settings.reduceFx ? 3 : 1);
    this.ui.update(dt);
    this.btn.visible = this.tt > 2.6;
  }
  draw(g: Gfx): void {
    g.img(`${tierInfo(this.f.tier).bg}_ruined`, 0, 0);
    const p = ease(this.tt / 2.4);
    g.ctx.save();
    g.ctx.beginPath();
    g.ctx.rect(0, 0, W * p, H);
    g.ctx.clip();
    g.img(`${tierInfo(this.f.tier).bg}_restored`, 0, 0);
    g.ctx.restore();
    if (p < 1) g.rect(W * p - 1, 0, 2, H, C.gold3, 0.8);
    if (!save.data.settings.reduceFx) sparkle(g, this.tt, 40, 0, 0, W * p, H);
    if (this.tt > 1.2) {
      const a = Math.min(1, (this.tt - 1.2) / 0.6);
      g.rect(0, 40, W, 70, C.void0, 0.55 * a);
      g.text(t('restored'), 160, 48, { size: 14, align: 'center', color: C.gold2, alpha: a, bold: true });
      g.text(`${t('floor')} ${this.f.n}: ${tb(this.f.name)}  ·  ${t(this.state === 'full' ? 'full' : 'partial')}`, 160, 68, { size: 8, align: 'center', color: C.cyan3, alpha: a });
      drawStars(g, Math.round(this.avg / this.f.slots.length), 160 - 27, 82, 3);
      if (this.first) g.text(`+${this.f.rewards.shard} Arcane Shard   +${this.f.rewards.kp} Knowledge Point`, 160, 102, { size: 6, align: 'center', color: C.gold3, alpha: a, shadow: null });
    }
    this.ui.draw(g);
  }
  down(x: number, y: number): void { this.ui.down(x, y); }
  move(x: number, y: number): void { this.ui.move(x, y); }
  up(x: number, y: number): void { this.ui.up(x, y); }
}

/* ---------- Peta menara ---------- */
export class CampaignScene implements Scene {
  private ui = new UI();
  private tier: 1 | 2 | 3 | 4;
  private cards: Array<{ f: FloorDef; x: number; y: number }> = [];
  private tabBtns: Button[] = [];
  constructor() {
    const hi = save.highestUnlocked();
    this.tier = floorByN(hi).tier;
    TIERS.forEach((ti, i) => {
      this.tabBtns.push(this.ui.add(new Button(8 + i * 76, 4, 72, 16, `Tier ${['I', 'II', 'III', 'IV'][i]}`, () => this.setTier(ti.tier), { size: 8 })));
    });
    this.ui.add(new Button(8, 158, 60, 18, () => t('back'), () => app.pop(), { size: 8 }));
    this.ui.add(new Button(252, 158, 60, 18, '', () => app.push(new AchievementsScene()), { icon: 'star_full' }));
    this.setTier(this.tier);
  }
  private setTier(tier: 1 | 2 | 3 | 4): void {
    this.tier = tier;
    const fs = FLOORS.filter((f) => f.tier === tier);
    this.cards = fs.map((f, i) => ({ f, x: 12 + (i % 5) * 60, y: 50 + Math.floor(i / 5) * 46 }));
  }
  enter(): void { audio.setMood(this.tier, 0); }
  update(dt: number): void { this.ui.update(dt); }
  draw(g: Gfx): void {
    const info = tierInfo(this.tier);
    const anyClear = FLOORS.some((f) => f.tier === this.tier && save.floorRec(f.n).cleared);
    drawBg(g, this.tier, anyClear, 0.38);
    this.tabBtns.forEach((b, i) => {
      if (i + 1 === this.tier) g.frame(b.x - 1, b.y - 1, b.w + 2, b.h + 2, C.gold2);
    });
    g.text(`${tb(info.name)}  ·  ${tb(info.level)}`, 160, 28, { size: 8, align: 'center', color: C.cyan3 });
    g.text(`${t('floor')} ${info.from}–${info.to}`, 160, 38, { size: 6, align: 'center', color: C.stone3, shadow: null });
    const hi = save.highestUnlocked();
    for (const { f, x, y } of this.cards) {
      const unlocked = f.n <= hi;
      const st = save.floorState(f.n);
      panel(g, x, y, 56, 42);
      g.rect(x + 3, y + 3, 50, 36, st === 'full' ? C.moss1 : st === 'partial' ? C.cyan1 : C.stone0, 0.35);
      g.text(`${f.n}`, x + 8, y + 5, { size: 10, color: unlocked ? C.gold3 : C.stone2 });
      if (f.guardian) g.text('BOSS', x + 50, y + 6, { size: 6, align: 'right', color: C.red3, shadow: null });
      g.wrap(tb(f.name), 48, 6).slice(0, 2).forEach((nm, i) => g.text(nm, x + 28, y + 17 + i * 7, { size: 6, align: 'center', color: unlocked ? C.cream3 : C.stone2, shadow: null }));
      if (!unlocked) g.icon('icon_lock', x + 40, y + 24, 0.8);
      else {
        const sum = save.floorRec(f.n).stars.reduce((a, b) => a + b, 0);
        g.text(save.floorRec(f.n).cleared ? `★ ${sum}/9` : t(st), x + 28, y + 30, { size: 6, align: 'center', color: save.floorRec(f.n).cleared ? C.gold2 : C.stone3, shadow: null });
      }
      if (f.n === hi) g.frame(x - 1, y - 1, 58, 44, C.gold2, 0.5 + 0.5 * Math.sin(app.time * 5));
    }
    const done = FLOORS.filter((f) => save.floorRec(f.n).cleared).length;
    g.text(`${t('shards')} ${save.data.shards}   ${t('kp')} ${save.data.kp}   ${done}/30`, 160, 164, { size: 6, align: 'center', color: C.cream3, shadow: null });
    this.ui.draw(g);
    void H;
  }
  down(x: number, y: number): void {
    if (this.ui.down(x, y)) return;
    for (const c of this.cards) {
      if (x >= c.x && x < c.x + 56 && y >= c.y && y < c.y + 42) {
        if (c.f.n > save.highestUnlocked()) {
          audio.sfx('bad');
          app.toast(`${t('locked')}: ${t('floor')} ${save.highestUnlocked()}`);
        } else {
          audio.sfx('tap');
          startFloor(c.f.n);
        }
        return;
      }
    }
  }
  move(x: number, y: number): void { this.ui.move(x, y); }
  up(x: number, y: number): void { this.ui.up(x, y); }
}
