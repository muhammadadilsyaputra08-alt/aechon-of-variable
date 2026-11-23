/** Visualisasi puzzle per jenis soal. Semua diagram dihitung dari Math Engine, bukan ditempel. */
import { C, Gfx } from '../engine/gfx';
import { Candidate } from '../archivist/types';
import { Q, ZERO, q, add, sub, mul, toNumber, fmtQ, eq, div, isZero } from '../math/rational';
import { parseExpr, parseRelation, pEval, pFormat, pAdd, pMul, pConst, pVar, pCoeff } from '../math/poly';
import { applyMat, mat, det, cMul, cAdd, cSub, cDiv, cConj, fmtC, C as Cx, matMul, matAdd, matT, matScale } from '../math/solve';
import { linearForm } from '../archivist/kinds';
import { panel } from './common';

export interface VCtx {
  c: Candidate;
  vals: Record<string, Q>;
  t: number;
  spot: boolean;
  solved: boolean;
}
export const AREA = { x: 0, y: 18, w: 320, h: 102 };
const n = (v: VCtx, id: string): number => toNumber(v.vals[id] ?? ZERO);
const d = <T,>(v: VCtx): T => v.c.data as unknown as T;

/* ---------- Plot ---------- */
export class Plot {
  constructor(public cx: number, public cy: number, public s: number, public w: number, public h: number) {}
  X = (x: number): number => this.cx + x * this.s;
  Y = (y: number): number => this.cy - y * this.s;
  inv(px: number, py: number): [number, number] {
    return [(px - this.cx) / this.s, (this.cy - py) / this.s];
  }
  get l(): number { return this.cx - this.w / 2; }
  get r(): number { return this.cx + this.w / 2; }
  get t(): number { return this.cy - this.h / 2; }
  get b(): number { return this.cy + this.h / 2; }
  clip(g: Gfx, fn: () => void): void {
    g.ctx.save();
    g.ctx.beginPath();
    g.ctx.rect(this.l, this.t, this.w, this.h);
    g.ctx.clip();
    fn();
    g.ctx.restore();
  }
  grid(g: Gfx, labels = true): void {
    g.rect(this.l, this.t, this.w, this.h, C.ind0, 0.85);
    this.clip(g, () => {
      const step = this.s >= 7 ? 1 : 2;
      for (let x = -40; x <= 40; x += step) g.rect(this.X(x), this.t, 1, this.h, x === 0 ? C.ind3 : C.ind1, x === 0 ? 0.9 : 0.55);
      for (let y = -40; y <= 40; y += step) g.rect(this.l, this.Y(y), this.w, 1, y === 0 ? C.ind3 : C.ind1, y === 0 ? 0.9 : 0.55);
    });
    g.frame(this.l, this.t, this.w, this.h, C.ind2);
    if (labels) {
      g.text('x', this.r - 6, this.Y(0) + 1, { size: 6, color: C.ind3, shadow: null });
      g.text('y', this.X(0) + 2, this.t + 1, { size: 6, color: C.ind3, shadow: null });
    }
  }
  fn(g: Gfx, f: (x: number) => number | null, color: string, w = 1.5): void {
    this.clip(g, () => {
      let prev: [number, number] | null = null;
      const x0 = (this.l - this.cx) / this.s;
      const x1 = (this.r - this.cx) / this.s;
      for (let x = x0; x <= x1; x += 0.25) {
        const y = f(x);
        if (y === null || !Number.isFinite(y) || Math.abs(y) > 60) {
          prev = null;
          continue;
        }
        const p: [number, number] = [this.X(x), this.Y(y)];
        if (prev) g.line(prev[0], prev[1], p[0], p[1], color, w);
        prev = p;
      }
    });
  }
  lineABC(g: Gfx, a: number, b: number, cc: number, color: string): void {
    // a x + b y = cc
    this.clip(g, () => {
      if (b !== 0) {
        const x0 = (this.l - this.cx) / this.s;
        const x1 = (this.r - this.cx) / this.s;
        g.line(this.X(x0), this.Y((cc - a * x0) / b), this.X(x1), this.Y((cc - a * x1) / b), color, 1.5);
      } else g.line(this.X(cc / a), this.t, this.X(cc / a), this.b, color, 1.5);
    });
  }
  dot(g: Gfx, x: number, y: number, color: string, r = 2): void {
    g.disc(this.X(x), this.Y(y), r, color);
  }
  arrow(g: Gfx, x1: number, y1: number, x2: number, y2: number, color: string): void {
    const [ax, ay, bx, by] = [this.X(x1), this.Y(y1), this.X(x2), this.Y(y2)];
    g.line(ax, ay, bx, by, color, 1.5);
    const ang = Math.atan2(by - ay, bx - ax);
    g.poly([[bx, by], [bx - 5 * Math.cos(ang - 0.4), by - 5 * Math.sin(ang - 0.4)], [bx - 5 * Math.cos(ang + 0.4), by - 5 * Math.sin(ang + 0.4)]], color, null);
  }
}
export const autoScale = (maxAbs: number, half = 48): number => Math.max(3, Math.min(12, Math.floor(half / Math.max(2, maxAbs + 0.5))));
const mkPlot = (maxAbs: number, w = 182): Plot => new Plot(160 + 20, 18 + 51, autoScale(maxAbs), w, 100);
const marker = (g: Gfx, frame: string, x: number, y: number, a = 0.9): void => g.spr('puzzle_objects', frame, x, y, { pivot: true, a });

