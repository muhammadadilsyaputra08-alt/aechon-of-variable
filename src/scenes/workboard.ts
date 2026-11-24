/** Mathematical Workboard: Question Panel · Work Area · Answer Panel dengan validasi langkah matematis. */
import { C, Gfx, W } from '../engine/gfx';
import { app, Button, Scene, UI } from '../engine/core';
import { audio } from '../engine/audio';
import { t, tb } from '../engine/i18n';
import { nav } from '../engine/nav';
import { PuzzleResult, recordHint, recordMistake, recordSuccess } from '../engine/progress';
import { WbQuestion } from '../learn/wbgen';
import { Verdict, checkLine, VerdictLevel } from '../learn/stepcheck';
import { parseExpr, pEq } from '../math/poly';
import { rootOf } from '../learn/wbgen';
import { drawBg, drawStars, panel, sparkle } from './common';
import { HintScene, PauseScene } from './modals';

export interface WbResult extends PuzzleResult {
  /** kategori kesalahan yang muncul (sign/operation/concept/syntax) untuk Weakness Training */
  tags: string[];
}
export interface WbOpts {
  /** null = papan coret bebas (tanpa soal) */
  q: WbQuestion | null;
  tier: number;
  badge: string;
  progress?: string;
  practice?: boolean;
  /** Satu kesempatan jawaban akhir (Boss Battle). */
  oneShot?: boolean;
  onDone: (r: WbResult) => void;
  onQuit?: () => void;
}
interface Row {
  text: string;
  level: VerdictLevel;
}

const KEYS: string[][] = [
  ['7', '8', '9', '+', '-', '(', ')', 'x', '^', 'y'],
  ['4', '5', '6', '×', '/', '=', '.', '²', '<', '>'],
  ['1', '2', '3', '0', ',', '_', 'LAST', 'DEL', 'CLR', 'z'],
];
const LEVEL_COLOR: Record<VerdictLevel, string> = {
  final: C.moss3, valid: C.cyan3, unsimplified: C.gold3, unfactored: C.gold3, sign: C.red3, operation: C.red3, concept: C.red3, syntax: C.stone3,
};
const TERM_COLORS = [C.gold2, C.cyan2, C.mag2, C.moss2, C.vio3];

/** Menggambar baris dengan suku sejenis diberi warna sama (Highlight Terms). */
function drawColored(g: Gfx, s: string, x: number, y: number, size: number, hl: boolean): void {
  if (!hl) return g.math(s, x, y, { size, color: C.cream3 });
  const keyColor = new Map<string, string>();
  let cx = x;
  for (const part of s.split(/(\d*[a-z](?:\^\d+)?)/g)) {
    if (!part) continue;
    const m = /^(\d*)([a-z](?:\^\d+)?)$/.exec(part);
    let color: string = C.cream3;
    if (m) {
      if (!keyColor.has(m[2])) keyColor.set(m[2], TERM_COLORS[keyColor.size % TERM_COLORS.length]);
      color = keyColor.get(m[2]) as string;
    }
    g.math(part, cx, y, { size, color });
    cx += g.mathWidth(part, size);
  }
}

export class WorkboardScene implements Scene {
  ambient = true;
  private ui = new UI();
  private rows: Row[] = [];
  private redo: Row[] = [];
  private input = '';
  private attempts = 0;
  private hintLevel = 0;
  private stepErrors = 0;
  private tags: string[] = [];
  private elapsed = 0;
  private solved = false;
  private ended = false;
  private failEnd = 0;
  private res: WbResult | null = null;
  private shards = 0;
  private revealT = 0;
  private shake = 0;
  private hl = true;
  private fb = { text: '', color: C.cream3 as string, t: 0 };
  private btnDone: Button;
  private btnStep!: Button;
  private btnAns!: Button;
  private btnHint!: Button;

  constructor(private o: WbOpts) {
    this.btnDone = new Button(120, 105, 80, 18, o.practice ? t('ok') : t('next'), () => this.finish());
    this.buildHud();
    this.buildKeys();
    if (!o.q) this.say('Papan coret bebas: tiap baris diperiksa setara dengan baris sebelumnya.', C.stone3, 5);
  }

