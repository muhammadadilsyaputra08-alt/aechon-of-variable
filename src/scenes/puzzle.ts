/** Scene puzzle generik: timbangan interaktif (Tier I) + kontrol knob untuk semua mekanik lain. */
import { C, Gfx, W } from '../engine/gfx';
import { app, Button, Scene, UI, clamp } from '../engine/core';
import { audio } from '../engine/audio';
import { save } from '../engine/save';
import { t, tb } from '../engine/i18n';
import { nav } from '../engine/nav';
import { PuzzleResult, recordHint, recordMistake, recordSuccess, starsFor } from '../engine/progress';
import { Answer, Candidate, Knob } from '../archivist/types';
import { verifyAnswer } from '../archivist/kinds';
import { fmtTerms } from '../archivist/generators';
import { Q, q, add, cmp, fmtQ, toNumber, parseQ } from '../math/rational';
import { AREA, VIEWS, VCtx, tapView } from './views';
import { drawBg, drawStars, panel, sparkle } from './common';
import { HintScene, NumpadScene, PauseScene } from './modals';
import { WorkboardScene } from './workboard';

export interface PuzzleOpts {
  cand: Candidate;
  tier: number;
  badge: string;
  progress?: string;
  timer?: number;
  practice?: boolean;
  /** Satu kesempatan menjawab (Boss Battle): jawaban salah mengakhiri soal. */
  oneShot?: boolean;
  onDone: (r: PuzzleResult) => void;
  onQuit?: () => void;
}
interface Bal { a: number; b: number; c: number; d: number }
interface KnobBox { k: Knob; x: number; y: number; w: number; h: number; inside: boolean }

const nq = (x: number): Q => (Number.isInteger(x) ? q(x) : (parseQ(String(x)) ?? q(0)));

export class PuzzleScene implements Scene {
  ambient = true;
  private ui = new UI();
  private vals: Answer = {};
  private init: Answer = {};
  private hist: Answer[] = [];
  private attempts = 0;
  private hintLevel = 0;
  private steps = 0;
  private elapsed = 0;
  private solved = false;
  private ended = false;
  private res: PuzzleResult | null = null;
  private shards = 0;
  private fb = { text: '', color: C.cream3, t: 0 };
  private fails = 0;
  private shake = 0;
  private failEnd = 0;
  private spot = 0;
  private revealT = 0;
  private boxes: KnobBox[] = [];
  private dragging = false;
  private btnSubmit!: Button;
  private btnHint!: Button;
  private btnDone: Button;
  // timbangan
  private bal: Bal = { a: 0, b: 0, c: 0, d: 0 };
  private balInit: Bal = { a: 0, b: 0, c: 0, d: 0 };
  private balHist: Bal[] = [];
  private op: 'sub' | 'add' | 'div' = 'sub';
  private term: 'unit' | 'x' = 'unit';
  private amt = 1;
  private tilt = 0;
  private tiltT = 0;
  private hits: Array<{ x: number; y: number; side: 'L' | 'R'; kind: 'x' | 'u'; neg: boolean }> = [];
  private opBtns: Button[] = [];
  private termBtns: Button[] = [];
  private isBalance: boolean;

  constructor(private o: PuzzleOpts) {
    const c = o.cand;
    this.isBalance = c.kind === 'balance';
    for (const k of c.knobs) this.init[k.id] = nq(k.init);
    this.vals = { ...this.init };
    this.btnDone = new Button(120, 105, 80, 18, o.practice ? t('ok') : t('next'), () => this.finish());
    this.buildHud();
    if (this.isBalance) this.buildBalance();
    else this.buildKnobs();
  }

