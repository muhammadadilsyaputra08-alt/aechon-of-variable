/**
 * Varian Workboard lanjutan: A12 akar · A13 logaritma · A18–A20 fungsi · A22–A25 matriks.
 * Dipisah dari wbgen.ts agar berkas inti tetap ringkas. Hanya `import type` dari wbgen (tanpa siklus runtime).
 */
import type { Make, Trap } from './wbgen';
import type { Rng } from '../archivist/rng';
import { fmtTerms } from '../archivist/generators';
import { Q, fmtQ, q, div as qdiv, neg as qneg } from '../math/rational';
import { Mat, det2, det3, fmtMat, fmtRad, inv2, matAdd, matMul, matOf, matScale, matSub, matT, simplifySqrt } from '../math/special';

const sg = (r: Rng): number => (r.chance(0.5) ? 1 : -1);
const nz = (r: Rng, lo: number, hi: number): number => sg(r) * r.int(lo, hi);
const lin = (a: number, b: number, v = 'x'): string => fmtTerms([[a, v], [b, '']]);
const par = (n: number): string => (n < 0 ? `(${n})` : String(n));
const sgnOf = (n: number): string => (n < 0 ? '-' : '+');
const SQFREE = [2, 3, 5, 6, 7, 10, 11, 13];
type Out = ReturnType<Make>;

/* ---------- util matriks ---------- */
function randMat(r: Rng, rows: number, cols: number, lo: number, hi: number, signed: boolean): number[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => (signed ? nz(r, lo, hi) : r.int(lo, hi))));
}
const showN = (m: number[][]): string => `[[${m.map((row) => row.join(',')).join('],[')}]]`;
/** Baris langkah: elemen berupa ekspresi (belum dihitung) — contoh "[[1+(-2),3+4],[...]]". */
const exprMat = (cells: string[][]): string => `[[${cells.map((row) => row.join(',')).join('],[')}]]`;
const matTrap = (m: Mat, tag: Trap['tag'], msg: string): Trap => ({ src: fmtMat(m), tag, msg });