  /* ---------- UI ---------- */
  private buildHud(): void {
    const icons: Array<[string, string, () => void]> = [
      ['icon_hint', '', () => this.openHint()],
      ['icon_undo', '', () => this.undo()],
      ['', '>', () => this.redoStep()],
      ['icon_pause', '', () => app.push(new PauseScene(this.o.q ? { topic: this.o.q.topic } : null, () => (this.o.onQuit ?? (() => app.reset(nav.title())))()), false)],
    ];
    icons.forEach(([ic, lab, fn], i) => {
      const b = this.ui.add(new Button(320 - (4 - i) * 18 - 1, 1, 17, 17, lab, fn, ic ? { icon: ic } : {}));
      if (i === 0) {
        this.btnHint = b;
        b.visible = !!this.o.q;
      }
    });
    this.ui.add(new Button(296, 38, 20, 11, 'HL', () => (this.hl = !this.hl), { size: 6 }));
  }
  private buildKeys(): void {
    const x0 = 4;
    const y0 = 125;
    const cw = 24;
    const stride = 25.6;
    const kind = this.o.q?.kind;
    // Tombol kontekstual: soal akar → √ ; soal matriks → [ ]
    const swap: Record<string, string> = kind === 'rad' ? { z: '√' } : kind === 'matrix' ? { '<': '[', '>': ']' } : {};
    KEYS.forEach((row, r) =>
      row.forEach((kk, c) => {
        const k = swap[kk] ?? kk;
        const label = k === '_' ? 'spasi' : k === 'LAST' ? 'ulang' : k === 'DEL' ? '<' : k;
        this.ui.add(new Button(Math.round(x0 + c * stride), y0 + r * 17, cw, 16, label, () => this.press(k), { size: label.length > 2 ? 6 : 8, repeat: k === 'DEL' }));
      }),
    );
    this.btnStep = this.ui.add(new Button(262, 125, 54, 16, 'LANGKAH', () => this.addStep(), { size: 6 }));
    this.btnAns = this.ui.add(new Button(262, 142, 54, 16, 'JAWAB', () => this.answer(), { size: 8 }));
    this.btnAns.visible = !!this.o.q;
    this.ui.add(new Button(262, 159, 54, 16, 'RUMUS', () => this.o.q && app.push(nav.codex(this.o.q.topic), false), { size: 6 }));
  }