function sidePanel(g: Gfx, c: Candidate, lines?: string[]): void {
  panel(g, 2, 20, 68, 98);
  let y = 25;
  for (const l of lines ?? c.display) {
    for (const row of g.wrap(l, 58, 8)) {
      g.math(row, 7, y, { size: 8, color: C.cream3 });
      y += 10;
    }
    y += 3;
  }
}
function bigFormula(g: Gen, c: Candidate, y = 34, size = 12): void {
  let yy = y;
  for (const line of c.display) {
    g.math(line, 160, yy, { size, align: 'center', color: C.gold3 });
    yy += size + 6;
  }
}
type Gen = Gfx;

const maxOf = (...xs: number[]): number => xs.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
const flat = (a: number[][]): number[] => a.reduce<number[]>((s, r) => s.concat(r), []);
const mtx = (M: number[][]): Q[][] => mat(M);

export function drawMatrix(g: Gfx, M: (string | number)[][], cx: number, y: number, size = 10, color: string = C.cream3, label?: string): number {
  const cw = size * 2.4;
  const rowsN = M.length;
  const colsN = M[0].length;
  const w = colsN * cw + 8;
  const h = rowsN * (size + 4) + 4;
  const x0 = cx - w / 2;
  const lw = label ? g.measure(label, 8) + 4 : 0;
  g.rect(x0, y, 2, h, C.gold2);
  g.rect(x0, y, 4, 1, C.gold2);
  g.rect(x0, y + h - 1, 4, 1, C.gold2);
  g.rect(x0 + w - 2, y, 2, h, C.gold2);
  g.rect(x0 + w - 4, y, 4, 1, C.gold2);
  g.rect(x0 + w - 4, y + h - 1, 4, 1, C.gold2);
  M.forEach((row, i) => row.forEach((v, j) => g.text(String(v), x0 + 4 + j * cw + cw / 2, y + 3 + i * (size + 4), { size, align: 'center', color })));
  if (label) g.text(label, x0 - lw, y + h / 2 - 4, { size: 8, color: C.stone3 });
  return w;
}

/* ---------- Views ---------- */
type View = (g: Gfx, v: VCtx) => void;

const classifyView: View = (g, v) => {
  bigFormula(g, v.c, 36, 16);
  g.text('Kenali suku, koefisien x, dan konstanta', 160, 80, { size: 8, align: 'center', color: C.blue3 });
  const k = ['terms', 'coef', 'konst'];
  k.forEach((id, i) => g.text(`${['suku', 'koef. x', 'konst.'][i]} = ${fmtQ(v.vals[id] ?? ZERO)}`, 70 + i * 90, 98, { size: 8, align: 'center', color: C.cyan3 }));
};

const simplifyView: View = (g, v) => {
  const { deg } = d<{ expr: string; deg: number }>(v);
  bigFormula(g, v.c, 30, 12);
  g.text('Jawabanmu dalam kristal:', 160, 66, { size: 8, align: 'center', color: C.blue3 });
  let x = 40;
  for (let i = deg; i >= 0; i--) {
    const cval = v.vals[`c${i}`] ?? ZERO;
    const cnt = Math.min(8, Math.abs(cval.n));
    const frame = i === 0 ? (cval.n < 0 ? 'neg1_normal' : 'unit_normal') : cval.n < 0 ? 'negx_normal' : 'x_normal';
    if (i === 2) g.text('x²:', x, 88, { size: 8, color: C.cyan3 });
    for (let k = 0; k < cnt; k++) g.spr('crystals', frame, x + (i === 2 ? 14 : 0) + k * 9, 80 + (k % 2) * 3);
    x += 100;
    void frame;
  }
  g.text(`= ${[...Array(deg + 1).keys()].reverse().map((i) => `${fmtQ(v.vals[`c${i}`] ?? ZERO)}${i === 0 ? '' : i === 1 ? 'x' : 'x^2'}`).join(' + ')}`.replace(/\+ -/g, '− '), 160, 108, { size: 8, align: 'center', color: C.gold3 });
};