  /* ---------- UI ---------- */
  private buildHud(): void {
    const icons: Array<[string, () => void]> = [
      ['icon_hint', () => this.openHint()],
      ['', () => app.push(new WorkboardScene({ q: null, tier: this.o.tier, badge: 'Coret', practice: true, onDone: () => app.pop(false), onQuit: () => app.pop(false) }), false)],
      ['icon_undo', () => this.undo()],
      ['icon_reset', () => this.reset()],
      ['icon_codex', () => app.push(nav.codex(this.o.cand.topic), false)],
      ['icon_pause', () => app.push(new PauseScene(this.o.cand, () => (this.o.onQuit ?? (() => app.reset(nav.title())))()), false)],
    ];
    icons.forEach(([ic, fn], i) => {
      const b = this.ui.add(new Button(320 - (6 - i) * 18 - 1, 1, 17, 17, ic ? '' : 'Wb', fn, ic ? { icon: ic } : { size: 6 }));
      if (i === 0) this.btnHint = b;
    });
  }
  private buildKnobs(): void {
    const ks = this.o.cand.knobs;
    const n = ks.length;
    const cols = n <= 3 ? n : n === 4 ? 2 : 3;
    const rows = Math.ceil(n / cols);
    const inside = n >= 4;
    const cw = Math.floor(232 / cols) - 4;
    const rh = inside ? 22 : 26;
    const y0 = rows === 1 ? 140 : 132;
    ks.forEach((k, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = 4 + col * (cw + 4) + (n === 1 ? 52 : n === 2 ? 0 : 0);
      const y = y0 + row * (rh + 3);
      const w = n === 1 ? 120 : cw;
      this.boxes.push({ k, x: x + 15, y: y + (inside ? 0 : 7), w: w - 30, h: inside ? rh : 18, inside });
      this.ui.add(new Button(x, y + (inside ? 0 : 7), 16, inside ? rh : 18, '-', () => this.step(k, -1), { repeat: true }));
      this.ui.add(new Button(x + w - 16, y + (inside ? 0 : 7), 16, inside ? rh : 18, '+', () => this.step(k, 1), { repeat: true }));
    });
    this.btnSubmit = this.ui.add(new Button(242, 140, 74, 30, t('activate'), () => this.submit(), { size: 8 }));
  }
  private buildBalance(): void {
    const rel = this.o.cand.data.eq as string;
    const [l, r] = rel.split('=').map((s) => s.trim());
    const co = (s: string): [number, number] => {
      let a = 0;
      let b = 0;
      for (const m of s.replace(/\s+/g, '').replace(/-/g, '+-').split('+').filter(Boolean)) {
        if (m.includes('x')) a += m === 'x' ? 1 : m === '-x' ? -1 : Number(m.replace('x', ''));
        else b += Number(m);
      }
      return [a, b];
    };
    const [a, b] = co(l);
    const [c, d] = co(r);
    this.bal = { a, b, c, d };
    this.balInit = { ...this.bal };
    const mk = (label: string, x: number, y: number, w: number, fn: () => void): Button => this.ui.add(new Button(x, y, w, 18, label, fn, { size: 8 }));
    this.opBtns = [mk('Kurang', 4, 132, 54, () => this.setOp('sub')), mk('Tambah', 62, 132, 54, () => this.setOp('add')), mk('Bagi', 120, 132, 40, () => this.setOp('div'))];
    this.termBtns = [mk('angka', 168, 132, 38, () => (this.term = 'unit')), mk('x', 210, 132, 28, () => (this.term = 'x'))];
    this.ui.add(new Button(4, 153, 16, 20, '-', () => this.stepAmt(-1), { repeat: true }));
    this.ui.add(new Button(70, 153, 16, 20, '+', () => this.stepAmt(1), { repeat: true }));
    this.btnSubmit = this.ui.add(new Button(242, 140, 74, 30, t('apply'), () => this.applyOp(), { size: 8 }));
  }