  /* ---------- Aksi ---------- */
  private say(text: string, color: string = C.cream3, secs = 4): void {
    this.fb = { text, color, t: secs };
  }
  private press(k: string): void {
    if (this.solved || this.failEnd > 0) return;
    if (k === 'DEL') this.input = this.input.slice(0, -1);
    else if (k === 'CLR') this.input = '';
    else if (k === 'LAST') this.input = this.rows.length ? this.rows[this.rows.length - 1].text : (this.o.q?.expr ?? '');
    else if (this.input.length < 64) this.input += k === '_' ? ' ' : k;
    audio.sfx('tap');
  }
  key(k: string): void {
    if (this.solved) return;
    if (k === 'Backspace') return this.press('DEL');
    if (k === 'Enter') return this.addStep();
    if (k.length === 1 && /[0-9a-z+\-*/^()=. ×²³,<>√[\]]/i.test(k)) this.press(k === ' ' ? '_' : k.toLowerCase());
  }
  private undo(): void {
    if (this.solved || this.failEnd > 0) return;
    if (this.input) this.input = '';
    else {
      const r = this.rows.pop();
      if (r) this.redo.push(r);
    }
  }
  private redoStep(): void {
    if (this.solved || this.failEnd > 0) return;
    const r = this.redo.pop();
    if (r) this.rows.push(r);
  }
  private openHint(): void {
    const q = this.o.q;
    if (!q || this.solved || this.failEnd > 0) return;
    app.push(
      new HintScene(
        q,
        this.hintLevel,
        (lv) => {
          if (lv > this.hintLevel) {
            this.hintLevel = lv;
            recordHint(q);
          }
        },
        () => {
          this.input = q.steps[Math.min(this.rows.length, q.steps.length - 1)] ?? '';
          app.pop(false);
          this.say('Langkah terbimbing diisi. Tekan LANGKAH untuk memeriksa.', C.cyan3, 4);
        },
      ),
      false,
    );
  }
  private freeCheck(line: string): Verdict {
    try {
      const prev = this.rows.length ? this.rows[this.rows.length - 1].text : null;
      if (!prev) return { level: 'valid', accept: true, final: false, msg: 'Baris pertama dicatat.' };
      const same = prev.includes('=') || line.includes('=') ? rootOf(prev) === rootOf(line) && rootOf(line) !== null : pEq(parseExpr(prev), parseExpr(line));
      return same ? { level: 'valid', accept: true, final: false, msg: 'Setara dengan baris sebelumnya.' } : { level: 'concept', accept: false, final: false, msg: 'Baris ini tidak setara dengan baris sebelumnya.' };
    } catch {
      return { level: 'syntax', accept: false, final: false, msg: 'Bentuk tulisan tidak dikenali.' };
    }
  }
  private note(v: Verdict): void {
    if (v.level === 'sign' || v.level === 'operation' || v.level === 'concept' || v.level === 'syntax') this.tags.push(v.level);
  }
  private addStep(): void {
    if (this.solved || this.failEnd > 0) return;
    const line = this.input.trim();
    if (!line) return this.say('Tulis langkah pengerjaan dengan keypad.', C.stone3, 2);
    const q = this.o.q;
    const v = q ? checkLine(q, line, false) : this.freeCheck(line);
    if (v.accept) {
      this.rows.push({ text: line, level: v.level });
      this.redo = [];
      this.input = '';
      audio.sfx('move');
      this.say(v.final && q ? `${v.msg} Tekan JAWAB untuk menyelesaikan.` : v.msg, LEVEL_COLOR[v.level], 4);
    } else {
      this.stepErrors++;
      this.shake = 0.3;
      audio.sfx('bad');
      this.note(v);
      if (q) recordMistake(q);
      this.say(v.msg, C.red3, 6);
    }
  }
  private answer(): void {
    const q = this.o.q;
    if (!q || this.solved || this.failEnd > 0) return;
    const line = (this.input.trim() || (this.rows.length ? this.rows[this.rows.length - 1].text : '')).trim();
    if (!line) return this.say('Isi jawaban akhir lebih dulu.', C.stone3, 2);
    this.attempts++;
    const v = checkLine(q, line, true);
    if (v.final) {
      if (this.input.trim()) this.rows.push({ text: line, level: 'final' });
      this.input = '';
      return this.win();
    }
    this.note(v);
    recordMistake(q);
    this.shake = 0.35;
    audio.sfx('bad');
    if (this.o.oneShot) {
      this.failEnd = 1.5;
      this.say(`${v.msg} Jawaban final salah.`, C.red3, 3);
    } else {
      if (v.accept && this.input.trim()) {
        this.rows.push({ text: line, level: v.level });
        this.input = '';
      }
      this.say(v.msg, v.accept ? C.gold3 : C.red3, 6);
    }
  }
  private win(): void {
    const q = this.o.q as WbQuestion;
    this.solved = true;
    const clean = this.attempts === 1 && this.hintLevel === 0;
    const stars = clean && this.stepErrors === 0 ? 3 : this.attempts <= 2 && this.hintLevel <= 2 ? 2 : 1;
    this.res = { stars, attempts: Math.max(1, this.attempts), hints: this.hintLevel, steps: this.rows.length, seconds: Math.round(this.elapsed), success: true, tags: this.tags };
    this.shards = recordSuccess({ topic: q.topic, kind: 'workboard' }, this.res, !!this.o.practice);
    audio.sfx('ok');
    this.revealT = 0;
    this.say(t('correct'), C.moss3, 99);
  }
  private finish(): void {
    if (this.ended || !this.res) return;
    this.ended = true;
    this.o.onDone(this.res);
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
        this.o.onDone({ stars: 0, attempts: this.attempts, hints: this.hintLevel, steps: this.rows.length, seconds: Math.round(this.elapsed), success: false, tags: this.tags });
      }
    }
    const locked = this.solved || this.failEnd > 0;
    this.btnStep.enabled = !locked;
    this.btnAns.enabled = !locked;
    this.btnDone.visible = this.solved && this.revealT > 0.7;
  }
  draw(g: Gfx): void {
    const q = this.o.q;
    drawBg(g, this.o.tier, false, 0.6, 0.8);
    const sx = this.shake > 0 ? Math.round(Math.sin(this.shake * 80) * 2) : 0;
    g.ctx.save();
    g.ctx.translate(sx, 0);
    // Question Panel
    g.nine('floor_badge', 2, 1, 40, 16);
    g.text(this.o.badge, 22, 5, { size: 8, align: 'center', color: C.gold3 });
    if (this.o.progress) g.text(this.o.progress, 46, 2, { size: 6, color: C.stone3, shadow: null });
    g.text(q ? tb(q.prompt) : 'Papan coret', 46, 9, { size: 6, color: C.cyan3, shadow: null });
    panel(g, 2, 19, 316, 18);
    const envS = Object.entries(q?.env ?? {}).map(([k, v]) => `${k} = ${v}`).join(', ');
    const shown = q ? (q.kind === 'value' && envS ? `${q.expr}   ,  ${envS}` : q.expr) : 'Tulis ekspresi atau persamaanmu sendiri';
    g.math(shown, 160, 24, { size: g.mathWidth(shown, 10) > 296 ? 8 : 10, align: 'center', color: C.gold3 });
    // Work Area
    g.rect(2, 38, 316, 62, C.ind0, 0.75);
    g.frame(2, 38, 316, 62, C.ind2, 0.6);
    g.text('WORK AREA', 6, 40, { size: 6, color: C.blue3, shadow: null });
    const vis = this.rows.slice(-5);
    const off = this.rows.length - vis.length;
    vis.forEach((r, i) => {
      const y = 48 + i * 10;
      g.text(`${off + i + 1}`, 8, y, { size: 8, color: C.stone3, shadow: null });
      drawColored(g, r.text, 20, y, 8, this.hl);
      g.text(r.level === 'final' ? '✓' : r.level === 'valid' ? '·' : '~', 312, y, { size: 8, align: 'right', color: LEVEL_COLOR[r.level], shadow: null });
    });
    if (!this.rows.length) g.text('Tuliskan langkahmu satu per satu.', 160, 66, { size: 6, align: 'center', color: C.stone2, shadow: null });
    // Answer / input line
    g.nine('name_plate', 2, 101, 256, 13);
    const cursor = !this.solved && Math.floor(app.time * 2) % 2 === 0 ? '|' : '';
    g.math(`${this.input}${cursor}` || cursor, 7, 104, { size: 8, color: C.cyan3 });
    if (!this.input && !cursor) g.text('ketik langkah...', 7, 105, { size: 6, color: C.stone2, shadow: null });
    g.ctx.restore();
    // umpan balik
    if (this.fb.text && this.fb.t > 0) {
      const lines = g.wrap(this.fb.text, 312, 6);
      g.rect(0, 114, W, 10, C.ind0, 0.9);
      g.text(lines[0], 160, 116, { size: 6, align: 'center', color: this.fb.color, shadow: null });
    }
    panel(g, 0, 123, W, 57);
    this.ui.draw(g);
    if (this.hl) g.frame(295, 37, 22, 13, C.gold2, 0.8);
    if (this.stepErrors + this.attempts >= 3 && !this.solved && q && Math.floor(app.time * 2) % 2 === 0) g.frame(this.btnHint.x - 1, this.btnHint.y - 1, 19, 19, C.gold2);
    if (this.solved) this.drawSolved(g);
    else if (this.failEnd > 0) {
      g.rect(0, 38, W, 62, C.red1, 0.35);
      g.text('Jawaban belum tepat!', 160, 66, { size: 10, align: 'center', color: C.red3 });
    }
  }
  private drawSolved(g: Gfx): void {
    g.rect(0, 18, W, 105, C.void0, 0.55);
    panel(g, 70, 28, 180, 98);
    sparkle(g, app.time, 24, 70, 28, 180, 98);
    g.text(t('correct'), 160, 36, { size: 8, align: 'center', color: C.moss3 });
    const r = this.res;
    if (!r) return;
    const shown = Math.min(r.stars, Math.floor(this.revealT / 0.3));
    drawStars(g, shown, 160 - 27, 52, 3);
    g.text(`Percobaan ${r.attempts}  Hint ${r.hints}  Langkah ${r.steps}`, 160, 76, { size: 6, align: 'center', color: C.cream3, shadow: null });
    g.text(`+${this.shards} Arcane Shard`, 160, 88, { size: 8, align: 'center', color: C.gold3 });
    this.btnDone.draw(g);
  }

  down(x: number, y: number): void {
    if (this.solved) {
      if (this.btnDone.hit(x, y)) this.finish();
      return;
    }
    this.ui.down(x, y);
  }
  move(x: number, y: number): void { this.ui.move(x, y); }
  up(x: number, y: number): void { this.ui.up(x, y); }
  back(): boolean {
    app.push(new PauseScene(this.o.q ? { topic: this.o.q.topic } : null, () => (this.o.onQuit ?? (() => app.reset(nav.title())))()), false);
    return true;
  }
}