const NL = { l: 18, r: 302, min: -12, max: 12 };
const nlX = (x: number): number => NL.l + ((x - NL.min) / (NL.max - NL.min)) * (NL.r - NL.l);
function numberLine(g: Gfx, y: number): void {
  g.rect(NL.l, y, NL.r - NL.l, 2, C.stone3);
  for (let x = NL.min; x <= NL.max; x++) {
    g.rect(nlX(x), y - (x % 5 === 0 ? 4 : 2), 1, x % 5 === 0 ? 10 : 6, x === 0 ? C.gold2 : C.stone2);
    if (x % 4 === 0) g.text(String(x), nlX(x), y + 8, { size: 6, align: 'center', color: C.stone3, shadow: null });
  }
}
const ineqView: View = (g, v) => {
  bigFormula(g, v.c, 24, 12);
  const y = 76;
  const b = n(v, 'bound');
  const dir = n(v, 'dir');
  const incl = n(v, 'incl') === 1;
  const bx = nlX(Math.max(NL.min, Math.min(NL.max, b)));
  const safe = dir === 0 ? [NL.l, bx] : [bx, NL.r];
  g.rect(safe[0], y - 6, safe[1] - safe[0], 12, C.cyan2, 0.35 + 0.1 * Math.sin(v.t * 3));
  g.rect(dir === 0 ? bx : NL.l, y - 6, dir === 0 ? NL.r - bx : bx - NL.l, 12, C.red1, 0.25);
  numberLine(g, y);
  g.disc(bx, y + 1, 4, incl ? C.gold2 : C.ind0);
  g.ring(bx, y + 1, 4, C.gold3, 1);
  g.text(fmtQ(v.vals.bound ?? ZERO), bx, y - 18, { size: 8, align: 'center', color: C.gold3 });
  g.text('aman', dir === 0 ? NL.l + 18 : NL.r - 18, y - 18, { size: 6, align: 'center', color: C.cyan3 });
  g.text('Ketuk garis bilangan untuk memindahkan batas', 160, 106, { size: 6, align: 'center', color: C.stone3 });
};

const coordView: View = (g, v) => {
  const dd = d<{ mode: string; px: number; py: number; tx?: number; ty?: number }>(v);
  const p = mkPlot(Math.max(7, maxOf(dd.px, dd.py) + 2), 182);
  p.grid(g);
  sidePanel(g, v.c);
  p.dot(g, dd.px, dd.py, C.gold2, 3);
  g.text('P', p.X(dd.px) + 4, p.Y(dd.py) - 10, { size: 8, color: C.gold3 });
  if (dd.mode === 'translate') p.arrow(g, dd.px, dd.py, dd.px + (dd.tx ?? 0), dd.py + (dd.ty ?? 0), C.mag2);
  if (dd.mode === 'quadrant') {
    ['II', 'I', 'III', 'IV'].forEach((r, i) => g.text(r, p.cx + (i % 2 ? 1 : -1) * 70, p.cy + (i > 1 ? 1 : -1) * 38 - 4, { size: 8, align: 'center', color: C.ind2, shadow: null }));
  } else {
    const x = n(v, 'x');
    const y = n(v, 'y');
    marker(g, v.solved ? 'energy_node_on' : 'energy_node_off', p.X(x), p.Y(y));
    g.text(`(${fmtQ(v.vals.x ?? ZERO)}, ${fmtQ(v.vals.y ?? ZERO)})`, p.X(x), Math.max(p.t + 2, p.Y(y) - 22), { size: 6, align: 'center', color: C.cyan3 });
  }
};

const lineView: View = (g, v) => {
  const dd = d<{ mode: string; c?: number; pts: number[][] }>(v);
  const p = mkPlot(Math.max(6, maxOf(...flat(dd.pts)) + 1));
  p.grid(g);
  sidePanel(g, v.c);
  const m = n(v, 'm');
  const cc = dd.mode === 'mc' ? n(v, 'c') : dd.c ?? 0;
  if (dd.mode !== 'slope') p.fn(g, (x) => m * x + cc, C.cyan2, 2);
  else p.fn(g, (x) => m * x + (dd.pts[0][1] - m * dd.pts[0][0]), C.cyan2, 2);
  dd.pts.forEach(([x, y]) => {
    const on = Math.abs(m * x + (dd.mode === 'slope' ? dd.pts[0][1] - m * dd.pts[0][0] : cc) - y) < 1e-9;
    marker(g, 'coord_target', p.X(x), p.Y(y), on ? 1 : 0.7);
    p.dot(g, x, y, on ? C.moss3 : C.gold2, 2);
  });
  g.text(`y = ${fmtQ(v.vals.m ?? ZERO)}x + ${fmtQ(q(Math.round(cc * 2), 2))}`.replace('+ -', '− '), 180, 22, { size: 8, align: 'center', color: C.gold3 });
};