  /* ---------- Aksi ---------- */
  private say(text: string, color: string = C.cream3, secs = 3): void {
    this.fb = { text, color, t: secs };
  }
  private setOp(op: 'sub' | 'add' | 'div'): void {
    this.op = op;
    this.amt = op === 'div' ? 2 : Math.max(1, Math.abs(this.amt));
  }
  private stepAmt(dir: number): void {
    if (this.op === 'div') {
      let v = this.amt + dir;
      if (v === 0 || v === 1) v = dir > 0 ? 2 : -1;
      if (v === -1 && dir > 0) v = 2;
      this.amt = clamp(v, -9, 9);
    } else this.amt = clamp(this.amt + dir, 1, 30);
  }
  private step(k: Knob, dir: number): void {
    if (this.solved) return;
    const cur = this.vals[k.id];
    let next: Q;
    if (k.choices) {
      const n = k.choices.length;
      next = q((((Math.round(toNumber(cur)) + dir) % n) + n) % n);
    } else {
      next = add(cur, nq(k.step * dir));
      if (cmp(next, nq(k.min)) < 0) next = nq(k.min);
      if (cmp(next, nq(k.max)) > 0) next = nq(k.max);
    }
    this.setVal({ [k.id]: next });
    audio.sfx('move');
  }
  private setVal(patch: Answer): void {
    if (!this.dragging) this.hist.push({ ...this.vals });
    if (this.hist.length > 60) this.hist.shift();
    this.vals = { ...this.vals, ...patch };
  }
  private undo(): void {
    if (this.solved) return;
    if (this.isBalance) {
      const p = this.balHist.pop();
      if (p) {
        this.bal = p;
        this.steps = Math.max(0, this.steps - 1);
      }
    } else {
      const p = this.hist.pop();
      if (p) this.vals = p;
    }
  }
  private reset(): void {
    if (this.solved) return;
    if (this.isBalance) {
      this.balHist.push({ ...this.bal });
      this.bal = { ...this.balInit };
    } else {
      this.hist.push({ ...this.vals });
      this.vals = { ...this.init };
    }
    this.say('Papan diulang. Hitungan hint dan percobaan tetap tersimpan.', C.stone3, 2);
  }
  private openHint(): void {
    if (this.solved) return;
    app.push(
      new HintScene(
        this.o.cand,
        this.hintLevel,
        (lv) => {
          if (lv > this.hintLevel) {
            this.hintLevel = lv;
            recordHint(this.o.cand);
          }
          if (lv >= 3) this.spot = 4;
          if (lv >= 4 && this.isBalance) this.preselectNext();
        },
        this.isBalance ? () => this.guideStep() : this.o.cand.solution ? () => this.fillSolution() : undefined,
      ),
      false,
    );
  }
  private nextOp(): { op: 'sub' | 'add' | 'div'; term: 'unit' | 'x'; amt: number } | null {
    const { a, b, c, d } = this.bal;
    if (c !== 0 && a !== 0 && !(a === 1 && b === 0 && c === 0)) return { op: c > 0 ? 'sub' : 'add', term: 'x', amt: Math.abs(c) };
    if (b !== 0 && c === 0) return { op: b > 0 ? 'sub' : 'add', term: 'unit', amt: Math.abs(b) };
    if (c === 0 && b === 0 && a !== 1 && a !== 0) return { op: 'div', term: 'unit', amt: a };
    void d;
    return null;
  }
  private preselectNext(): void {
    const n = this.nextOp();
    if (!n) return;
    this.op = n.op;
    this.term = n.term;
    this.amt = n.amt;
  }
  private guideStep(): void {
    this.preselectNext();
    this.applyOp();
  }
  private fillSolution(): void {
    if (!this.o.cand.solution || this.solved) return;
    this.hist.push({ ...this.vals });
    this.vals = { ...this.vals, ...this.o.cand.solution };
    app.pop(false);
    this.say('Jawaban terbimbing diisi. Tekan Aktifkan untuk memeriksa.', C.cyan3, 4);
  }
  private applyOp(): void {
    if (this.solved) return;
    const { a, b, c, d } = this.bal;
    let nb: Bal;
    if (this.op === 'div') {
      const k = this.amt;
      if (![a, b, c, d].every((v) => v % k === 0)) {
        this.say('Tidak habis dibagi. Pilih pembagi yang membagi semua kristal.', C.red3);
        audio.sfx('bad');
        return;
      }
      nb = { a: a / k, b: b / k, c: c / k, d: d / k };
    } else {
      const s = this.op === 'sub' ? -this.amt : this.amt;
      nb = this.term === 'x' ? { a: a + s, b, c: c + s, d } : { a, b: b + s, c, d: d + s };
    }
    if (Object.values(nb).some((v) => Math.abs(v) > 99)) {
      this.say('Angkanya terlalu besar untuk timbangan.', C.red3);
      return;
    }
    this.balHist.push({ ...this.bal });
    this.bal = nb;
    this.steps++;
    audio.sfx('move');
    this.say('Kedua sisi diubah sama. Timbangan tetap seimbang.', C.moss3, 2);
    this.checkBalance();
  }
  private checkBalance(): void {
    const { a, b, c, d } = this.bal;
    let x: number | null = null;
    if (a === 1 && b === 0 && c === 0) x = d;
    else if (c === 1 && d === 0 && a === 0) x = b;
    if (x === null) return;
    this.attempts = Math.max(1, this.attempts);
    const r = verifyAnswer(this.o.cand, { x: q(x) });
    if (r.ok) this.win();
  }
  private submit(): void {
    if (this.solved || this.failEnd > 0) return;
    this.attempts++;
    const r = verifyAnswer(this.o.cand, this.vals);
    if (r.ok) this.win();
    else this.fail(r.msg ?? t('tryAgain'));
  }
  private fail(msg: string): void {
    recordMistake(this.o.cand);
    this.fails++;
    this.shake = 0.35;
    audio.sfx('bad');
    let text = msg;
    if (this.fails >= 3 && this.o.cand.misconceptions[0]) text = `${msg} Miskonsepsi umum: ${this.o.cand.misconceptions[0]}`;
    else if (this.fails === 2) text = `${msg} Coba buka petunjuk (ikon bohlam).`;
    this.say(text, C.red3, 6);
    if (this.o.oneShot) {
      this.failEnd = 1.5;
      this.say('Jawaban salah! Guardian membalas.', C.red3, 3);
    }
  }
  private win(): void {
    this.solved = true;
    const stars = starsFor(this.o.cand, this.attempts, this.hintLevel, this.steps);
    this.res = { stars, attempts: Math.max(1, this.attempts), hints: this.hintLevel, steps: this.steps, seconds: Math.round(this.elapsed), success: true };
    this.shards = recordSuccess(this.o.cand, this.res, !!this.o.practice);
    audio.sfx('ok');
    this.revealT = 0;
    this.say(t('correct'), C.moss3, 99);
  }
  private finish(): void {
    if (this.ended || !this.res) return;
    this.ended = true;
    this.o.onDone(this.res);
  }
  private tiltDemo(side: 'L' | 'R', kind: 'x' | 'u', neg: boolean): void {
    if (this.tiltT > 0 || this.solved) return;
    const xv = this.o.cand.solution ? toNumber(this.o.cand.solution.x ?? q(1)) : 1;
    const val = (kind === 'x' ? xv : 1) * (neg ? -1 : 1);
    // mengurangi val dari sisi `side` → sisi itu lebih ringan bila val>0
    const lighter = val > 0 ? side : side === 'L' ? 'R' : 'L';
    this.tilt = lighter === 'L' ? 1 : -1; // 1 = kanan berat, -1 = kiri berat
    this.tiltT = 1.4;
    audio.sfx('bad');
    this.say('Timbangan miring! Lakukan hal yang SAMA di kedua sisi.', C.gold3, 3);
  }

