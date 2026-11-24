/**
 * Matematika khusus Workboard: bentuk akar (√) dan matriks.
 * Murni fungsi (tanpa DOM) agar mudah diuji. Matriks memakai pecahan eksak (Q); akar dievaluasi numerik.
 */
import { MathError, Q, ZERO, add, eq as qeq, fmtQ, mul, neg, q, sub, div } from './rational';
import { parseExpr, pConstValue, pIsConst } from './poly';

/* ================= Bentuk akar ================= */

const radNorm = (s: string): string =>
  s.replace(/−|–/g, '-').replace(/×|·/g, '*').replace(/÷/g, '/').replace(/sqrt/gi, '√').replace(/\s+/g, '');

class RadParser {
  private p = 0;
  constructor(private readonly s: string) {}
  parse(): number {
    const v = this.expr();
    if (this.p < this.s.length) throw new MathError('Sintaks tidak valid');
    return v;
  }
  private expr(): number {
    let v = this.term();
    while (this.s[this.p] === '+' || this.s[this.p] === '-') {
      const op = this.s[this.p++];
      const r = this.term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  private term(): number {
    let v = this.unary();
    for (;;) {
      const c = this.s[this.p];
      if (c === '*' || c === '/') {
        this.p++;
        const r = this.unary();
        if (c === '/' && r === 0) throw new MathError('Pembagi nol');
        v = c === '*' ? v * r : v / r;
      } else if (c !== undefined && (/[0-9.]/.test(c) || c === '√' || c === '(')) v *= this.power();
      else return v;
    }
  }
  private unary(): number {
    const c = this.s[this.p];
    if (c === '-' || c === '+') {
      this.p++;
      const r = this.unary();
      return c === '-' ? -r : r;
    }
    return this.power();
  }
  private power(): number {
    const b = this.atom();
    if (this.s[this.p] === '^') {
      this.p++;
      const m = /^-?\d+/.exec(this.s.slice(this.p));
      if (!m) throw new MathError('Pangkat harus bulat');
      this.p += m[0].length;
      return b ** Number(m[0]);
    }
    return b;
  }
  private atom(): number {
    const c = this.s[this.p];
    if (c === undefined) throw new MathError('Ekspresi berakhir tiba-tiba');
    if (c === '√') {
      this.p++;
      const v = this.power();
      if (v < 0) throw new MathError('Isi akar negatif');
      return Math.sqrt(v);
    }
    if (c === '(') {
      this.p++;
      const v = this.expr();
      if (this.s[this.p] !== ')') throw new MathError('Kurung tidak seimbang');
      this.p++;
      return v;
    }
    const m = /^\d+(\.\d+)?/.exec(this.s.slice(this.p));
    if (!m) throw new MathError('Karakter tidak valid');
    this.p += m[0].length;
    return Number(m[0]);
  }
}
/** Nilai numerik ekspresi berakar (mis. "3√2", "√(8)+√2", "√(2(4)+1)"); null bila tidak valid. */
export function evalRad(src: string): number | null {
  if (src.length > 120) return null;
  try {
    const v = new RadParser(radNorm(src)).parse();
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}
export const radClose = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const squareFree = (n: number): boolean => {
  for (let k = 2; k * k <= n; k++) if (n % (k * k) === 0) return false;
  return true;
};
/** Bentuk akar paling sederhana: bilangan bulat, atau [−]a√b dengan b > 1 bebas kuadrat. */
export function isSimpleRad(src: string): boolean {
  const s = radNorm(src);
  if (/^-?\d+$/.test(s)) return true;
  const m = /^-?(\d+)?√(\d+)$/.exec(s);
  if (!m) return false;
  const b = Number(m[2]);
  return b > 1 && squareFree(b) && (m[1] === undefined || Number(m[1]) > 0);
}
/** a√b dari n (n = a²·b dengan a terbesar). */
export function simplifySqrt(n: number): [number, number] {
  let a = 1;
  let b = n;
  for (let k = 2; k * k <= b; k++) while (b % (k * k) === 0) { b /= k * k; a *= k; }
  return [a, b];
}
export const fmtRad = (a: number, b: number): string => (b === 1 ? String(a) : a === 1 ? `√${b}` : a === -1 ? `-√${b}` : `${a}√${b}`);

/* ================= Matriks ================= */

export type Mat = Q[][];

function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}
/** "[[1,2],[3,4]]" → matriks. Tiap elemen boleh ekspresi konstanta ("1+2", "2(3)-1", "1/2"). null bila tidak valid. */
export function parseMat(src: string): Mat | null {
  const s = src.replace(/−|–/g, '-').replace(/\s+/g, '');
  if (s.length > 160 || !/^\[\[.+\]\]$/.test(s)) return null;
  try {
    const rows = s.slice(2, -2).split('],[').map((r) => splitTop(r).map((e) => {
      if (!e || /[[\]]/.test(e)) throw new MathError('Elemen kosong');
      const p = parseExpr(e);
      if (!pIsConst(p)) throw new MathError('Elemen harus bilangan');
      return pConstValue(p);
    }));
    if (!rows.length || rows.some((r) => r.length !== rows[0].length)) return null;
    return rows;
  } catch {
    return null;
  }
}
export const fmtMat = (m: Mat): string => `[[${m.map((r) => r.map(fmtQ).join(',')).join('],[')}]]`;
export const matShape = (m: Mat): string => `${m.length}x${m[0].length}`;
export const matEq = (a: Mat, b: Mat): boolean => matShape(a) === matShape(b) && a.every((r, i) => r.every((v, j) => qeq(v, b[i][j])));
/** Semua elemen sudah bilangan jadi (bukan ekspresi yang belum dihitung). */
export function matIsFinal(src: string): boolean {
  const s = src.replace(/−|–/g, '-').replace(/\s+/g, '');
  return /^\[\[-?\d+(\/\d+)?(,-?\d+(\/\d+)?)*(\],\[-?\d+(\/\d+)?(,-?\d+(\/\d+)?)*)*\]\]$/.test(s);
}
const M2 = (a: number[][]): Mat => a.map((r) => r.map((v) => q(v)));
export const matOf = M2;
export const matAdd = (a: Mat, b: Mat): Mat => a.map((r, i) => r.map((v, j) => add(v, b[i][j])));
export const matSub = (a: Mat, b: Mat): Mat => a.map((r, i) => r.map((v, j) => sub(v, b[i][j])));
export const matScale = (k: Q, a: Mat): Mat => a.map((r) => r.map((v) => mul(k, v)));
export const matT = (a: Mat): Mat => a[0].map((_, j) => a.map((r) => r[j]));
export function matMul(a: Mat, b: Mat): Mat {
  return a.map((r) => b[0].map((_, j) => r.reduce((s, v, k) => add(s, mul(v, b[k][j])), ZERO)));
}
export const det2 = (m: Mat): Q => sub(mul(m[0][0], m[1][1]), mul(m[0][1], m[1][0]));
export function det3(m: Mat): Q {
  const t = (i: number, j: number, k: number): Q => mul(mul(m[0][i], m[1][j]), m[2][k]);
  return sub(add(add(t(0, 1, 2), t(1, 2, 0)), t(2, 0, 1)), add(add(t(2, 1, 0), t(0, 2, 1)), t(1, 0, 2)));
}
export function inv2(m: Mat): Mat | null {
  const d = det2(m);
  if (d.n === 0) return null;
  return matScale(div(q(1), d), [[m[1][1], neg(m[0][1])], [neg(m[1][0]), m[0][0]]]);
}