const dualView: View = (g, v) => {
  const { eqs } = d<{ eqs: string[] }>(v);
  const rows = eqs.map((s) => linearForm(parseRelation(s), ['x', 'y']));
  const p = mkPlot(8);
  p.grid(g);
  sidePanel(g, v.c);
  rows.forEach((r, i) => p.lineABC(g, toNumber(r.co[0]), toNumber(r.co[1]), toNumber(r.rhs), i === 0 ? C.cyan2 : C.mag2));
  const x = n(v, 'x');
  const y = n(v, 'y');
  marker(g, v.solved ? 'gate_on' : 'gate_off', p.X(x), p.Y(y), 0.85);
  p.dot(g, x, y, C.gold3, 2);
  g.text(`(${fmtQ(v.vals.x ?? ZERO)}, ${fmtQ(v.vals.y ?? ZERO)})`, p.X(x), Math.max(p.t + 2, p.Y(y) - 24), { size: 6, align: 'center', color: C.gold3 });
};

const factorView: View = (g, v) => {
  const { poly, lead } = d<{ poly: string; lead: number }>(v);
  g.spr('puzzle_objects', v.solved ? 'factor_machine_active' : 'factor_machine_idle', 144, 40, { s: 1 });
  g.math(poly, 160, 26, { size: 12, align: 'center', color: C.gold3 });
  const pp = v.vals.p ?? ZERO;
  const qq = v.vals.q ?? ZERO;
  const f1 = `(x ${pp.n < 0 ? '−' : '+'} ${Math.abs(pp.n / pp.d)})`;
  const f2 = `(${lead > 1 ? lead : ''}x ${qq.n < 0 ? '−' : '+'} ${Math.abs(qq.n / qq.d)})`;
  g.math(f1, 80, 56, { size: 12, align: 'center', color: C.cyan3 });
  g.math(f2, 240, 56, { size: 12, align: 'center', color: C.mag2 });
  const f1p = pAdd(pVar('x'), pConst(pp));
  const f2p = pAdd(pMul(pConst(q(lead)), pVar('x')), pConst(qq));
  g.text('hasil kali faktormu:', 160, 82, { size: 8, align: 'center', color: C.blue3 });
  g.math(pFormat(pMul(f1p, f2p)).replace(/x\^2/g, 'x^2'), 160, 94, { size: 10, align: 'center', color: C.snow2 });
};

const rootsView: View = (g, v) => {
  const { eq: e, mode } = d<{ eq: string; mode: string }>(v);
  const rel = parseRelation(e);
  const diff = pAdd(rel.lhs, pMul(rel.rhs, pConst(q(-1))));
  const [a, b, c] = [toNumber(pCoeff(diff, 'x', 2)), toNumber(pCoeff(diff, 'x', 1)), toNumber(pCoeff(diff, 'x', 0))];
  if (mode === 'disc') {
    g.math(e, 160, 30, { size: 14, align: 'center', color: C.gold3 });
    g.math(`a = ${a},  b = ${b},  c = ${c}`, 160, 60, { size: 10, align: 'center', color: C.cyan3 });
    g.math('D = b^2 − 4ac', 160, 84, { size: 10, align: 'center', color: C.snow2 });
    return;
  }
  const ext = Math.max(8, ...[1, 2].map((i) => Math.abs(n(v, `r${i}`))));
  const p = new Plot(200, 70, autoScale(Math.min(ext, 10) * 0.7), 160, 100);
  p.grid(g, false);
  sidePanel(g, v.c, [e, 'Isi dua akar.']);
  p.fn(g, (x) => a * x * x + b * x + c, C.vio3, 2);
  [1, 2].forEach((i) => {
    const r = n(v, `r${i}`);
    marker(g, v.solved ? 'energy_node_on' : 'energy_node_off', p.X(r), p.Y(0));
    const val = a * r * r + b * r + c;
    g.text(`f=${Math.round(val * 100) / 100}`, p.X(r), p.Y(0) + 12 + (i - 1) * 8, { size: 6, align: 'center', color: val === 0 ? C.moss3 : C.red3, shadow: null });
  });
};

const parabolaView: View = (g, v) => {
  const dd = d<{ pts: number[][]; fixed: Record<string, number> }>(v);
  const p = new Plot(200, 70, autoScale(9, 48), 160, 100);
  p.grid(g);
  sidePanel(g, v.c);
  const co = (k: string): number => (k in dd.fixed ? dd.fixed[k] : n(v, k));
  const f = (x: number): number => co('a') * x * x + co('b') * x + co('c');
  p.fn(g, f, C.mag2, 2);
  dd.pts.forEach(([x, y]) => {
    const on = Math.abs(f(x) - y) < 1e-9;
    marker(g, 'ring_target', p.X(x), p.Y(y), on ? 1 : 0.7);
    p.dot(g, x, y, on ? C.moss3 : C.gold2, 1.5);
  });
};