  /* ---------- Scene ---------- */
  enter(): void {
    audio.setMood(this.o.tier, 1);
  }
  update(dt: number): void {
    this.ui.update(dt);
    if (!this.solved) this.elapsed += dt;
    else this.revealT += dt;
    if (this.fb.t > 0 && !this.solved) this.fb.t -= dt;
    this.shake = Math.max(0, this.shake - dt);
    if (this.failEnd > 0) {
      this.failEnd -= dt;
      if (this.failEnd <= 0 && !this.ended) {
        this.ended = true;
        this.o.onDone({ stars: 0, attempts: Math.max(1, this.attempts), hints: this.hintLevel, steps: this.steps, seconds: Math.round(this.elapsed), success: false });
      }
    }
    this.tiltT = Math.max(0, this.tiltT - dt);
    this.spot = Math.max(0, this.spot - dt);
    if (this.o.timer && !this.solved && !this.ended && this.elapsed >= this.o.timer) {
      this.ended = true;
      this.o.onDone({ stars: 0, attempts: Math.max(1, this.attempts), hints: this.hintLevel, steps: this.steps, seconds: Math.round(this.elapsed), success: false });
    }
    const dv = this.isBalance;
    this.opBtns.forEach((b) => (b.enabled = !this.solved));
    this.termBtns.forEach((b) => {
      b.visible = dv && this.op !== 'div';
      b.enabled = !this.solved;
    });
    if (this.btnSubmit) this.btnSubmit.enabled = !this.solved && this.failEnd <= 0;
    this.btnDone.visible = this.solved && this.revealT > 0.7;
  }
  private vctx(t0: number): VCtx {
    return { c: this.o.cand, vals: this.vals, t: t0, spot: this.spot > 0, solved: this.solved };
  }
  draw(g: Gfx): void {
    const c = this.o.cand;
    drawBg(g, this.o.tier, false, 0.52, 0.8);
    const sx = this.shake > 0 ? Math.round(Math.sin(this.shake * 80) * 2) : 0;
    g.ctx.save();
    g.ctx.translate(sx, 0);
    // HUD
    g.nine('floor_badge', 2, 1, 40, 16);
    g.text(this.o.badge, 22, 5, { size: 8, align: 'center', color: C.gold3 });
    if (this.o.progress) g.text(this.o.progress, 4, 19, { size: 6, color: C.stone3, shadow: null });
    const prompt = tb(c.prompt);
    let size = 8;
    let lines = g.wrap(prompt, 158, size);
    if (lines.length > 2) {
      size = 6;
      lines = g.wrap(prompt, 158, size);
    }
    lines.slice(0, 2).forEach((l, i) => g.text(l, 46, 2 + i * (size + 1), { size, color: C.cream3 }));
    if (this.o.timer) {
      const left = Math.max(0, Math.ceil(this.o.timer - this.elapsed));
      g.text(`${left}s`, 226, 19, { size: 8, color: left < 10 ? C.red3 : C.cyan3 });
    }
    if (this.isBalance) this.drawBalance(g);
    else VIEWS[c.kind]?.(g, this.vctx(app.time));
    g.ctx.restore();
    // pita umpan balik
    if (this.fb.text) {
      const lines2 = g.wrap(this.fb.text, 310, 6);
      g.rect(0, 119, W, 11, C.ind0, 0.85);
      g.text(lines2[0], 160, 121, { size: 6, align: 'center', color: this.fb.color, shadow: null });
      if (lines2[1]) g.text(lines2[1], 160, 126, { size: 6, align: 'center', color: this.fb.color, shadow: null });
    }
    // panel kontrol
    panel(g, 0, 130, W, 50);
    this.drawControls(g);
    this.ui.draw(g);
    if (this.spot > 0) {
      g.frame(0, 18, W, 100, C.gold2, 0.4 + 0.4 * Math.sin(app.time * 8));
      if (this.btnSubmit && !this.isBalance) g.frame(this.btnSubmit.x - 1, this.btnSubmit.y - 1, this.btnSubmit.w + 2, this.btnSubmit.h + 2, C.gold2, 0.8);
    }
    if (this.fails >= 2 && !this.solved && Math.floor(app.time * 2) % 2 === 0) g.frame(this.btnHint.x - 1, this.btnHint.y - 1, 19, 19, C.gold2);
    if (this.solved) this.drawSolved(g);
  }

