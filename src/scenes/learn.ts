/** Alur pembelajaran: soal terpadu, Level Guide, runner sublevel (resume), kartu info, dan Boss Battle ber-HP. */
import { C, Gfx, W } from '../engine/gfx';
import { app, Button, Scene, UI } from '../engine/core';
import { audio } from '../engine/audio';
import { t, tb } from '../engine/i18n';
import { nav } from '../engine/nav';
import { GuardianDef } from '../data/floors';
import { TOPIC_BY_CODE, TopicCode } from '../data/topics';
import { STAGE_LABEL, Sublevel, level, subOf } from '../learn/curriculum';
import { Question, makeQuestion, qSig, qVariant } from '../learn/factory';
import { genWb, WB_VARIANTS } from '../learn/wbgen';
import { BossEvent, bossQuestion, phaseIndex, resolve, sessionFor } from '../learn/boss';
import { BossSession } from '../learn/types';
import { addHist, completeSub, failChallenge, histSet, learn, lp, nextIndex, persist, recordAnswer, isDone } from '../learn/store';
import { PuzzleScene } from './puzzle';
import { WorkboardScene } from './workboard';
import { drawBg, panel, sparkle } from './common';

export interface QResult {
  success: boolean;
  firstTry: boolean;
  stars: number;
  tags: string[];
}
export interface QOpts {
  tier: number;
  badge: string;
  progress?: string;
  practice?: boolean;
  oneShot?: boolean;
  onDone: (r: QResult) => void;
  onQuit?: () => void;
}
/** Satu pintu untuk menampilkan soal: Workboard (ekspresi) atau puzzle visual Archivist. */
export function questionScene(q: Question, o: QOpts): Scene {
  if (q.type === 'wb') {
    return new WorkboardScene({
      q: q.q, tier: o.tier, badge: o.badge, progress: o.progress, practice: o.practice, oneShot: o.oneShot, onQuit: o.onQuit,
      onDone: (r) => o.onDone({ success: r.success, firstTry: r.success && r.attempts === 1 && r.hints === 0, stars: r.stars, tags: r.tags }),
    });
  }
  return new PuzzleScene({
    cand: q.cand, tier: o.tier, badge: o.badge, progress: o.progress, practice: o.practice, oneShot: o.oneShot, onQuit: o.onQuit,
    onDone: (r) => o.onDone({ success: r.success, firstTry: r.success && r.attempts === 1 && r.hints === 0, stars: r.stars, tags: [] }),
  });
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

/** Heart & pip dari sheet ui_learn. */
export function hearts(g: Gfx, x: number, y: number, hp: number, max: number, gap = 12): void {
  for (let i = 0; i < max; i++) g.spr('ui_learn', i < hp ? 'heart_full' : 'heart_empty', x + i * gap, y);
}
export function pips(g: Gfx, x: number, y: number, hp: number, max: number, gap = 12): void {
  for (let i = 0; i < max; i++) g.spr('ui_learn', i < hp ? 'pip_full' : 'pip_empty', x + i * gap, y);
}

/* ---------- Kartu info generik ---------- */
export class InfoCard implements Scene {
  private ui = new UI();
  constructor(private tier: number, private title: string, private lines: string[], private color: string, next: { label: string; fn: () => void }, quit?: () => void) {
    this.ui.add(new Button(quit ? 70 : 120, 150, quit ? 84 : 80, 20, next.label, next.fn));
    if (quit) this.ui.add(new Button(166, 150, 84, 20, () => t('quit'), quit));
  }
  draw(g: Gfx): void {
    drawBg(g, this.tier, false, 0.55);
    panel(g, 40, 22, 240, 150);
    sparkle(g, app.time, 12, 40, 22, 240, 150);
    g.text(this.title, 160, 32, { size: 10, align: 'center', color: this.color });
    let y = 52;
    for (const l of this.lines) for (const w of g.wrap(l, 216, 8)) { g.text(w, 160, y, { size: 8, align: 'center', color: C.cream3 }); y += 11; }
    this.ui.draw(g);
  }
  down(x: number, y: number): void { this.ui.down(x, y); }
  move(x: number, y: number): void { this.ui.move(x, y); }
  up(x: number, y: number): void { this.ui.up(x, y); }
  update(dt: number): void { this.ui.update(dt); }
}

/* ---------- Level Guide ---------- */
export class GuideScene implements Scene {
  private ui = new UI();
  private ex: ReturnType<typeof genWb> | null;
  constructor(private sub: Sublevel, private tier: number, onStart: () => void, onQuit: () => void) {
    const v = level(sub.topic).subs.flatMap((s) => s.variants).find((x) => WB_VARIANTS[x]);
    this.ex = v ? genWb(v, 4242, 1) : null;
    this.ui.add(new Button(14, 154, 84, 20, () => t('codex'), () => app.push(nav.codex(sub.topic), false)));
    this.ui.add(new Button(118, 154, 84, 20, () => t('start'), onStart));
    this.ui.add(new Button(222, 154, 84, 20, () => t('quit'), onQuit));
  }
  draw(g: Gfx): void {
    const m = TOPIC_BY_CODE[this.sub.topic];
    const L = level(this.sub.topic);
    drawBg(g, this.tier, false, 0.55);
    panel(g, 8, 6, 304, 144);
    g.text(`LEVEL GUIDE · ${m.code} ${tb(m.title)}`, 160, 11, { size: 8, align: 'center', color: C.gold3 });
    g.wrap(m.concept, 288, 8).slice(0, 3).forEach((l, i) => g.math(l, 16, 24 + i * 10, { size: 8, color: C.cream3 }));
    if (this.ex) {
      g.text('CONTOH PENGERJAAN', 16, 56, { size: 6, color: C.cyan3, shadow: null });
      g.math(this.ex.expr, 16, 64, { size: 8, color: C.gold3 });
      this.ex.steps.slice(0, 3).forEach((s, i) => g.math(`${i + 1}.  ${s}`, 24, 75 + i * 10, { size: 8, color: C.cream3 }));
    }
    g.text('PETA LEVEL', 16, 108, { size: 6, color: C.cyan3, shadow: null });
    L.subs.slice(1).forEach((s, i) => {
      const x = 16 + (i % 6) * 48;
      const y = 117 + Math.floor(i / 6) * 14;
      const done = isDone(s.topic, s.index);
      g.rect(x, y, 45, 11, done ? C.moss1 : C.stone0, 0.9);
      g.frame(x, y, 45, 11, s.stage === 'challenge' ? C.gold2 : C.ind2, 0.7);
      g.text(`${s.index - 1} ${tb(STAGE_LABEL[s.stage]).slice(0, 7)}`, x + 22, y + 2, { size: 6, align: 'center', color: done ? C.moss3 : C.cream3, shadow: null });
    });
    this.ui.draw(g);
  }
  down(x: number, y: number): void { this.ui.down(x, y); }
  move(x: number, y: number): void { this.ui.move(x, y); }
  up(x: number, y: number): void { this.ui.up(x, y); }
  update(dt: number): void { this.ui.update(dt); }
}

const rnd32 = (): number => (Math.random() * 0xffffffff) >>> 0;

/** Menjalankan sublevel hingga sasaran tiap materi terpenuhi; posisi disimpan sehingga bisa dilanjutkan. */
export function runGoals(goals: Array<{ topic: TopicCode; count: number }>, slot: SceneSlot, depth: number, tier: number, onDone: () => void): void {
  const quit = (): void => {
    persist();
    app.popTo(depth);
  };
  const step = (): void => {
    const g = goals.find((x) => nextIndex(x.topic, x.count) !== null);
    if (!g) return onDone();
    const idx = nextIndex(g.topic, g.count) as number;
    const sub = subOf(g.topic, idx);
    if (sub.stage === 'guide') {
      slot.go(new GuideScene(sub, tier, () => { completeSub(sub.topic, idx); step(); }, quit));
      return;
    }
    ask(sub);
  };
  const ask = (sub: Sublevel): void => {
    const p = lp(sub.topic);
    const i = p.qDone;
    if (p.seeds[i] === undefined) {
      p.seeds[i] = rnd32();
      persist();
    }
    const q = makeQuestion({ topic: sub.topic, variants: sub.variants, target: sub.target, seed: p.seeds[i], exclude: histSet() });
    slot.go(
      questionScene(q, {
        tier, badge: sub.id, progress: `${i + 1}/${sub.count}`, onQuit: quit,
        onDone: (r) => {
          recordAnswer(sub.topic, sub.index, r.firstTry);
          addHist(qSig(q));
          if (!r.firstTry) {
            const a = learn().arch;
            a.weakVariant[qVariant(q)] = (a.weakVariant[qVariant(q)] ?? 0) + 1;
            for (const tg of r.tags) a.weakTag[tg] = (a.weakTag[tg] ?? 0) + 1;
          }
          p.qDone++;
          persist();
          if (p.qDone < sub.count) return ask(sub);
          finish(sub);
        },
      }),
    );
  };
  const finish = (sub: Sublevel): void => {
    const [ok, tot] = lp(sub.topic).acc[sub.index] ?? [0, 0];
    const acc = tot ? ok / tot : 1;
    const pct = `${Math.round(acc * 100)}%`;
    const L = level(sub.topic);
    if (sub.stage === 'challenge' && acc < L.passAccuracy) {
      failChallenge(sub.topic, sub.index);
      slot.go(new InfoCard(tier, 'BELUM LULUS', [`Akurasi ${pct}. Dibutuhkan minimal ${Math.round(L.passAccuracy * 100)}% pada percobaan pertama.`, 'Soal akan dibuat baru. Tinjau Codex atau Archive lebih dulu bila perlu.'], C.red3, { label: 'Ulangi', fn: step }, quit));
      return;
    }
    completeSub(sub.topic, sub.index);
    audio.sfx('restore');
    const left = L.subs.length - lp(sub.topic).done.length;
    slot.go(new InfoCard(tier, sub.stage === 'challenge' ? 'LEVEL DIKUASAI!' : 'SUBLEVEL SELESAI', [`${sub.id} · ${tb(sub.title)}`, `Akurasi percobaan pertama: ${pct}`, left > 0 ? `Sisa sublevel: ${left}` : 'Seluruh sublevel level ini selesai.'], C.moss3, { label: t('next'), fn: step }, quit));
  };
  step();
}

/* ---------- Boss Battle ---------- */
export class BossArena implements Scene {
  ambient = true;
  private ui = new UI();
  private tt = 0;
  private btn: Button;
  constructor(private def: GuardianDef, private s: BossSession, private ev: BossEvent | 'ready' | 'resume', private tier: number, onNext: () => void, onQuit: () => void) {
    const label = ev === 'ready' ? t('start') : ev === 'resume' ? t('resume') : ev === 'lose' ? 'Coba lagi' : ev === 'win' ? t('next') : 'Serang!';
    this.btn = this.ui.add(new Button(110, 154, 100, 20, label, onNext));
    if (ev === 'ready' || ev === 'resume' || ev === 'lose') this.ui.add(new Button(224, 154, 84, 20, () => t('quit'), onQuit));
    this.btn.visible = false;
  }
  enter(): void {
    audio.setMood(this.tier, 2);
    audio.sfx(this.ev === 'ready' || this.ev === 'resume' ? 'boss' : this.ev === 'miss' || this.ev === 'lose' ? 'bad' : 'ok');
  }
  update(dt: number): void {
    this.tt += dt;
    this.ui.update(dt);
    this.btn.visible = this.tt > (this.ev === 'ready' || this.ev === 'resume' ? 0.2 : 0.9);
  }
  draw(g: Gfx): void {
    const s = this.s;
    drawBg(g, this.tier, false, 0.5);
    sparkle(g, app.time, 20, 0, 0, W, 100);
    const hit = this.ev === 'hit' || this.ev === 'win';
    const flash = hit && this.tt < 0.8 && Math.floor(this.tt * 14) % 2 === 0;
    const sx = hit && this.tt < 0.6 ? Math.round(Math.sin(this.tt * 70) * 3) : 0;
    g.spr(this.def.sprite, Math.floor(app.time * 2) % 2 ? 'idle_1' : 'idle_0', 160 - this.def.frameW / 2 + sx, 140 - this.def.frameH, { a: flash ? 0.35 : this.ev === 'win' ? Math.max(0, 1 - this.tt / 1.2) : 1 });
    g.nine('name_plate', 60, 3, 200, 16);
    g.text(tb(this.def.name), 160, 6, { size: 8, align: 'center', color: C.red3 });
    // Boss HP
    pips(g, 160 - (s.bossMax * 11) / 2, 21, s.bossHp, s.bossMax, 11);
    const ph = this.def.phases[phaseIndex(this.def, s)];
    g.text(`Fase ${phaseIndex(this.def, s) + 1}/${this.def.phases.length} · ${tb(ph.label)}`, 160, 36, { size: 6, align: 'center', color: C.cyan3, shadow: null });
    // Player HP
    g.nine('name_plate', 6, 128, 120, 22);
    g.text('HP', 12, 135, { size: 6, color: C.red3, shadow: null });
    hearts(g, 26, 132, s.playerHp, s.playerMax, 15 - Math.max(0, s.playerMax - 5));
    if (s.combo >= 2) {
      g.spr('ui_learn', 'bolt', 250, 128);
      g.text(`KOMBO ×${s.combo}`, 268, 133, { size: 8, color: C.gold3 });
    }
    const msg: Record<string, [string, string]> = {
      ready: ['Jawab benar untuk melukai Guardian.', 'Satu kesempatan per soal. Salah = HP-mu berkurang.'],
      resume: ['Pertarungan dilanjutkan.', 'Soal tetap sama seperti sebelum kamu keluar.'],
      hit: ['Serangan berhasil! HP Guardian −1', ''],
      miss: ['Kamu terkena serangan! HP −1', 'Pelajari kesalahannya, lalu lanjut.'],
      win: ['GUARDIAN DIKALAHKAN!', `Sisa HP: ${s.playerHp}`],
      lose: ['HP habis. Pertarungan diulang dari awal.', 'Soal berikutnya dibuat baru; progres sublevel aman.'],
    };
    const [a, b] = msg[this.ev];
    g.text(a, 160, 112, { size: 8, align: 'center', color: this.ev === 'miss' || this.ev === 'lose' ? C.red3 : this.ev === 'ready' || this.ev === 'resume' ? C.cream3 : C.moss3 });
    g.text(b, 160, 123, { size: 6, align: 'center', color: C.stone3, shadow: null });
    this.ui.draw(g);
  }
  down(x: number, y: number): void { this.ui.down(x, y); }
  move(x: number, y: number): void { this.ui.move(x, y); }
  up(x: number, y: number): void { this.ui.up(x, y); }
}

/** Boss Battle dengan HP. Mengembalikan kontrol lewat onWin; onQuit menyimpan sesi (resume). */
export function runBoss(def: GuardianDef, tier: number, slot: SceneSlot, depth: number, onWin: () => void): void {
  const quit = (): void => {
    persist();
    app.popTo(depth);
  };
  const open = (): void => {
    const { s, resumed } = sessionFor(def.id);
    slot.go(new BossArena(def, s, resumed ? 'resume' : 'ready', tier, () => fight(s), quit));
  };
  const after = (s: BossSession, ev: BossEvent): void => {
    if (ev === 'win') slot.go(new BossArena(def, s, ev, tier, onWin, quit));
    else if (ev === 'lose') slot.go(new BossArena(def, s, ev, tier, open, quit));
    else slot.go(new BossArena(def, s, ev, tier, () => fight(s), quit));
  };
  const fight = (s: BossSession): void => {
    const q = bossQuestion(def, s);
    slot.go(
      questionScene(q, {
        tier, badge: 'Boss', progress: `HP ${s.playerHp}/${s.playerMax}  ·  Guardian ${s.bossHp}/${s.bossMax}`, oneShot: true,
        // Keluar di tengah soal dihitung sebagai serangan yang tidak dijawab (mencegah kabur untuk menghindari soal).
        onQuit: () => {
          resolve(s, q, false);
          quit();
        },
        onDone: (r) => after(s, resolve(s, q, r.success)),
      }),
    );
  };
  open();
}