const reactorView: View = (g, v) => {
  const dd = d<{ expr: string; base: number }>(v);
  g.spr('puzzle_objects', v.solved ? 'exponent_reactor_on' : 'exponent_reactor_off', 64, 28);
  g.spr('puzzle_objects', v.solved ? 'exponent_reactor_on' : 'exponent_reactor_off', 224, 28);
  g.math(dd.expr, 160, 30, { size: 12, align: 'center', color: C.gold3 });
  g.text('=', 160, 52, { size: 12, align: 'center' });
  g.math(`${dd.base}^${fmtQ(v.vals.e ?? ZERO)}`, 160, 66, { size: 14, align: 'center', color: C.cyan3 });
  const e = n(v, 'e');
  g.text(`nilai pangkatmu: ${dd.base ** e <= 1e12 ? dd.base ** e : '…'}`, 160, 96, { size: 8, align: 'center', color: C.blue3 });
};

const radicalView: View = (g, v) => {
  const dd = d<{ mode: string; n?: number }>(v);
  g.spr('puzzle_objects', v.solved ? 'exponent_reactor_on' : 'exponent_reactor_off', 144, 54, { s: 1 });
  bigFormula(g, v.c, 24, 12);
  if (dd.mode === 'simplify') {
    const a = n(v, 'a');
    const b = n(v, 'b');
    g.math(`${fmtQ(v.vals.a ?? ZERO)}√${fmtQ(v.vals.b ?? ZERO)}`, 70, 62, { size: 14, align: 'center', color: C.cyan3 });
    g.text(`a² × b = ${a * a * b}`, 70, 86, { size: 8, align: 'center', color: C.blue3 });
    g.text(`harus sama dengan ${dd.n}`, 70, 96, { size: 6, align: 'center', color: C.stone3 });
  }
};

const logView: View = (g, v) => {
  const dd = d<{ mode: string; b: number; k: number; N: number }>(v);
  g.spr('puzzle_objects', 'log_archive_tome', 144, 52, { s: 1 });
  bigFormula(g, v.c, 24, 12);
  if (dd.mode === 'value') g.math(`${dd.b}^${fmtQ(v.vals.k ?? ZERO)} = ${dd.b ** n(v, 'k')}`, 160, 92, { size: 10, align: 'center', color: C.cyan3 });
  else if (dd.mode === 'base') g.math(`${fmtQ(v.vals.b ?? ZERO)}^${dd.k} = ${n(v, 'b') ** dd.k}`, 160, 92, { size: 10, align: 'center', color: C.cyan3 });
  else g.math(`${dd.b}^${dd.k} = ?`, 160, 92, { size: 10, align: 'center', color: C.cyan3 });
};

const expandView: View = (g, v) => {
  const { deg } = d<{ expr: string; deg: number }>(v);
  bigFormula(g, v.c, 26, 12);
  g.text('jawabanmu:', 160, 60, { size: 8, align: 'center', color: C.blue3 });
  const parts: string[] = [];
  for (let i = deg; i >= 0; i--) {
    const cv = v.vals[`c${i}`] ?? ZERO;
    parts.push(`${fmtQ(cv)}${i === 0 ? '' : i === 1 ? 'x' : `x^${i}`}`);
  }
  g.math(parts.join(' + ').replace(/\+ -/g, '− '), 160, 74, { size: 10, align: 'center', color: C.gold3 });
  for (let i = 0; i < 4; i++) g.spr('crystals', i % 2 ? 'x_normal' : 'unit_normal', 100 + i * 28, 94, { a: 0.8 });
};

const domainView: View = (g, v) => {
  const dd = d<{ mode: string; num?: string; den?: string; radicand?: string }>(v);
  const p = new Plot(200, 70, 6, 160, 100);
  p.grid(g);
  sidePanel(g, v.c);
  if (dd.mode === 'radical') {
    const rad = parseExpr(dd.radicand ?? '0');
    p.fn(g, (x) => {
      const val = toNumber(pEval(rad, { x: q(Math.round(x * 100), 100) }));
      return val >= 0 ? Math.sqrt(val) : null;
    }, C.cyan2, 2);
    const b = n(v, 'bound');
    p.clip(g, () => g.dashed(p.X(b), p.t, p.X(b), p.b, C.gold2));
    marker(g, 'forbidden_barrier', p.X(b), p.cy, 0.9);
    g.text(n(v, 'dir') === 1 ? 'x ≥ ' + fmtQ(v.vals.bound ?? ZERO) : 'x ≤ ' + fmtQ(v.vals.bound ?? ZERO), 200, 20, { size: 8, align: 'center', color: C.gold3 });
    return;
  }
  const num = parseExpr(dd.num ?? '1');
  const den = parseExpr(dd.den ?? '1');
  p.fn(g, (x) => {
    const xq = q(Math.round(x * 100), 100);
    const dv = toNumber(pEval(den, { x: xq }));
    return Math.abs(dv) < 0.08 ? null : toNumber(pEval(num, { x: xq })) / dv;
  }, C.cyan2, 2);
  const hs = dd.mode === 'rational2' ? [n(v, 'h1'), n(v, 'h2')] : [n(v, 'h')];
  hs.forEach((h) => {
    p.clip(g, () => g.dashed(p.X(h), p.t, p.X(h), p.b, C.red2));
    marker(g, 'forbidden_barrier', p.X(h), p.cy, 0.9);
  });
};