  private drawControls(g: Gfx): void {
    if (this.isBalance) {
      const labels = ['sub', 'add', 'div'];
      this.opBtns.forEach((b, i) => {
        if (labels[i] === this.op) g.frame(b.x - 1, b.y - 1, b.w + 2, b.h + 2, C.gold2);
      });
      this.termBtns.forEach((b, i) => {
        if (b.visible && (i === 0 ? 'unit' : 'x') === this.term) g.frame(b.x - 1, b.y - 1, b.w + 2, b.h + 2, C.gold2);
      });
      g.nine('name_plate', 22, 153, 46, 20);
      g.text(this.op === 'div' ? `÷${this.amt}` : `${this.amt}${this.term === 'x' ? 'x' : ''}`, 45, 158, { size: 10, align: 'center', color: C.gold3 });
      const verb = this.op === 'sub' ? 'Kurangi' : this.op === 'add' ? 'Tambah' : 'Bagi';
      const what = this.op === 'div' ? `dengan ${this.amt}` : `dengan ${this.amt}${this.term === 'x' ? 'x' : ''}`;
      g.text(`${verb} kedua ruas`, 92, 154, { size: 8, color: C.cream3 });
      g.text(what, 92, 164, { size: 8, color: C.cyan3 });
      return;
    }
    for (const bx of this.boxes) {
      const v = this.vals[bx.k.id];
      g.nine('name_plate', bx.x, bx.y, bx.w, bx.h);
      const txt = bx.k.choices ? (bx.k.choices[Math.round(toNumber(v))] ?? '') : fmtQ(v);
      if (bx.inside) g.text(`${bx.k.label} ${txt}`, bx.x + bx.w / 2, bx.y + bx.h / 2 - 5, { size: 8, align: 'center', color: C.gold3 });
      else {
        g.text(bx.k.label, bx.x + bx.w / 2, bx.y - 7, { size: 6, align: 'center', color: C.blue3, shadow: null });
        g.text(txt, bx.x + bx.w / 2, bx.y + 5, { size: 8, align: 'center', color: C.gold3 });
      }
      if (this.spot > 0) g.frame(bx.x - 15, bx.y - 1, bx.w + 30, bx.h + 2, C.gold2, 0.6);
    }
  }