export const ADV: Record<string, Make> = {
  /* ================= A12: Bentuk akar ================= */
  rad_1: (r, d) => {
    const a = r.int(2, 3 + d);
    const b = r.pick(SQFREE);
    const n = a * a * b;
    return {
      kind: 'rad', expr: `√${n}`, answer: fmtRad(a, b),
      steps: [`√(${a * a}×${b})`, fmtRad(a, b)],
      traps: [{ src: `${a * a}√${b}`, tag: 'concept', msg: `√${a * a} = ${a}, bukan ${a * a}. Ambil akar dari kuadrat sempurnanya.` }],
    };
  },
  rad_2: (r, d) => {
    for (let i = 0; i < 40; i++) {
      const p = r.pick([2, 3, 5, 6, 7, 8, 10, 12, 14, 18]);
      const s = r.pick([2, 3, 5, 6, 7, 8, 10, 12, 14, 18]);
      const [a, b] = simplifySqrt(p * s);
      if (a === 1 && b !== 1) continue;
      if (d <= 2 && a > 4) continue;
      const ans = fmtRad(a, b);
      const steps = [`√(${p}×${s})`, `√${p * s}`, ans].filter((x, k, arr) => arr.indexOf(x) === k);
      return { kind: 'rad', expr: `√${p} × √${s}`, answer: ans, steps, traps: [{ src: `${p}√${s}`, tag: 'concept', msg: '√a × √b = √(a×b): kalikan isi akarnya, bukan memindahkan angka ke depan.' }] };
    }
    return { kind: 'rad', expr: '√2 × √8', answer: '4', steps: ['√16', '4'], traps: [] };
  },
  rad_3: (r, d) => {
    const b = r.pick(SQFREE);
    const c = r.int(2, 5 + d);
    const e = r.int(1, 4 + d);
    const minus = r.chance(0.5) && c !== e;
    const res = minus ? c - e : c + e;
    return {
      kind: 'rad', expr: `${c}√${b} ${minus ? '-' : '+'} ${e}√${b}`, answer: fmtRad(res, b),
      steps: [`(${c}${minus ? '-' : '+'}${e})√${b}`, fmtRad(res, b)],
      traps: [{ src: `${res}√${b * 2}`, tag: 'concept', msg: 'Hanya koefisien yang dijumlah/dikurang; isi akar sejenis tetap sama.' }],
    };
  },
  rad_4: (r, d) => {
    const b = r.pick(SQFREE);
    const a1 = r.int(2, 3 + d);
    let a2 = r.int(2, 3 + d);
    const minus = r.chance(0.4);
    if (minus && a1 === a2) a2 += 1;
    const res = minus ? a1 - a2 : a1 + a2;
    return {
      kind: 'rad', expr: `√${a1 * a1 * b} ${minus ? '-' : '+'} √${a2 * a2 * b}`, answer: fmtRad(res, b),
      steps: [`${a1}√${b} ${minus ? '-' : '+'} ${a2}√${b}`, `(${a1}${minus ? '-' : '+'}${a2})√${b}`, fmtRad(res, b)],
      traps: [{ src: `√${a1 * a1 * b + (minus ? -1 : 1) * a2 * a2 * b}`, tag: 'concept', msg: 'Akar tidak boleh digabung dengan menjumlah isi akar. Sederhanakan tiap akar dahulu.' }],
    };
  },
  rad_5: (r, d) => {
    for (let i = 0; i < 40; i++) {
      const c = r.int(2, 3);
      const e = r.int(2, 3 + (d > 3 ? 1 : 0));
      const p = r.pick([2, 3, 5, 6, 7]);
      const s = r.pick([2, 3, 5, 6, 7, 8, 12]);
      const [a, b] = simplifySqrt(p * s);
      if (b === 1 && a === 1) continue;
      const ans = fmtRad(c * e * a, b);
      return {
        kind: 'rad', expr: `${c}√${p} × ${e}√${s}`, answer: ans,
        steps: [`${c * e}√${p * s}`, ans].filter((x, k, arr) => arr.indexOf(x) === k),
        traps: [{ src: `${c + e}√${p * s}`, tag: 'operation', msg: 'Koefisien DIKALI (c × e), bukan dijumlah.' }],
      };
    }
    return { kind: 'rad', expr: '2√2 × 3√2', answer: '12', steps: ['12'], traps: [] };
  },

  /* ================= A13: Logaritma ================= */
  lg_1: (r, d) => {
    const b = r.pick([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const k = r.int(1, d >= 3 ? (b <= 5 ? 4 : 3) : 3);
    const N = b ** k;
    const bad = b * k;
    return {
      kind: 'value', expr: `log_${b}(${N})`, answer: String(k), steps: [String(k)],
      traps: bad !== k ? [{ src: String(bad), tag: 'concept', msg: `log_${b}(${N}) mencari PANGKAT: ${b}^? = ${N}. Bukan perkalian.` }] : [],
    };
  },
  lg_2: (r, d) => {
    const b = r.pick([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const kind = r.int(0, d >= 3 ? 3 : 2);
    if (kind === 0) return { kind: 'value', expr: `log_${b}(1)`, answer: '0', steps: ['0'], traps: [{ src: '1', tag: 'concept', msg: `${b}^0 = 1, jadi log_${b}(1) = 0.` }] };
    if (kind === 1) return { kind: 'value', expr: `log_${b}(${b})`, answer: '1', steps: ['1'], traps: [{ src: '0', tag: 'concept', msg: `${b}^1 = ${b}, jadi log_${b}(${b}) = 1.` }] };
    const k = r.int(1, 3);
    return {
      kind: 'value', expr: `log_${b}(1/${b ** k})`, answer: String(-k), steps: [String(-k)],
      traps: [{ src: String(k), tag: 'sign', msg: `1/${b ** k} = ${b}^(−${k}). Pecahan 1/N berarti pangkat NEGATIF.` }],
    };
  },
  lg_3: (r, d) => {
    const b = r.pick([2, 3, 4, 5, 6, 10]);
    const k = nz(r, 1, d >= 3 ? 4 : 3);
    const pos = k > 0;
    const val = pos ? q(b ** k) : q(1, b ** -k);
    const traps: Trap[] = [{ src: `x = ${b * k}`, tag: 'operation', msg: `log_${b}(x) = k berarti x = ${b}^k, bukan ${b} × k.` }];
    if (pos) traps.push({ src: `x = ${k ** b}`, tag: 'concept', msg: 'Basis dan hasil log tertukar: x = basis^hasil.' });
    return {
      kind: 'equation', expr: `log_${b}(x) = ${k}`, answer: `x = ${fmtQ(val)}`,
      steps: [pos ? `x = ${b}^${k}` : `x = 1/${b}^${-k}`, `x = ${fmtQ(val)}`], traps,
    };
  },
  lg_4: (r, d) => {
    const b = r.pick([2, 3, 4, 5, 6, 10]);
    const e1 = r.int(1, 3);
    const e2 = r.int(1, 3);
    const e3 = d >= 4 ? r.int(1, 2) : 0;
    const minus = r.chance(0.4);
    const val = e1 + (minus ? -e2 : e2) - e3;
    const expr = `log_${b}(${b ** e1}) ${minus ? '-' : '+'} log_${b}(${b ** e2})${e3 ? ` - log_${b}(${b ** e3})` : ''}`;
    const line = `${e1} ${minus ? '-' : '+'} ${e2}${e3 ? ` - ${e3}` : ''}`;
    return {
      kind: 'value', expr, answer: String(val), steps: [line, String(val)].filter((x, k, arr) => arr.indexOf(x) === k),
      traps: [{ src: String(e1 + e2 + e3), tag: 'sign', msg: 'Tanda minus di antara log tetap berlaku pada hasil masing-masing log.' }],
    };
  },
  lg_5: (r, d) => {
    const b = r.pick([2, 3, 4, 5, 6, 7, 8, 9]);
    const k = r.int(2, 2 + Math.min(2, d - 1));
    return {
      kind: 'value', expr: `log_x(${b ** k}) = ${k}`, answer: String(b), steps: [String(b)],
      traps: [{ src: String(b ** k), tag: 'concept', msg: `Cari basis x sehingga x^${k} = ${b ** k}, bukan ${b ** k} sendiri.` }],
    };
  },

  /* ================= A18: Fungsi kuadrat ================= */
  qf_5: (r, d) => {
    const a = d <= 2 ? r.pick([1, 2]) : r.pick([1, 2, -1, -2, 3]);
    const h = nz(r, 1, 3 + d);
    const k = nz(r, 1, 6);
    const expr = `y = ${a === 1 ? '' : a === -1 ? '-' : a}(x ${sgnOf(-h)} ${Math.abs(h)})^2 ${sgnOf(k)} ${Math.abs(k)}`;
    return {
      kind: 'point', expr, answer: `(${h}, ${k})`, steps: [`(${h}, ${k})`],
      traps: [{ src: `(${-h}, ${k})`, tag: 'sign', msg: 'Bentuk a(x − h)² + k memiliki puncak (h, k): tanda h berlawanan dengan yang tertulis di kurung.' }],
    };
  },
  qf_1: (r, d) => {
    const a = d <= 2 ? 1 : r.pick([1, 2, 3, -1, -2]);
    const h = nz(r, 1, 2 + d);
    const b = -2 * a * h;
    const c = nz(r, 1, 9);
    return {
      kind: 'equation', expr: `y = ${fmtTerms([[a, 'x^2'], [b, 'x'], [c, '']])}`, answer: `x = ${h}`,
      steps: [`x = ${par(-b)}/(2×${par(a)})`, `x = ${h}`],
      traps: [{ src: `x = ${-h}`, tag: 'sign', msg: 'Sumbu simetri x = −b/(2a). Perhatikan tanda b.' }],
    };
  },
  qf_2: (r, d) => {
    const a = d <= 3 ? r.pick([1, 2]) : r.pick([1, 2, 3, -1, -2]);
    const h = nz(r, 1, 2 + d);
    const c = nz(r, 1, 8);
    const b = -2 * a * h;
    const k = a * h * h + b * h + c;
    const traps: Trap[] = [{ src: `(${-h}, ${k})`, tag: 'sign', msg: 'Absis puncak h = −b/(2a); perhatikan tanda b.' }];
    if (c !== k) traps.push({ src: `(${h}, ${c})`, tag: 'concept', msg: 'c adalah titik potong sumbu-y. Hitung y di x puncak.' });
    return {
      kind: 'point', expr: `y = ${fmtTerms([[a, 'x^2'], [b, 'x'], [c, '']])}`, answer: `(${h}, ${k})`,
      steps: [`x = ${h}`, `y = ${a}(${h})^2 + (${b})(${h}) + (${c})`, `(${h}, ${k})`], traps,
    };
  },
  qf_3: (r, d) => {
    const a = d <= 3 ? r.pick([1, 2]) : r.pick([1, 2, -1, -2]);
    const h = nz(r, 1, 2 + d);
    const c = nz(r, 1, 8);
    const b = -2 * a * h;
    const k = a * h * h + b * h + c;
    return {
      kind: 'value', expr: `f(x) = ${fmtTerms([[a, 'x^2'], [b, 'x'], [c, '']])}`, answer: String(k),
      steps: [`${a}(${h})^2 + (${b})(${h}) + (${c})`, String(k)],
      traps: h !== k ? [{ src: String(h), tag: 'concept', msg: 'Itu sumbu simetri (nilai x). Nilai ekstrem adalah y = f(h).' }] : [],
    };
  },
  qf_4: (r, d) => {
    const p = nz(r, 1, 3 + d);
    let s = nz(r, 1, 3 + d);
    if (p === s) s = -s;
    const lo = Math.min(p, s);
    const hi = Math.max(p, s);
    const f = (n: number): string => `x ${n < 0 ? '+' : '-'} ${Math.abs(n)}`;
    return {
      kind: 'roots', expr: `${fmtTerms([[1, 'x^2'], [-(p + s), 'x'], [p * s, '']])} = 0`, answer: `${lo}, ${hi}`,
      steps: [`(${f(p)})(${f(s)}) = 0`, `x = ${lo}, x = ${hi}`],
      traps: [{ src: `${-lo}, ${-hi}`, tag: 'sign', msg: 'Faktor (x − p) memberi titik potong x = +p.' }],
    };
  },

  /* ================= A19: Fungsi rasional ================= */
  rf_1: (r, d) => {
    for (let i = 0; i < 60; i++) {
      const k = nz(r, 1, 3 + d);
      const a = nz(r, 1, 3);
      const b = nz(r, 1, 6);
      const e = r.pick([1, -1, 2, -2, 3]);
      const m = nz(r, 1, 4);
      const c = r.pick([1, 2, 1, -1]);
      const dd = e - c * k;
      const num = e * m;
      const bb = num - a * k;
      void b;
      if (c * k + dd === 0) continue;
      return {
        kind: 'value', expr: `f(x) = (${lin(a, bb)})/(${lin(c, dd)}),  x = ${k}`, answer: String(m),
        steps: [`(${a}(${k}) + (${bb}))/(${c}(${k}) + (${dd}))`, `${num}/${e}`, String(m)],
        traps: [{ src: String(num), tag: 'operation', msg: 'Jangan lupa membagi dengan nilai penyebut.' }],
      };
    }
    return { kind: 'value', expr: 'f(x) = (2x)/(x),  x = 3', answer: '2', steps: ['2'], traps: [] };
  },
  rf_2: (r, d) => {
    const k = nz(r, 1, 3 + d);
    const a = nz(r, 1, 4);
    const b = nz(r, 1, 6);
    return {
      kind: 'equation', expr: `f(x) = (${lin(a, b)})/(x ${sgnOf(-k)} ${Math.abs(k)})`, answer: `x = ${k}`,
      steps: [`x ${sgnOf(-k)} ${Math.abs(k)} = 0`, `x = ${k}`],
      traps: [{ src: `x = ${-k}`, tag: 'sign', msg: 'Penyebut = 0 → x − k = 0 → x = +k.' }],
    };
  },
  rf_3: (r, d) => {
    const c = r.int(2, 4);
    const k = nz(r, 1, 2 + d);
    const dd = -c * k + (r.chance(0.5) ? 0 : nz(r, 1, c - 1 || 1));
    const root = qdiv(q(-dd), q(c));
    const a = nz(r, 1, 4);
    const b = nz(r, 1, 6);
    return {
      kind: 'equation', expr: `f(x) = (${lin(a, b)})/(${lin(c, dd)})`, answer: `x = ${fmtQ(root)}`,
      steps: [`${lin(c, dd)} = 0`, `${c}x = ${-dd}`, `x = ${fmtQ(root)}`],
      traps: [{ src: `x = ${fmtQ(qneg(root))}`, tag: 'sign', msg: 'Pindahkan konstanta penyebut dengan tanda berlawanan, lalu bagi koefisien x.' }],
    };
  },
  rf_4: (r, d) => {
    const c = nz(r, 1, 3);
    const a = nz(r, 1, 4 + d);
    const b = nz(r, 1, 6);
    const dd = nz(r, 1, 6);
    const val = qdiv(q(a), q(c));
    const traps: Trap[] = [{ src: fmtQ(qdiv(q(b), q(dd))), tag: 'concept', msg: 'Asimtot datar memakai koefisien x berpangkat tertinggi (a/c), bukan konstanta.' }, { src: fmtQ(qdiv(q(c), q(a))), tag: 'operation', msg: 'Rasio a/c: koefisien x pembilang dibagi koefisien x penyebut.' }];
    return {
      kind: 'value', expr: `f(x) = (${lin(a, b)})/(${lin(c, dd)})`, answer: fmtQ(val),
      steps: [`${a}/${par(c)}`, fmtQ(val)].filter((x, i, arr) => arr.indexOf(x) === i), traps,
    };
  },
  rf_5: (r) => {
    for (let i = 0; i < 60; i++) {
      const a = nz(r, 1, 4);
      const b = nz(r, 1, 8);
      const c = r.int(1, 3);
      const dd = nz(r, 1, 8);
      const root = qdiv(q(-b), q(a));
      const den = c * root.n / root.d + dd;
      if (den === 0) continue;
      return {
        kind: 'equation', expr: `f(x) = (${lin(a, b)})/(${lin(c, dd)}),  f(x) = 0`, answer: `x = ${fmtQ(root)}`,
        steps: [`${lin(a, b)} = 0`, `${fmtTerms([[a, 'x']])} = ${-b}`, `x = ${fmtQ(root)}`],
        traps: [{ src: `x = ${fmtQ(qdiv(q(-dd), q(c)))}`, tag: 'concept', msg: 'f(x) = 0 terjadi saat PEMBILANG = 0 (penyebut hanya menentukan asimtot).' }],
      };
    }
    return { kind: 'equation', expr: 'f(x) = (2x + 4)/(x + 1),  f(x) = 0', answer: 'x = -2', steps: ['2x + 4 = 0', 'x = -2'], traps: [] };
  },
  rf_6: (r, d) => {
    const p = nz(r, 1, 3 + d);
    let s = nz(r, 1, 3 + d);
    if (p === s) s = -s;
    const lo = Math.min(p, s);
    const hi = Math.max(p, s);
    const f = (n: number): string => `x ${n < 0 ? '+' : '-'} ${Math.abs(n)}`;
    return {
      kind: 'roots', expr: `${fmtTerms([[1, 'x^2'], [-(p + s), 'x'], [p * s, '']])} = 0`, answer: `${lo}, ${hi}`,
      steps: [`(${f(p)})(${f(s)}) = 0`, `x = ${lo}, x = ${hi}`],
      traps: [{ src: `${-lo}, ${-hi}`, tag: 'sign', msg: 'Faktor (x − p) menghasilkan x = +p.' }],
    };
  },

  /* ================= A20: Fungsi radikal ================= */
  rd_1: (r, d) => {
    const a = nz(r, 1, 4 + 2 * d);
    return {
      kind: 'ineq', expr: `f(x) = √(x ${sgnOf(a)} ${Math.abs(a)})`, answer: `x >= ${-a}`,
      steps: [`x ${sgnOf(a)} ${Math.abs(a)} >= 0`, `x >= ${-a}`],
      traps: [{ src: `x <= ${-a}`, tag: 'concept', msg: 'Isi akar harus ≥ 0 (tidak negatif), bukan ≤ 0.' }, { src: `x >= ${a}`, tag: 'sign', msg: 'Pindahkan konstanta dengan tanda berlawanan.' }],
    };
  },
  rd_2: (r, d) => {
    const a = r.pick([1, 2, 3, -1, -2, -3].filter((v) => d >= 2 || v > 0));
    const k = nz(r, 1, 3 + d);
    const b = -a * k;
    const ans = a < 0 ? `x <= ${k}` : `x >= ${k}`;
    const traps: Trap[] = a < 0 ? [{ src: `x >= ${k}`, tag: 'concept', msg: 'Dibagi koefisien NEGATIF: arah tanda harus dibalik.' }] : [{ src: `x >= ${-k}`, tag: 'sign', msg: 'Pindahkan konstanta dengan tanda berlawanan lalu bagi a.' }];
    return {
      kind: 'ineq', expr: `f(x) = √(${lin(a, b)})`, answer: ans,
      steps: [`${lin(a, b)} >= 0`, `${fmtTerms([[a, 'x']])} >= ${-b}`, ans], traps,
    };
  },
  rd_3: (r, d) => {
    const m = r.int(2, 3 + d);
    const k = nz(r, 1, 3 + d);
    const a = r.pick([1, 2, 3, -1]);
    const b = m * m - a * k;
    return {
      kind: 'rad', expr: `f(x) = √(${lin(a, b)}),  x = ${k}`, answer: String(m),
      steps: [`√(${a}(${k}) + (${b}))`, `√${m * m}`, String(m)],
      traps: [{ src: String(m * m), tag: 'operation', msg: 'Jangan lupa mengambil akar dari hasil isi akar.' }],
    };
  },
  rd_4: (r, d) => {
    const a = nz(r, 1, 5 + d);
    const k = r.int(2, 3 + d);
    return {
      kind: 'equation', expr: `√(x ${sgnOf(a)} ${Math.abs(a)}) = ${k}`, answer: `x = ${k * k - a}`,
      steps: [`x ${sgnOf(a)} ${Math.abs(a)} = ${k * k}`, `x = ${k * k - a}`],
      traps: [{ src: `x = ${k - a}`, tag: 'concept', msg: 'Kuadratkan KEDUA ruas: √(…) = k → isi akar = k².' }],
    };
  },
  rd_5: (r, d) => {
    const a = nz(r, 1, 3 + d);
    const c = nz(r, 1, 6);
    return {
      kind: 'value', expr: `f(x) = √(x ${sgnOf(-a)} ${Math.abs(a)}) ${sgnOf(c)} ${Math.abs(c)}`, answer: String(c),
      steps: [String(c)],
      traps: a !== c ? [{ src: String(a), tag: 'concept', msg: 'Nilai minimum adalah y saat isi akar = 0, yaitu c. (a menentukan awal domain x.)' }] : [],
    };
  },

  /* ================= A22: Matriks ================= */
  mx_1: (r, d) => {
    const rows = d <= 2 ? 2 : r.int(2, 3);
    const cols = d <= 2 ? r.int(2, 3) : r.int(2, 3);
    const m = randMat(r, rows, cols, 1, 9, d >= 3);
    const i = r.int(1, rows);
    const j = r.int(1, cols);
    const val = m[i - 1][j - 1];
    const traps: Trap[] = [];
    if (i <= cols && j <= rows && m[j - 1][i - 1] !== val) traps.push({ src: String(m[j - 1][i - 1]), tag: 'concept', msg: 'a_ij: i = BARIS, j = KOLOM. Urutannya tidak boleh tertukar.' });
    return { kind: 'value', expr: `${showN(m)},  a_${i}${j}`, answer: String(val), steps: [String(val)], traps };
  },
  mx_2: (r, d) => {
    const n = d <= 2 ? 2 : r.int(2, 3);
    const m = randMat(r, n, n, 1, 9, d >= 3);
    const diag = m.map((row, i) => row[i]);
    const anti = m.map((row, i) => row[n - 1 - i]);
    const sum = diag.reduce((s, v) => s + v, 0);
    const asum = anti.reduce((s, v) => s + v, 0);
    return {
      kind: 'value', expr: showN(m), answer: String(sum),
      steps: [diag.map(par).join(' + '), String(sum)].filter((x, i, arr) => arr.indexOf(x) === i),
      traps: asum !== sum ? [{ src: String(asum), tag: 'concept', msg: 'Diagonal utama: a11, a22, … (kiri-atas ke kanan-bawah).' }] : [],
    };
  },
  mx_3: (r, d) => {
    const rows = 2;
    const cols = 2;
    const signed = d >= 3;
    const A = randMat(r, rows, cols, 1, 9, signed);
    const B = randMat(r, rows, cols, 1, 9, signed);
    const minus = d >= 2 && r.chance(0.5);
    const res = (minus ? matSub : matAdd)(matOf(A), matOf(B));
    const cells = A.map((row, i) => row.map((v, j) => `${par(v)}${minus ? '-' : '+'}${par(B[i][j])}`));
    const traps: Trap[] = [];
    if (minus) traps.push(matTrap(matAdd(matOf(A), matOf(B)), 'sign', 'Pada pengurangan matriks, KURANGI tiap elemen yang bersesuaian.'));
    else traps.push(matTrap(matMul2(A, B), 'concept', 'Penjumlahan matriks dilakukan elemen demi elemen, bukan dikalikan.'));
    return { kind: 'matrix', expr: `${showN(A)} ${minus ? '-' : '+'} ${showN(B)}`, answer: fmtMat(res), steps: [exprMat(cells), fmtMat(res)], traps };
  },
  mx_4: (r, d) => {
    const k = d >= 3 ? nz(r, 2, 4) : r.int(2, 4);
    const A = randMat(r, 2, r.int(2, 3), 1, 6, d >= 3);
    const res = matScale(q(k), matOf(A));
    const cells = A.map((row) => row.map((v) => `${par(k)}(${v})`));
    const first = res.map((row) => [...row]);
    first.forEach((row, i) => row.forEach((_, j) => { if (i + j > 0) first[i][j] = q(A[i][j]); }));
    return {
      kind: 'matrix', expr: `${k}${showN(A)}`, answer: fmtMat(res), steps: [exprMat(cells), fmtMat(res)],
      traps: [matTrap(first, 'concept', 'Skalar harus dikalikan ke SEMUA elemen matriks.')],
    };
  },

  /* ================= A23: Operasi matriks ================= */
  mo_1: (r, d) => {
    const rows = r.int(2, 3);
    const cols = rows === 3 ? 2 : r.int(2, 3);
    const A = randMat(r, rows, cols, 1, 9, d >= 3);
    const res = matT(matOf(A));
    return {
      kind: 'matrix', expr: `transpose  ${showN(A)}`, answer: fmtMat(res), steps: [fmtMat(res)],
      traps: [matTrap(matOf(A), 'concept', 'Transpose menukar baris menjadi kolom: baris pertama menjadi kolom pertama.')],
    };
  },
  mo_2: (r, d) => {
    const k = r.int(2, 3);
    const A = randMat(r, 2, 2, 1, 5, d >= 3);
    const B = randMat(r, 2, 2, 1, 6, d >= 3);
    const minus = d >= 3 && r.chance(0.5);
    const res = (minus ? matSub : matAdd)(matScale(q(k), matOf(A)), matOf(B));
    const cells = A.map((row, i) => row.map((v, j) => `${k}(${v})${minus ? '-' : '+'}${par(B[i][j])}`));
    return {
      kind: 'matrix', expr: `${k}${showN(A)} ${minus ? '-' : '+'} ${showN(B)}`, answer: fmtMat(res), steps: [exprMat(cells), fmtMat(res)],
      traps: [matTrap((minus ? matSub : matAdd)(matOf(A), matOf(B)), 'operation', 'Kalikan skalar ke matriks pertama SEBELUM menjumlah/mengurang.')],
    };
  },
  mo_3: (r, d) => {
    const A = randMat(r, 2, 2, 1, 4 + d, d >= 4);
    const B = randMat(r, 2, 2, 1, 4 + d, d >= 4);
    const i = r.int(1, 2);
    const j = r.int(1, 2);
    const P = matMul(matOf(A), matOf(B));
    const val = P[i - 1][j - 1];
    const Q2 = matMul(matOf(B), matOf(A));
    const traps: Trap[] = [];
    if (Q2[i - 1][j - 1].n !== val.n || Q2[i - 1][j - 1].d !== val.d) traps.push({ src: fmtQ(Q2[i - 1][j - 1]), tag: 'concept', msg: 'AB ≠ BA. Urutan matriks menentukan hasil.' });
    return {
      kind: 'value', expr: `${showN(A)} × ${showN(B)},  c_${i}${j}`, answer: fmtQ(val),
      steps: [`${par(A[i - 1][0])}(${B[0][j - 1]}) + ${par(A[i - 1][1])}(${B[1][j - 1]})`, fmtQ(val)], traps,
    };
  },
  mo_4: (r, d) => {
    const A = randMat(r, 2, 2, 1, 3 + d, d >= 3);
    const B = randMat(r, 2, 2, 1, 3 + d, d >= 3);
    const P = matMul(matOf(A), matOf(B));
    const cells = [0, 1].map((i) => [0, 1].map((j) => `${par(A[i][0])}(${par(B[0][j])})+${par(A[i][1])}(${par(B[1][j])})`));
    const el = A.map((row, i) => row.map((v, j) => v * B[i][j]));
    return {
      kind: 'matrix', expr: `${showN(A)} × ${showN(B)}`, answer: fmtMat(P), steps: [exprMat(cells), fmtMat(P)],
      traps: [matTrap(matOf(el), 'concept', 'Perkalian matriks = baris × kolom, bukan elemen × elemen.'), matTrap(matMul(matOf(B), matOf(A)), 'concept', 'AB ≠ BA. Urutan harus sesuai soal.')],
    };
  },
  mo_5: (r, d) => {
    const A = randMat(r, 2, 2, 1, 4, d >= 4);
    const v = randMat(r, 2, 1, 1, 5, d >= 4);
    const P = matMul(matOf(A), matOf(v));
    const cells = [0, 1].map((i) => [`${par(A[i][0])}(${par(v[0][0])})+${par(A[i][1])}(${par(v[1][0])})`]);
    return {
      kind: 'matrix', expr: `${showN(A)} × ${showN(v)}`, answer: fmtMat(P), steps: [exprMat(cells), fmtMat(P)],
      traps: [matTrap(matT(P), 'concept', 'Ordo hasil (2×2)·(2×1) adalah 2×1: dua baris, satu kolom.')],
    };
  },

  /* ================= A24: Determinan ================= */
  dt_1: (r, d) => {
    const A = randMat(r, 2, 2, 1, 5 + d, false);
    const v = det2(matOf(A));
    return {
      kind: 'value', expr: `det ${showN(A)}`, answer: fmtQ(v),
      steps: [`${A[0][0]}(${A[1][1]}) - ${A[0][1]}(${A[1][0]})`, fmtQ(v)],
      traps: [{ src: fmtQ(q(A[0][0] * A[1][1] + A[0][1] * A[1][0])), tag: 'sign', msg: 'det = ad − bc (dikurang, bukan ditambah).' }],
    };
  },
  dt_2: (r, d) => {
    const A = randMat(r, 2, 2, 1, 4 + d, true);
    const v = det2(matOf(A));
    return {
      kind: 'value', expr: `det ${showN(A)}`, answer: fmtQ(v),
      steps: [`${par(A[0][0])}(${par(A[1][1])}) - ${par(A[0][1])}(${par(A[1][0])})`, fmtQ(v)],
      traps: [{ src: fmtQ(q(A[0][0] * A[1][1] + A[0][1] * A[1][0])), tag: 'sign', msg: 'det = ad − bc. Kurangi seluruh hasil bc, termasuk tandanya (−(−) = +).' }],
    };
  },
  dt_3: (r, d) => detParam(r, d, true),
  dt_4: (r, d) => {
    const A = randMat(r, 3, 3, 1, 2 + Math.min(2, d - 2 > 0 ? d - 2 : 0), true);
    const [[a, b, c], [dd, e, f], [g, h, i]] = A;
    const v = det3(matOf(A));
    return {
      kind: 'value', expr: `det ${showN(A)}`, answer: fmtQ(v),
      steps: [`${par(a)}(${par(e)})(${par(i)}) + ${par(b)}(${par(f)})(${par(g)}) + ${par(c)}(${par(dd)})(${par(h)}) - ${par(c)}(${par(e)})(${par(g)}) - ${par(a)}(${par(f)})(${par(h)}) - ${par(b)}(${par(dd)})(${par(i)})`, fmtQ(v)],
      traps: [{ src: fmtQ(q(a * e * i + b * f * g + c * dd * h)), tag: 'operation', msg: 'Sarrus: tiga diagonal utama DIJUMLAH, tiga diagonal kedua DIKURANGKAN.' }],
    };
  },

  /* ================= A25: Invers matriks ================= */
  iv_1: (r, d) => {
    const b = nz(r, 1, 2 + d);
    const c = nz(r, 1, 2 + d);
    const A = r.chance(0.5) ? [[1 + b * c, b], [c, 1]] : [[1, b], [c, 1 + b * c]];
    const res = inv2(matOf(A)) as Mat;
    const [[a1, b1], [c1, d1]] = A;
    return {
      kind: 'matrix', expr: `A = ${showN(A)}`, answer: fmtMat(res),
      steps: [exprMat([[`${par(d1)}/1`, `-(${b1})/1`], [`-(${c1})/1`, `${par(a1)}/1`]]), fmtMat(res)],
      traps: [matTrap(matOf([[a1, b1], [c1, d1]]), 'concept', 'Invers: tukar a dan d, ubah tanda b dan c, lalu bagi determinan.')],
    };
  },
  iv_2: (r, d) => {
    for (let i = 0; i < 80; i++) {
      const A = randMat(r, 2, 2, 1, 3 + d, true);
      const dv = A[0][0] * A[1][1] - A[0][1] * A[1][0];
      if (![2, 3, 4, 5, -2, -3, -4].includes(dv)) continue;
      const [[a, b], [c, dd]] = A;
      const res = inv2(matOf(A)) as Mat;
      const wrong = matScale(q(dv), res);
      return {
        kind: 'matrix', expr: `A = ${showN(A)}`, answer: fmtMat(res),
        steps: [exprMat([[`${par(dd)}/${par(dv)}`, `-(${b})/${par(dv)}`], [`-(${c})/${par(dv)}`, `${par(a)}/${par(dv)}`]]), fmtMat(res)],
        traps: [matTrap(wrong, 'operation', 'Jangan lupa membagi setiap elemen dengan determinan.')],
      };
    }
    return { kind: 'matrix', expr: 'A = [[1,1],[1,3]]', answer: '[[3/2,-1/2],[-1/2,1/2]]', steps: ['[[3/2,-1/2],[-1/2,1/2]]'], traps: [] };
  },
  iv_3: (r, d) => detParam(r, d, false),
  iv_4: (r, d) => {
    for (let i = 0; i < 80; i++) {
      const A = randMat(r, 2, 2, 1, 3 + Math.min(d, 3), d >= 3);
      if (det2(matOf(A)).n === 0) continue;
      const x = nz(r, 1, 4);
      const y = nz(r, 1, 4);
      const p = A[0][0] * x + A[0][1] * y;
      const qq = A[1][0] * x + A[1][1] * y;
      return {
        kind: 'point', expr: `${showN(A)} × [[x],[y]] = [[${p}],[${qq}]]`, answer: `(${x}, ${y})`,
        steps: [`x = ${x}`, `y = ${y}`, `(${x}, ${y})`],
        traps: [{ src: `(${y}, ${x})`, tag: 'concept', msg: 'Urutan titik adalah (x, y).' }],
      };
    }
    return { kind: 'point', expr: '[[1,0],[0,1]] × [[x],[y]] = [[1],[2]]', answer: '(1, 2)', steps: ['(1, 2)'], traps: [] };
  },
};

/** Elemen-wise product trap helper (untuk jebakan penjumlahan matriks). */
function matMul2(A: number[][], B: number[][]): Mat {
  return matOf(A.map((row, i) => row.map((v, j) => v * B[i][j])));
}

/** Cari x agar det = 0 (A24) / matriks tidak punya invers (A25). */
function detParam(r: Rng, d: number, showDet: boolean): Out {
  const a = r.int(1, 3);
  const dd = r.int(1, 3);
  const u = nz(r, 1, 3);
  const v = nz(r, 1, d >= 3 ? 3 : 2);
  const x0 = u * v;
  const M = `[[${a}x,${a * u}],[${dd * v},${dd}]]`;
  const prod = a * dd * u * v;
  const k: Q = q(x0);
  return {
    kind: 'equation', expr: showDet ? `det ${M} = 0` : `${M}  tidak punya invers`, answer: `x = ${fmtQ(k)}`,
    steps: [`(${a}x)(${dd}) - (${a * u})(${dd * v}) = 0`, `${a * dd}x = ${prod}`, `x = ${x0}`],
    traps: [{ src: `x = ${-x0}`, tag: 'sign', msg: 'Selesaikan ad·x − bc = 0 dengan memindahkan bc ke ruas kanan (tanda berubah).' }, { src: `x = ${prod}`, tag: 'operation', msg: 'Bagi kedua ruas dengan koefisien x.' }],
  };
}