const system3View: View = (g, v) => {
  const { eqs } = d<{ eqs: string[] }>(v);
  panel(g, 40, 20, 240, 96);
  eqs.forEach((s, i) => {
    const rel = parseRelation(s);
    const env = { x: v.vals.x ?? ZERO, y: v.vals.y ?? ZERO, z: v.vals.z ?? ZERO };
    const l = pEval(rel.lhs, env);
    const r = pEval(rel.rhs, env);
    const ok = eq(l, r);
    g.math(s, 52, 30 + i * 26, { size: 10, color: C.cream3 });
    g.text(`${fmtQ(l)} ${ok ? '=' : '≠'} ${fmtQ(r)}`, 268, 31 + i * 26, { size: 8, align: 'right', color: ok ? C.moss3 : C.red3 });
  });
  g.text('Substitusikan x, y, z ke setiap persamaan', 160, 108, { size: 6, align: 'center', color: C.stone3 });
};

const matbasicView: View = (g, v) => {
  const dd = d<{ A: number[][]; mode: string; i?: number; j?: number }>(v);
  drawMatrix(g, dd.A, 160, 30, 12, C.cream3, 'A =');
  g.text(v.c.display[0], 160, 22 + dd.A.length * 16 + 22, { size: 10, align: 'center', color: C.gold3 });
  if (dd.mode === 'element') g.text(`baris ${dd.i}, kolom ${dd.j}`, 160, 22 + dd.A.length * 16 + 38, { size: 8, align: 'center', color: C.blue3 });
};

const matopView: View = (g, v) => {
  const dd = d<{ op: string; A: number[][]; B?: number[][]; k?: number }>(v);
  const sym: Record<string, string> = { add: '+', sub: '−', mul: '×', transpose: 'ᵀ', scale: '' };
  let x = 60;
  if (dd.op === 'scale') {
    g.text(String(dd.k), 40, 40, { size: 12 });
    x = 100;
  }
  const wA = drawMatrix(g, dd.A, x, 28, 10);
  x += wA / 2 + 12;
  if (dd.B) {
    g.text(sym[dd.op], x, 38, { size: 12, align: 'center', color: C.gold2 });
    x += 22;
    const wB = drawMatrix(g, dd.B, x + 20, 28, 10);
    x += wB + 16;
  } else if (dd.op === 'transpose') {
    g.text('ᵀ', x, 30, { size: 10, align: 'center', color: C.gold2 });
    x += 14;
  }
  g.text('=', x, 38, { size: 12, align: 'center' });
  const rows = dd.op === 'transpose' ? 3 : 2;
  const res: string[][] = Array.from({ length: rows }, (_, i) => Array.from({ length: 2 }, (_, j) => fmtQ(v.vals[`r${i + 1}${j + 1}`] ?? ZERO)));
  drawMatrix(g, res, x + 40, 28, 10, C.cyan3);
  g.text(v.c.display[0], 160, 106, { size: 8, align: 'center', color: C.blue3 });
};

const detView: View = (g, v) => {
  const dd = d<{ A: number[][]; mode: string; hide?: number[] }>(v);
  const M: (string | number)[][] = dd.A.map((r) => [...r]);
  let live: Q | null = null;
  if (dd.mode === 'collapse') {
    const [hi, hj] = dd.hide ?? [0, 0];
    M[hi][hj] = fmtQ(v.vals.k ?? ZERO);
    const mm = mtx(dd.A);
    mm[hi][hj] = v.vals.k ?? ZERO;
    live = det(mm);
  }
  drawMatrix(g, M, 110, 26, 12, C.cream3, 'A =');
  const shaky = live !== null && isZero(live);
  const wob = shaky ? Math.sin(v.t * 30) * 2 : 0;
  g.rect(190 + wob, 62, 100, 8, shaky ? C.red1 : C.moss1);
  g.rect(190 + wob, 62, 100, 2, shaky ? C.red2 : C.moss2);
  g.text(shaky ? 'platform runtuh!' : 'platform stabil', 240, 76, { size: 8, align: 'center', color: shaky ? C.red3 : C.moss3 });
  if (live !== null) g.text(`det = ${fmtQ(live)}`, 110, 22 + dd.A.length * 16 + 20, { size: 10, align: 'center', color: C.gold3 });
  else g.text(v.c.display[0], 110, 22 + dd.A.length * 16 + 20, { size: 10, align: 'center', color: C.gold3 });
};