  private drawPile(g: Gfx, x0: number, y0: number, a: number, b: number, side: 'L' | 'R'): void {
    const simple = !!this.o.cand.data.simple;
    const groups: Array<{ n: number; frame: string; kind: 'x' | 'u'; neg: boolean }> = [];
    if (a !== 0) groups.push({ n: Math.abs(a), frame: simple ? (this.solved ? 'mystery_box_open' : 'mystery_box_closed') : a < 0 ? 'negx_normal' : 'x_normal', kind: 'x', neg: a < 0 });
    if (b !== 0) groups.push({ n: Math.abs(b), frame: b < 0 ? 'neg1_normal' : 'unit_normal', kind: 'u', neg: b < 0 });
    let col = 0;
    let row = 0;
    const place = (frame: string, kind: 'x' | 'u', neg: boolean, label?: string): void => {
      if (col >= 6) {
        col = 0;
        row++;
      }
      const x = x0 + col * 17;
      const y = y0 + row * 16 + Math.sin(app.time * 2 + col + row) * 0.6;
      g.spr('crystals', frame, x, y);
      this.hits.push({ x, y, side, kind, neg });
      if (label) g.text(label, x + 17, y + 4, { size: 8, color: C.gold3 });
      col += label ? 2 : 1;
    };
    for (const grp of groups) {
      if (grp.n > 9) place(grp.frame, grp.kind, grp.neg, `×${grp.n}`);
      else for (let i = 0; i < grp.n; i++) place(grp.frame, grp.kind, grp.neg);
      if (col > 0 && grp.kind === 'x') {
        col = 0;
        row++;
      }
    }
    if (groups.length === 0) g.text('0', x0 + 40, y0 + 20, { size: 12, color: C.stone3 });
  }
  private drawBalance(g: Gfx): void {
    this.hits = [];
    g.rect(6, 22, 104, 70, C.ind0, 0.55);
    g.rect(210, 22, 104, 70, C.ind0, 0.55);
    g.frame(6, 22, 104, 70, C.ind2, 0.6);
    g.frame(210, 22, 104, 70, C.ind2, 0.6);
    const frame = this.tiltT > 0 ? (this.tilt > 0 ? 'right_heavy' : 'left_heavy') : 'balanced';
    g.spr('balance_scale', frame, 112, 24);
    this.drawPile(g, 10, 26, this.bal.a, this.bal.b, 'L');
    this.drawPile(g, 214, 26, this.bal.c, this.bal.d, 'R');
    const { a, b, c, d } = this.bal;
    g.math(`${fmtTerms([[a, 'x'], [b, '']])} = ${fmtTerms([[c, 'x'], [d, '']])}`, 160, 98, { size: 10, align: 'center', color: C.gold3 });
    g.text(this.o.cand.data.simple ? 'Kotak misteri = x' : 'Kristal emas = x   Kristal biru = 1', 160, 110, { size: 6, align: 'center', color: C.stone3, shadow: null });
    if (this.spot > 0) {
      const n = this.nextOp();
      if (n) g.frame(n.term === 'x' ? 168 : 4, 131, n.op === 'div' ? 160 : 70, 20, C.gold2, 0.8);
    }
  }
  private drawSolved(g: Gfx): void {
    g.rect(0, 18, W, 112, C.void0, 0.55);
    panel(g, 70, 28, 180, 98);
    sparkle(g, app.time, 24, 70, 28, 180, 98);
    g.text(t('correct'), 160, 36, { size: 8, align: 'center', color: C.moss3 });
    const r = this.res;
    if (!r) return;
    const shown = Math.min(r.stars, Math.floor(this.revealT / 0.3));
    drawStars(g, shown, 160 - 27, 52, 3);
    if (shown > 0 && Math.floor(this.revealT / 0.3) === shown && this.revealT % 0.3 < 0.02) audio.sfx('star');
    g.text(`Percobaan ${r.attempts}  Hint ${r.hints}${this.isBalance ? `  Langkah ${r.steps}` : ''}`, 160, 76, { size: 6, align: 'center', color: C.cream3, shadow: null });
    g.text(`+${this.shards} Arcane Shard`, 160, 88, { size: 8, align: 'center', color: C.gold3 });
    this.btnDone.draw(g);
  }

  /* ---------- Input ---------- */
  down(x: number, y: number): void {
    if (this.solved) {
      if (this.btnDone.hit(x, y)) this.finish();
      return;
    }
    if (this.ui.down(x, y)) return;
    for (const bx of this.boxes) {
      if (!bx.k.choices && x >= bx.x && x < bx.x + bx.w && y >= bx.y && y < bx.y + bx.h) {
        app.push(
          new NumpadScene(bx.k.label, this.vals[bx.k.id], (v) => {
            if (!v) return;
            const lo = nq(bx.k.min);
            const hi = nq(bx.k.max);
            this.setVal({ [bx.k.id]: cmp(v, lo) < 0 ? lo : cmp(v, hi) > 0 ? hi : v });
          }),
          false,
        );
        return;
      }
    }
    if (this.isBalance) {
      for (const h of this.hits) if (x >= h.x && x < h.x + 16 && y >= h.y && y < h.y + 16) return this.tiltDemo(h.side, h.kind, h.neg);
      return;
    }
    if (y >= AREA.y && y < AREA.y + AREA.h) {
      const patch = tapView(this.vctx(app.time), x, y);
      if (patch) {
        this.dragging = false;
        this.setVal(patch);
        this.dragging = true;
        audio.sfx('tap');
      }
    }
  }
  move(x: number, y: number): void {
    this.ui.move(x, y);
    if (this.dragging && !this.solved) {
      const patch = tapView(this.vctx(app.time), x, y);
      if (patch) this.vals = { ...this.vals, ...patch };
    }
  }
  up(x: number, y: number): void {
    this.dragging = false;
    this.ui.up(x, y);
  }
  back(): boolean {
    app.push(new PauseScene(this.o.cand, () => (this.o.onQuit ?? (() => app.reset(nav.title())))()), false);
    return true;
  }
}

export { save };