const inverseView: View = (g, v) => {
  const dd = d<{ A: number[][]; mode: string; b?: number[] }>(v);
  drawMatrix(g, dd.A, 80, 28, 12, C.cream3, 'A =');
  if (dd.mode === 'apply') {
    g.text(`A · (x, y) = (${dd.b?.join(', ')})`, 190, 34, { size: 10, align: 'center', color: C.gold3 });
    g.text(`x = ${fmtQ(v.vals.x ?? ZERO)}, y = ${fmtQ(v.vals.y ?? ZERO)}`, 190, 58, { size: 8, align: 'center', color: C.cyan3 });
    return;
  }
  const X = [[v.vals.i11 ?? ZERO, v.vals.i12 ?? ZERO], [v.vals.i21 ?? ZERO, v.vals.i22 ?? ZERO]];
  drawMatrix(g, X.map((r) => r.map(fmtQ)), 220, 28, 12, C.cyan3, 'A⁻¹ =');
  const prod = matMul(mtx(dd.A), X);
  g.text('A · A⁻¹ kamu =', 160, 76, { size: 8, align: 'center', color: C.blue3 });
  drawMatrix(g, prod.map((r) => r.map(fmtQ)), 160, 86, 8, eq(prod[0][0], q(1)) && eq(prod[1][1], q(1)) && isZero(prod[0][1]) && isZero(prod[1][0]) ? C.moss3 : C.snow2);
};

const polyShape = [[0, 0], [2, 0], [2, 2], [1, 3], [0, 2]];
const transformView: View = (g, v) => {
  const dd = d<{ mode: string; v: number[]; w: number[] }>(v);
  const p = new Plot(200, 70, 7, 160, 100);
  p.grid(g);
  sidePanel(g, v.c);
  const M = dd.mode === 'scale' ? [[n(v, 'k'), 0], [0, n(v, 'k')]] : [[n(v, 'a'), n(v, 'b')], [n(v, 'c'), n(v, 'd')]];
  const tr = (pt: number[]): number[] => [M[0][0] * pt[0] + M[0][1] * pt[1], M[1][0] * pt[0] + M[1][1] * pt[1]];
  if (dd.mode === 'scale' || dd.mode === 'map') {
    p.arrow(g, 0, 0, dd.v[0], dd.v[1], C.cyan2);
    p.arrow(g, 0, 0, dd.w[0], dd.w[1], C.gold2);
    const r = tr(dd.v);
    marker(g, 'energy_node_on', p.X(r[0]), p.Y(r[1]), 0.8);
    g.text('v', p.X(dd.v[0]) + 3, p.Y(dd.v[1]) - 8, { size: 6, color: C.cyan3 });
    g.text('w', p.X(dd.w[0]) + 3, p.Y(dd.w[1]) - 8, { size: 6, color: C.gold3 });
  } else {
    const goal = { rot90: [[0, -1], [1, 0]], 'reflect-x': [[1, 0], [0, -1]], 'reflect-y': [[-1, 0], [0, 1]] }[dd.mode] ?? [[1, 0], [0, 1]];
    const gp = polyShape.map((pt) => [goal[0][0] * pt[0] + goal[0][1] * pt[1], goal[1][0] * pt[0] + goal[1][1] * pt[1]]);
    p.clip(g, () => g.poly(gp.map(([x, y]) => [p.X(x), p.Y(y)]), null, C.gold2, 0.6));
  }
  if (dd.mode !== 'scale' && dd.mode !== 'map') {
    p.clip(g, () => g.poly(polyShape.map(([x, y]) => [p.X(x), p.Y(y)]), C.ind2, C.ind3, 0.5));
    p.clip(g, () => g.poly(polyShape.map((pt) => tr(pt)).map(([x, y]) => [p.X(x), p.Y(y)]), C.cyan1, C.cyan3, 0.7));
  }
  const m = dd.mode === 'scale' ? `k = ${fmtQ(v.vals.k ?? ZERO)}` : `[${fmtQ(v.vals.a ?? ZERO)} ${fmtQ(v.vals.b ?? ZERO)}] [${fmtQ(v.vals.c ?? ZERO)} ${fmtQ(v.vals.d ?? ZERO)}]`;
  g.text(m, 200, 21, { size: 6, align: 'center', color: C.cyan3 });
};

const vectorView: View = (g, v) => {
  const dd = d<{ mode: string; u: number[]; v: number[]; w?: number[] }>(v);
  const ext = maxOf(...dd.u, ...dd.v, ...(dd.w ?? [0]), 8);
  const p = new Plot(200, 70, autoScale(Math.min(ext, 14), 46), 160, 100);
  p.grid(g);
  sidePanel(g, v.c);
  p.arrow(g, 0, 0, dd.u[0], dd.u[1], C.cyan2);
  if (dd.mode !== 'mag') p.arrow(g, 0, 0, dd.v[0], dd.v[1], C.mag2);
  if (dd.mode === 'comb' && dd.w) {
    p.arrow(g, 0, 0, dd.w[0], dd.w[1], C.gold2);
    const a = n(v, 'a');
    const b = n(v, 'b');
    p.arrow(g, 0, 0, a * dd.u[0] + b * dd.v[0], a * dd.u[1] + b * dd.v[1], C.moss3);
  } else if (dd.mode === 'add' || dd.mode === 'scale') p.arrow(g, 0, 0, n(v, 'wx'), n(v, 'wy'), C.moss3);
};

const complexView: View = (g, v) => {
  const dd = d<{ mode: string; z1: number[]; z2: number[] }>(v);
  const p = new Plot(200, 70, autoScale(12, 46), 160, 100);
  p.grid(g, false);
  g.text('Re', p.r - 8, p.cy + 2, { size: 6, color: C.ind3, shadow: null });
  g.text('Im', p.cx + 2, p.t + 1, { size: 6, color: C.ind3, shadow: null });
  sidePanel(g, v.c);
  p.dot(g, dd.z1[0], dd.z1[1], C.cyan2, 3);
  if (dd.mode !== 'conj') p.dot(g, dd.z2[0], dd.z2[1], C.mag2, 3);
  marker(g, 'complex_orb', p.X(n(v, 're')), p.Y(n(v, 'im')), 0.9);
};

const eigenView: View = (g, v) => {
  const dd = d<{ A: number[][]; mode: string; v?: number[] }>(v);
  const A = mtx(dd.A);
  const vec = dd.mode === 'lambda' ? (dd.v ?? [1, 0]) : [n(v, 'vx'), n(v, 'vy')];
  const vq = vec.map((x) => q(Math.round(x * 100), 100));
  const Av = applyMat(A, vq).map(toNumber);
  const p = new Plot(200, 70, autoScale(maxOf(...vec, ...Av, 6), 46), 160, 100);
  p.grid(g);
  sidePanel(g, v.c);
  if (dd.mode !== 'values') {
    p.arrow(g, 0, 0, vec[0], vec[1], C.cyan2);
    p.arrow(g, 0, 0, Av[0], Av[1], C.gold2);
    const lam = n(v, 'lam');
    if (dd.mode === 'pair') p.arrow(g, 0, 0, lam * vec[0], lam * vec[1], C.moss3);
    g.text(`A·v = (${Av.map((x) => Math.round(x * 100) / 100).join(', ')})`, 200, 21, { size: 6, align: 'center', color: C.gold3 });
  } else {
    marker(g, 'eigen_arrow', 200, 70, 0.9);
    g.text('cari λ dari det(A − λI) = 0', 200, 100, { size: 6, align: 'center', color: C.blue3 });
  }
};

export const VIEWS: Record<string, View> = {
  classify: classifyView, simplify: simplifyView, ineq: ineqView, coord: coordView, line: lineView, dual: dualView,
  factor: factorView, roots: rootsView, parabola: parabolaView, exponent: reactorView, radical: radicalView, log: logView,
  expand: expandView, domain: domainView, system3: system3View, matbasic: matbasicView, matop: matopView, det: detView,
  inverse: inverseView, transform: transformView, vector: vectorView, complex: complexView, eigen: eigenView,
};

/** Ketukan di area kerja → pembaruan knob (untuk puzzle yang bisa disentuh langsung). */
export function tapView(v: VCtx, x: number, y: number): Record<string, Q> | null {
  const kind = v.c.kind;
  if (kind === 'ineq' && y > 50 && y < 112 && x >= NL.l && x <= NL.r) {
    const val = Math.round(NL.min + ((x - NL.l) / (NL.r - NL.l)) * (NL.max - NL.min));
    return { bound: q(val) };
  }
  if (kind === 'coord' && v.c.knobs.length === 2) {
    const dd = d<{ px: number; py: number }>(v);
    const p = mkPlot(Math.max(7, maxOf(dd.px, dd.py) + 2), 182);
    if (x < p.l || x > p.r || y < p.t || y > p.b) return null;
    const [gx, gy] = p.inv(x, y);
    return { x: q(Math.max(-8, Math.min(8, Math.round(gx)))), y: q(Math.max(-8, Math.min(8, Math.round(gy)))) };
  }
  if (kind === 'dual') {
    const p = mkPlot(8);
    if (x < p.l || x > p.r || y < p.t || y > p.b) return null;
    const [gx, gy] = p.inv(x, y);
    return { x: q(Math.max(-9, Math.min(9, Math.round(gx)))), y: q(Math.max(-9, Math.min(9, Math.round(gy)))) };
  }
  return null;
}

export { add, sub, mul, div, cMul, cAdd, cSub, cDiv, cConj, fmtC, matAdd, matT, matScale };
export type { Cx };
