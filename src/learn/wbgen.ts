/**
 * Workboard Question Factory: soal berbasis ekspresi/persamaan dengan solusi langkah-demi-langkah,
 * jebakan kesalahan umum (untuk umpan balik), dan tanda tangan struktur (anti-duplikat).
 * Semua soal deterministik terhadap seed dan diperiksa mandiri dengan parser polinomial eksak.
 */
import { Bi, bi, TopicCode, TOPIC_BY_CODE } from '../data/topics';
import { Rng } from '../archivist/rng';
import { fmtTerms } from '../archivist/generators';
import { parseExpr, parseRelation, pFormat, pCoeff, pDegree } from '../math/poly';
import { fmtQ, neg, div, q, Q, sub, parseQ, toNumber } from '../math/rational';
import { ADV } from './wbgen_adv';
import { evalRad, radClose, parseMat, matEq } from '../math/special';

export type WbKind = 'expr' | 'equation' | 'factor' | 'value' | 'ineq' | 'roots' | 'point' | 'rad' | 'matrix';
export interface Trap {
  src: string;
  tag: 'sign' | 'operation' | 'concept';
  msg: string;
}
export interface WbQuestion {
  id: string;
  topic: TopicCode;
  variant: string;
  seed: number;
  difficulty: number;
  kind: WbKind;
  prompt: Bi;
  expr: string; // soal yang ditampilkan
  env?: Record<string, number>; // untuk kind 'value'
  answer: string;
  steps: string[];
  hints: string[];
  traps: Trap[];
  signature: string;
  shape: string;
}

export type Make = (r: Rng, d: number) => Omit<WbQuestion, 'id' | 'topic' | 'variant' | 'seed' | 'difficulty' | 'hints' | 'signature' | 'shape' | 'prompt'>;

const sg = (r: Rng): number => (r.chance(0.5) ? 1 : -1);
const nz = (r: Rng, lo: number, hi: number): number => sg(r) * r.int(lo, hi);
const lin = (a: number, b: number, v = 'x'): string => fmtTerms([[a, v], [b, '']]);
const F = (s: string): string => pFormat(parseExpr(s));
const sumStr = (ns: number[]): string => ns.map((n, i) => (i === 0 ? String(n) : n < 0 ? `- ${-n}` : `+ ${n}`)).join(' ');


const RELS = ['<', '>', '<=', '>='] as const;
const FLIP: Record<string, string> = { '<': '>', '>': '<', '<=': '>=', '>=': '<=' };

function sysQ(expr: string, x: number, y: number): ReturnType<Make> {
  return { kind: 'point', expr, answer: `(${x}, ${y})`, steps: [`x = ${x}`, `y = ${y}`, `(${x}, ${y})`], traps: [{ src: `(${y}, ${x})`, tag: 'concept', msg: 'Urutan titik adalah (x, y).' }] };
}
function twoRoots(r: Rng, hi: number): [number, number] {
  let p = nz(r, 1, hi + 1);
  let s = nz(r, 1, hi + 1);
  if (p === s) s = -s;
  return [p, s];
}
function rootsQ(expr: string, p: number, s: number, steps: string[]): ReturnType<Make> {
  const lo = Math.min(p, s);
  const hi = Math.max(p, s);
  return {
    kind: 'roots', expr, answer: `${lo}, ${hi}`, steps: [...steps, `x = ${lo}, x = ${hi}`],
    traps: [{ src: `${-lo}, ${-hi}`, tag: 'sign', msg: 'Faktor (x − p) memberi akar x = +p; faktor (x + p) memberi akar x = −p.' }],
  };
}

/** Kunci kanonik pertidaksamaan linear x: "<|3" (arah dinormalkan ke bentuk x REL k). */
export function ineqKey(line: string): string | null {
  let rel;
  try {
    rel = parseRelation(line);
  } catch {
    return null;
  }
  if (rel.rel === '=') return null;
  const d = sub0(rel.lhs, rel.rhs);
  if (pDegree(d, 'x') !== 1 || Array.from(d.keys()).some((k) => k !== '' && k !== 'x:1')) return null;
  const a = pCoeff(d, 'x', 1);
  const c = pCoeff(d, 'x', 0);
  const dir = a.n < 0 ? FLIP[rel.rel] : rel.rel;
  return `${dir}|${fmtQ(div(neg(c), a))}`;
}
/** Himpunan akar dari daftar ("-3, 2" / "x = 2 atau x = -3"); null bila bukan daftar angka. */
export function rootsOf(line: string): string | null {
  const s = line.replace(/−/g, '-').replace(/\s+/g, '').replace(/atau|dan/g, ',').replace(/x=/g, '').replace(/;/g, ',');
  if (!s || /[^0-9,\-/.]/.test(s)) return null;
  const nums = s.split(',').filter(Boolean).map((p) => parseQ(p));
  if (!nums.length || nums.some((n) => !n)) return null;
  const uniq = new Map(nums.map((n) => [fmtQ(n as Q), n as Q]));
  return [...uniq.values()].sort((a, b) => toNumber(a) - toNumber(b)).map(fmtQ).join(',');
}
/** Titik "(a, b)" → [a, b] atau null. */
export function pointOf(line: string): [string, string] | null {
  const m = /^\(\s*(-?[\d./]+)\s*[,;]\s*(-?[\d./]+)\s*\)$/.exec(line.replace(/−/g, '-').trim());
  if (!m) return null;
  const a = parseQ(m[1]);
  const b = parseQ(m[2]);
  return a && b ? [fmtQ(a), fmtQ(b)] : null;
}

/* ---------- Pembuat soal per varian ---------- */
const M: Record<string, Make> = {
  ...ADV,
  /* A01: persamaan satu langkah */
  os_add: (r, d) => {
    const k = r.int(2, 6 + d * 3);
    const b = r.int(2, 5 + d * 3);
    const expr = `x + ${b} = ${k + b}`;
    return { kind: 'equation', expr, answer: `x = ${k}`, steps: [`x = ${k + b} - ${b}`, `x = ${k}`], traps: [{ src: `x = ${k + 2 * b}`, tag: 'sign', msg: 'Untuk menghilangkan +b, KURANGI kedua ruas (bukan ditambah).' }] };
  },
  os_sub: (r, d) => {
    const k = r.int(2, 6 + d * 3);
    const b = r.int(2, 5 + d * 3);
    return { kind: 'equation', expr: `x - ${b} = ${k - b}`, answer: `x = ${k}`, steps: [`x = ${k - b} + ${b}`, `x = ${k}`], traps: [{ src: `x = ${k - 2 * b}`, tag: 'sign', msg: 'Untuk menghilangkan −b, TAMBAH kedua ruas.' }] };
  },
  os_mul: (r, d) => {
    const k = nz(r, 1, 3 + d * 2);
    const a = r.int(2, 3 + d);
    return { kind: 'equation', expr: `${a}x = ${a * k}`, answer: `x = ${k}`, steps: [`x = ${a * k} ÷ ${a}`, `x = ${k}`], traps: [{ src: `x = ${a * k * a}`, tag: 'operation', msg: 'Koefisien x dihilangkan dengan MEMBAGI kedua ruas, bukan mengalikan.' }] };
  },
  os_div: (r, d) => {
    const k = nz(r, 1, 3 + d * 2);
    const a = r.int(2, 3 + d);
    return { kind: 'equation', expr: `x/${a} = ${k}`, answer: `x = ${k * a}`, steps: [`x = ${k} × ${a}`, `x = ${k * a}`], traps: [{ src: `x = ${k}`, tag: 'concept', msg: 'x dibagi a: kalikan kedua ruas dengan a.' }] };
  },

  /* A02: nilai ekspresi */
  eval1: (r, d) => {
    const a = r.int(2, 5);
    const b = r.int(1, 9);
    const k = r.int(1, 3 + d);
    const expr = `${a}x + ${b}`;
    return { kind: 'value', expr, env: { x: k }, answer: String(a * k + b), steps: [`${a}(${k}) + ${b}`, `${a * k} + ${b}`, String(a * k + b)], traps: [] };
  },
  eval2: (r, d) => {
    const a = nz(r, 2, 6);
    const b = nz(r, 1, 9);
    const k = nz(r, 1, 2 + d);
    const expr = lin(a, b);
    const val = a * k + b;
    return { kind: 'value', expr, env: { x: k }, answer: String(val), steps: [`${a}(${k}) ${b < 0 ? '-' : '+'} ${Math.abs(b)}`, `${a * k} ${b < 0 ? '-' : '+'} ${Math.abs(b)}`, String(val)], traps: ([{ src: String(a * Math.abs(k) + b), tag: 'sign', msg: 'Perhatikan tanda negatif pada nilai x saat disubstitusi.' }] as Trap[]).filter((t) => t.src !== String(val)) };
  },
  eval3: (r, d) => {
    const a = r.int(1, 3);
    const b = nz(r, 1, 5);
    const c = nz(r, 1, 9);
    const k = nz(r, 1, 2 + (d > 3 ? 1 : 0));
    const expr = fmtTerms([[a, 'x^2'], [b, 'x'], [c, '']]);
    const val = a * k * k + b * k + c;
    return { kind: 'value', expr, env: { x: k }, answer: String(val), steps: [`${a}(${k})^2 + (${b})(${k}) + (${c})`, `${a * k * k} + (${b * k}) + (${c})`, String(val)], traps: ([{ src: String(a * k * 2 + b * k + c), tag: 'concept', msg: 'x² berarti x × x, bukan 2 × x.' }] as Trap[]).filter((t) => t.src !== String(val)) };
  },
  eval4: (r) => {
    const a = r.int(2, 4);
    const b = nz(r, 1, 4);
    const x = r.int(1, 4);
    const y = nz(r, 1, 4);
    const expr = `${a}x ${b < 0 ? '-' : '+'} ${Math.abs(b)}y`;
    const val = a * x + b * y;
    return { kind: 'value', expr, env: { x, y }, answer: String(val), steps: [`${a}(${x}) ${b < 0 ? '-' : '+'} ${Math.abs(b)}(${y})`, `${a * x} + (${b * y})`, String(val)], traps: [] };
  },

  /* A03: operasi aljabar */
  add: (r, d) => {
    const pos = d <= 1;
    const [a, b, c, e] = [0, 1, 2, 3].map(() => r.int(1, 8) * (pos ? 1 : sg(r)));
    const expr = `(${lin(a, b)}) + (${lin(c, e)})`;
    return { kind: 'expr', expr, answer: F(expr), steps: [fmtTerms([[a, 'x'], [b, ''], [c, 'x'], [e, '']]), `(${sumStr([a, c])})x + (${sumStr([b, e])})`, F(expr)], traps: [] };
  },
  sub: (r, d) => {
    const pos = d <= 2;
    const [a, b, c, e] = [0, 1, 2, 3].map(() => r.int(1, 9) * (pos ? 1 : sg(r)));
    const expr = `(${lin(a, b)}) - (${lin(c, e)})`;
    return {
      kind: 'expr', expr, answer: F(expr),
      steps: [fmtTerms([[a, 'x'], [b, ''], [-c, 'x'], [-e, '']]), `(${sumStr([a, -c])})x + (${sumStr([b, -e])})`, F(expr)],
      traps: [{ src: fmtTerms([[a, 'x'], [b, ''], [-c, 'x'], [e, '']]), tag: 'sign', msg: 'Tanda minus di depan kurung mengubah SEMUA tanda di dalamnya, termasuk konstanta.' }],
    };
  },
  poly_add: (r, d) => polyAddSub(r, d, 1, 2),
  poly_sub: (r, d) => polyAddSub(r, d, -1, 2),
  cubic_add: (r, d) => polyAddSub(r, d, 1, 3),
  cubic_sub: (r, d) => polyAddSub(r, d, -1, 3),
  distribute: (r, d) => {
    const a = r.int(2, 4 + d) * (d >= 3 ? sg(r) : 1);
    const b = r.int(1, 3 + (d > 2 ? 2 : 0));
    const c = nz(r, 1, 9);
    const expr = `${a}(${lin(b, c)})`;
    return {
      kind: 'expr', expr, answer: F(expr),
      steps: [`${a} × ${b === 1 ? 'x' : `${b}x`} + (${a}) × (${c})`, F(expr)],
      traps: [{ src: fmtTerms([[a * b, 'x'], [c, '']]), tag: 'operation', msg: 'Pengali di luar kurung harus dikalikan ke SETIAP suku di dalam kurung.' }],
    };
  },
  binomial: (r, d) => {
    const lead = d >= 4;
    const a = lead ? r.int(2, 3) : 1;
    const b = lead ? r.int(1, 3) : 1;
    const p = nz(r, 1, 4 + d);
    const s = nz(r, 1, 4 + d);
    const expr = `(${lin(a, p)})(${lin(b, s)})`;
    return {
      kind: 'expr', expr, answer: F(expr),
      steps: [fmtTerms([[a * b, 'x^2'], [a * s, 'x'], [p * b, 'x'], [p * s, '']]), F(expr)],
      traps: [{ src: fmtTerms([[a * b, 'x^2'], [p * s, '']]), tag: 'concept', msg: 'Kalikan SETIAP suku dengan setiap suku lain: ada dua suku tengah (a·s dan p·b).' }],
    };
  },
  divide: (r, d) => {
    const c = r.int(2, 2 + d);
    const three = d >= 4;
    const m = nz(r, 1, 4);
    const n = nz(r, 1, 5);
    const k = nz(r, 1, 4);
    const quot = three ? fmtTerms([[m, 'x^2'], [n, 'x'], [k, '']]) : fmtTerms([[m, 'x'], [n, '']]);
    const num = three ? fmtTerms([[c * m, 'x^3'], [c * n, 'x^2'], [c * k, 'x']]) : fmtTerms([[c * m, 'x^2'], [c * n, 'x']]);
    const den = `${c}x`;
    const terms = three ? [[c * m, 'x^3'], [c * n, 'x^2'], [c * k, 'x']] : [[c * m, 'x^2'], [c * n, 'x']];
    const line1 = (terms as Array<[number, string]>).map(([cf, v], i) => `${i ? (cf < 0 ? '- ' : '+ ') : cf < 0 ? '-' : ''}${Math.abs(cf)}${v}/(${den})`).join(' ');
    const wrong = three ? fmtTerms([[m, 'x^2'], [c * n, 'x^2'], [c * k, 'x']]) : fmtTerms([[m, 'x'], [c * n, 'x']]);
    return {
      kind: 'expr', expr: `(${num})/(${den})`, answer: F(quot), steps: [line1, F(quot)],
      traps: [{ src: wrong, tag: 'operation', msg: 'Bagilah SETIAP suku di pembilang dengan penyebut, bukan hanya suku pertama.' }],
    };
  },
  mixed: (r, d) => {
    const a = r.int(2, 4);
    const b = nz(r, 1, 6);
    const c = r.int(2, 4);
    const e = nz(r, 1, 6);
    const f = nz(r, 1, 5 + d);
    const expr = `${a}(${lin(1, b)}) - ${c}(${lin(1, e)}) ${f < 0 ? '-' : '+'} ${Math.abs(f)}x`;
    return {
      kind: 'expr', expr, answer: F(expr),
      steps: [fmtTerms([[a, 'x'], [a * b, ''], [-c, 'x'], [-c * e, ''], [f, 'x']]), F(expr)],
      traps: [{ src: fmtTerms([[a, 'x'], [a * b, ''], [-c, 'x'], [c * e, ''], [f, 'x']]), tag: 'sign', msg: 'Minus di depan kurung: kalikan −' + c + ' ke x DAN ke konstanta di dalam kurung.' }],
    };
  },

  /* A04: suku sejenis */
  lt_1: (r) => likeTerms(r, [['x'], ['x']], false),
  lt_2: (r) => likeTerms(r, [['x'], [''], ['x'], ['']], false),
  lt_3: (r) => likeTerms(r, [['x'], [''], ['x'], ['']], true),
  lt_4: (r) => likeTerms(r, [['x'], ['y'], ['x'], ['y'], ['']], true),
  lt_5: (r) => likeTerms(r, [['x^2'], ['x'], ['x^2'], ['x'], ['']], true),

  /* A05: persamaan linear */
  lin_a: (r, d) => {
    const a = r.int(2, 4 + d) * (d >= 4 ? sg(r) : 1);
    const k = nz(r, 1, 3 + d);
    const b = nz(r, 1, 9);
    const c = a * k + b;
    return {
      kind: 'equation', expr: `${lin(a, b)} = ${c}`, answer: `x = ${k}`,
      steps: [`${fmtTerms([[a, 'x']])} = ${c - b}`, `x = ${k}`],
      traps: [{ src: `x = ${fmtQ(div(q(c + b), q(a)))}`, tag: 'sign', msg: 'Memindahkan konstanta ke ruas lain mengubah tandanya.' }],
    };
  },
  lin_b: (r, d) => {
    const k = nz(r, 1, 3 + d);
    const a = r.int(2, 6);
    let c = r.int(1, 5) * (d >= 3 ? sg(r) : 1);
    if (c === a) c = a - 1 || 2;
    const b = nz(r, 1, 9);
    const e = a * k + b - c * k;
    const wrongRoot = a + c === 0 ? null : div(q(e - b), q(a + c));
    return {
      kind: 'equation', expr: `${lin(a, b)} = ${lin(c, e)}`, answer: `x = ${k}`,
      steps: [`${fmtTerms([[a - c, 'x'], [b, '']])} = ${e}`, `${fmtTerms([[a - c, 'x']])} = ${e - b}`, `x = ${k}`],
      traps: wrongRoot ? [{ src: `x = ${fmtQ(wrongRoot)}`, tag: 'sign', msg: 'Memindahkan suku cx ke kiri harus MENGURANGI (ubah tandanya), bukan menambah.' }] : [],
    };
  },
  lin_c: (r, d) => {
    const a = r.int(2, 4);
    const k = nz(r, 1, 3 + d);
    const b = nz(r, 1, 6);
    const c = a * (k + b);
    return {
      kind: 'equation', expr: `${a}(${lin(1, b)}) = ${c}`, answer: `x = ${k}`,
      steps: [`${fmtTerms([[a, 'x'], [a * b, '']])} = ${c}`, `${fmtTerms([[a, 'x']])} = ${c - a * b}`, `x = ${k}`],
      traps: [{ src: `x = ${fmtQ(div(q(c - b), q(a)))}`, tag: 'operation', msg: 'Kalikan a ke setiap suku di dalam kurung, termasuk konstanta.' }],
    };
  },
  lin_d: (r, d) => {
    const a = r.int(2, 4);
    const k = nz(r, 1, 3 + d);
    const b = nz(r, 1, 5);
    let c = r.int(1, a + 3);
    if (c === a) c = a + 1;
    const e = a * (k + b) - c * k;
    return {
      kind: 'equation', expr: `${a}(${lin(1, b)}) = ${lin(c, e)}`, answer: `x = ${k}`,
      steps: [`${fmtTerms([[a, 'x'], [a * b, '']])} = ${lin(c, e)}`, `${fmtTerms([[a - c, 'x']])} = ${e - a * b}`, `x = ${k}`],
      traps: [{ src: `x = ${fmtQ(div(q(e - a * b), q(a + c)))}`, tag: 'sign', msg: 'Saat memindahkan suku, ubah tandanya.' }],
    };
  },

  /* A11: eksponen */
  exp_mul: (r, d) => {
    const a = r.int(2, Math.min(6, 3 + d));
    const b = r.int(2, Math.min(6, 3 + d));
    return { kind: 'expr', expr: `x^${a} × x^${b}`, answer: `x^${a + b}`, steps: [`x^(${a} + ${b})`, `x^${a + b}`], traps: [{ src: `x^${a * b}`, tag: 'concept', msg: 'Basis sama dikali: pangkat DIJUMLAH, bukan dikali.' }] };
  },
  exp_mulc: (r, d) => {
    const a = r.int(1, Math.min(5, 2 + d));
    const b = r.int(2, Math.min(6, 2 + d));
    const c = r.int(2, 4);
    const e = r.int(2, 4);
    return { kind: 'expr', expr: `(${c}x^${a})(${e}x^${b})`, answer: `${c * e}x^${a + b}`, steps: [`${c} × ${e} × x^${a} × x^${b}`, `${c * e}x^${a + b}`], traps: [{ src: `${c + e}x^${a + b}`, tag: 'operation', msg: 'Koefisien DIKALI, bukan dijumlahkan.' }, { src: `${c * e}x^${a * b}`, tag: 'concept', msg: 'Pangkat dijumlah saat basis sama dikali.' }] };
  },
  exp_pow: (r) => {
    const a = r.int(2, 4);
    const b = r.int(2, 3);
    return { kind: 'expr', expr: `(x^${a})^${b}`, answer: `x^${a * b}`, steps: [`x^(${a} × ${b})`, `x^${a * b}`], traps: [{ src: `x^${a + b}`, tag: 'concept', msg: 'Pangkat dari pangkat: pangkat DIKALI.' }] };
  },
  exp_powc: (r) => {
    const a = r.int(2, 4);
    const b = r.int(2, 3);
    const c = r.int(2, 4);
    return { kind: 'expr', expr: `(${c}x^${a})^${b}`, answer: `${c ** b}x^${a * b}`, steps: [`${c}^${b} × x^(${a} × ${b})`, `${c ** b}x^${a * b}`], traps: [{ src: `${c}x^${a * b}`, tag: 'concept', msg: 'Koefisien juga ikut dipangkatkan.' }, { src: `${c * b}x^${a * b}`, tag: 'operation', msg: `${c}^${b} berarti ${c} dikali sendiri ${b} kali.` }] };
  },

  /* A14: polinomial */
  poly_mul: (r, d) => {
    const a = nz(r, 1, 3 + d);
    const b = nz(r, 1, 4);
    const c = nz(r, 1, 5);
    const expr = `(x ${a < 0 ? '-' : '+'} ${Math.abs(a)})(${fmtTerms([[1, 'x^2'], [b, 'x'], [c, '']])})`;
    return {
      kind: 'expr', expr, answer: F(expr),
      steps: [`x(${fmtTerms([[1, 'x^2'], [b, 'x'], [c, '']])}) + (${a})(${fmtTerms([[1, 'x^2'], [b, 'x'], [c, '']])})`, fmtTerms([[1, 'x^3'], [b, 'x^2'], [c, 'x'], [a, 'x^2'], [a * b, 'x'], [a * c, '']]), F(expr)],
      traps: [{ src: fmtTerms([[1, 'x^3'], [b, 'x^2'], [c, 'x'], [a, '']]), tag: 'operation', msg: 'Faktor (x + a) harus dikalikan ke SETIAP suku trinomial, termasuk a × bx dan a × x².' }],
    };
  },

  /* A15: identitas aljabar */
  sq_sum: (r, d) => {
    const a = r.int(2, 4 + d);
    return { kind: 'expr', expr: `(x + ${a})^2`, answer: `x^2 + ${2 * a}x + ${a * a}`, steps: [`x^2 + 2(x)(${a}) + ${a}^2`, `x^2 + ${2 * a}x + ${a * a}`], traps: [{ src: `x^2 + ${a * a}`, tag: 'concept', msg: '(a+b)² BUKAN a²+b². Ada suku tengah 2ab.' }] };
  },
  sq_diff: (r, d) => {
    const a = r.int(2, 4 + d);
    return { kind: 'expr', expr: `(x - ${a})^2`, answer: `x^2 - ${2 * a}x + ${a * a}`, steps: [`x^2 - 2(x)(${a}) + ${a}^2`, `x^2 - ${2 * a}x + ${a * a}`], traps: [{ src: `x^2 - ${a * a}`, tag: 'concept', msg: '(a−b)² BUKAN a²−b². Ada suku tengah −2ab dan suku akhir +b².' }, { src: `x^2 - ${2 * a}x - ${a * a}`, tag: 'sign', msg: 'Suku terakhir (−b)² bernilai positif.' }] };
  },
  diff_sq: (r, d) => {
    const a = r.int(2, 5 + d);
    return { kind: 'expr', expr: `(x + ${a})(x - ${a})`, answer: `x^2 - ${a * a}`, steps: [`x^2 - ${a}^2`, `x^2 - ${a * a}`], traps: [{ src: `x^2 - ${2 * a}x - ${a * a}`, tag: 'concept', msg: 'Pada (a+b)(a−b) suku tengah saling menghapus.' }] };
  },
  sq_lin: (r, d) => {
    const a = r.int(2, 4);
    const b = nz(r, 1, 3 + d);
    const expr = `(${a}x ${b < 0 ? '-' : '+'} ${Math.abs(b)})^2`;
    return { kind: 'expr', expr, answer: F(expr), steps: [`(${a}x)^2 + 2(${a}x)(${b}) + (${b})^2`, F(expr)], traps: [{ src: fmtTerms([[a * a, 'x^2'], [b * b, '']]), tag: 'concept', msg: 'Jangan lupa suku tengah 2ab.' }, { src: fmtTerms([[a, 'x^2'], [2 * a * b, 'x'], [b * b, '']]), tag: 'operation', msg: 'Koefisien juga dikuadratkan: (ax)² = a²x².' }] };
  },

  /* A16: faktorisasi */
  fac_1: (r, d) => {
    const p = r.int(1, 3 + d);
    const s = r.int(1, 3 + d);
    return facQ(`(x + ${p})(x + ${s})`, fmtTerms([[1, 'x^2'], [p + s, 'x'], [p * s, '']]), [{ src: `(x - ${p})(x - ${s})`, tag: 'sign', msg: 'Tanda p dan q tertukar: periksa jumlah (koefisien x) dan hasil kali (konstanta).' }]);
  },
  fac_2: (r, d) => {
    let p = nz(r, 1, 3 + d);
    let s = nz(r, 1, 3 + d);
    if (p === -s) s = p + 1 || 2;
    if (p === s) p = -p;
    const f = (n: number): string => `x ${n < 0 ? '-' : '+'} ${Math.abs(n)}`;
    return facQ(`(${f(p)})(${f(s)})`, fmtTerms([[1, 'x^2'], [p + s, 'x'], [p * s, '']]), [{ src: `(${f(-p)})(${f(-s)})`, tag: 'sign', msg: 'Faktor (x + p) memberi akar −p. Periksa tanda jumlah dan hasil kalinya.' }]);
  },
  fac_3: (r, d) => {
    const a = r.int(2, 6 + d);
    return facQ(`(x + ${a})(x - ${a})`, `x^2 - ${a * a}`, [{ src: `(x - ${a})(x - ${a})`, tag: 'concept', msg: 'Selisih kuadrat a²−b² = (a+b)(a−b), bukan (a−b)².' }]);
  },
  fac_4: (r, d) => {
    const a = r.int(2, 3);
    const b = r.int(1, 2);
    const p = nz(r, 1, 2 + d);
    const s = nz(r, 1, 2 + d);
    const f1 = `${lin(a, p)}`;
    const f2 = `${lin(b, s)}`;
    return facQ(`(${f1})(${f2})`, fmtTerms([[a * b, 'x^2'], [a * s + p * b, 'x'], [p * s, '']]), [{ src: `(${lin(a, -p)})(${lin(b, -s)})`, tag: 'sign', msg: 'Periksa tanda: uji dengan menjabarkan hasil faktorisasi.' }]);
  },
  /* A06: pertidaksamaan */
  ineq_1: (r, d) => {
    const a = r.int(1, 2 + d);
    const k = nz(r, 1, 3 + d);
    const b = nz(r, 1, 9);
    const c = a * k + b;
    const rel = r.pick(RELS);
    return {
      kind: 'ineq', expr: `${lin(a, b)} ${rel} ${c}`, answer: `x ${rel} ${k}`,
      steps: [`${fmtTerms([[a, 'x']])} ${rel} ${c - b}`, `x ${rel} ${k}`],
      traps: [{ src: `x ${rel} ${fmtQ(div(q(c + b), q(a)))}`, tag: 'sign', msg: 'Memindahkan konstanta ke ruas lain mengubah tandanya.' }],
    };
  },
  ineq_2: (r, d) => {
    const a = -r.int(1, 2 + d);
    const k = nz(r, 1, 3 + d);
    const b = nz(r, 1, 9);
    const c = a * k + b;
    const rel = r.pick(RELS);
    return {
      kind: 'ineq', expr: `${lin(a, b)} ${rel} ${c}`, answer: `x ${FLIP[rel]} ${k}`,
      steps: [`${fmtTerms([[a, 'x']])} ${rel} ${c - b}`, `x ${FLIP[rel]} ${k}`],
      traps: [{ src: `x ${rel} ${k}`, tag: 'concept', msg: 'Dibagi bilangan NEGATIF: arah tanda pertidaksamaan harus dibalik.' }],
    };
  },
  ineq_3: (r, d) => {
    const k = nz(r, 1, 3 + d);
    const a = r.int(1, 6);
    let c = r.int(1, 6);
    if (c === a) c += 1;
    const b = nz(r, 1, 9);
    const e = a * k + b - c * k;
    const rel = r.pick(RELS);
    const ans = a - c < 0 ? FLIP[rel] : rel;
    const tr: Trap[] = [{ src: `x ${rel} ${k}`, tag: 'concept', msg: 'Koefisien x di ruas gabungan negatif: balik tanda saat membagi.' }];
    return { kind: 'ineq', expr: `${lin(a, b)} ${rel} ${lin(c, e)}`, answer: `x ${ans} ${k}`, steps: [`${fmtTerms([[a - c, 'x']])} ${rel} ${e - b}`, `x ${ans} ${k}`], traps: a - c < 0 ? tr : [] };
  },

  /* A07: koordinat */
  co_quad: (r) => {
    const x = nz(r, 1, 9);
    const y = nz(r, 1, 9);
    const quad = x > 0 && y > 0 ? 1 : x < 0 && y > 0 ? 2 : x < 0 ? 3 : 4;
    return { kind: 'value', expr: `titik (${x}, ${y})`, answer: String(quad), steps: [String(quad)], traps: [] };
  },
  co_reflect: (r) => {
    const x = nz(r, 1, 7);
    const y = nz(r, 1, 7);
    const yAxis = r.chance(0.5);
    return { kind: 'point', expr: `(${x}, ${y}) dicerminkan terhadap sumbu-${yAxis ? 'y' : 'x'}`, answer: yAxis ? `(${-x}, ${y})` : `(${x}, ${-y})`, steps: [yAxis ? `(${-x}, ${y})` : `(${x}, ${-y})`], traps: [{ src: `(${-x}, ${-y})`, tag: 'concept', msg: 'Cermin terhadap satu sumbu hanya mengubah tanda SATU koordinat.' }, { src: yAxis ? `(${x}, ${-y})` : `(${-x}, ${y})`, tag: 'concept', msg: 'Sumbu-y: x berubah tanda. Sumbu-x: y berubah tanda.' }] };
  },
  co_trans: (r) => {
    const x = nz(r, 1, 7);
    const y = nz(r, 1, 7);
    const dx = nz(r, 1, 6);
    const dy = nz(r, 1, 6);
    return { kind: 'point', expr: `(${x}, ${y}) digeser oleh vektor (${dx}, ${dy})`, answer: `(${x + dx}, ${y + dy})`, steps: [`(${x + dx}, ${y + dy})`], traps: [{ src: `(${x + dy}, ${y + dx})`, tag: 'concept', msg: 'Komponen pertama menggeser x, komponen kedua menggeser y.' }] };
  },
  co_combo: (r) => {
    const x = nz(r, 1, 6);
    const y = nz(r, 1, 6);
    const dx = nz(r, 1, 6);
    const dy = nz(r, 1, 6);
    const mx = -x;
    return { kind: 'point', expr: `(${x}, ${y}) dicerminkan terhadap sumbu-y, lalu digeser vektor (${dx}, ${dy})`, answer: `(${mx + dx}, ${y + dy})`, steps: [`(${mx}, ${y})`, `(${mx + dx}, ${y + dy})`], traps: [{ src: `(${x + dx}, ${y + dy})`, tag: 'operation', msg: 'Cerminkan dahulu (x berubah tanda), baru geser.' }] };
  },

  /* A08: fungsi linear */
  fn_val1: (r, d) => {
    const m = r.int(2, 5);
    const c = nz(r, 1, 9);
    const k = r.int(1, 3 + d);
    return { kind: 'value', expr: `f(x) = ${lin(m, c)}`, env: { x: k }, answer: String(m * k + c), steps: [`${m}(${k}) ${c < 0 ? '-' : '+'} ${Math.abs(c)}`, String(m * k + c)], traps: [] };
  },
  fn_val2: (r, d) => {
    const m = nz(r, 2, 6);
    const c = nz(r, 1, 9);
    const k = nz(r, 1, 2 + d);
    const v = m * k + c;
    return { kind: 'value', expr: `f(x) = ${lin(m, c)}`, env: { x: k }, answer: String(v), steps: [`${m}(${k}) ${c < 0 ? '-' : '+'} ${Math.abs(c)}`, String(v)], traps: ([{ src: String(m * Math.abs(k) + c), tag: 'sign', msg: 'Perhatikan tanda negatif pada nilai x.' }] as Trap[]).filter((t) => t.src !== String(v)) };
  },
  fn_find: (r, d) => {
    const m = nz(r, 2, 5);
    const c = nz(r, 1, 9);
    const k = nz(r, 1, 3 + d);
    const out = m * k + c;
    return { kind: 'equation', expr: `f(x) = ${lin(m, c)};  f(x) = ${out}`, answer: `x = ${k}`, steps: [`${lin(m, c)} = ${out}`, `${fmtTerms([[m, 'x']])} = ${out - c}`, `x = ${k}`], traps: [{ src: `x = ${fmtQ(div(q(out + c), q(m)))}`, tag: 'sign', msg: 'Pindahkan konstanta dengan mengubah tandanya.' }] };
  },

  /* A09: gradien */
  sl_pts: (r, d) => {
    const x1 = nz(r, 1, 5);
    const y1 = nz(r, 1, 6);
    let dx = nz(r, 1, 3 + d);
    if (dx === 0) dx = 1;
    const dy = nz(r, 1, 6);
    const x2 = x1 + dx;
    const y2 = y1 + dy;
    const m = div(q(dy), q(dx));
    return { kind: 'value', expr: `gradien melalui (${x1}, ${y1}) dan (${x2}, ${y2})`, answer: fmtQ(m), steps: [`(${y2} - ${y1 < 0 ? `(${y1})` : y1})/(${x2} - ${x1 < 0 ? `(${x1})` : x1})`, fmtQ(m)], traps: [{ src: fmtQ(div(q(dx), q(dy))), tag: 'concept', msg: 'Gradien = selisih y dibagi selisih x (bukan sebaliknya).' }] };
  },
  sl_int: (r, d) => {
    const m = nz(r, 1, 4);
    const x1 = nz(r, 1, 3 + d);
    const c = nz(r, 1, 9);
    const y1 = m * x1 + c;
    return { kind: 'value', expr: `y = ${m}x + c melalui (${x1}, ${y1})`, answer: String(c), steps: [`${y1} - ${m}(${x1})`, String(c)], traps: [{ src: String(y1 + m * x1), tag: 'sign', msg: 'c = y − m·x, bukan y + m·x.' }].filter((t) => t.src !== String(c)) as Trap[] };
  },
  sl_std: (r) => {
    const a = nz(r, 1, 6);
    const b = nz(r, 1, 6);
    const c = nz(r, 1, 12);
    const m = div(q(-a), q(b));
    return { kind: 'value', expr: `gradien garis ${fmtTerms([[a, 'x'], [b, 'y']])} = ${c}`, answer: fmtQ(m), steps: [`(${-a})/(${b})`, fmtQ(m)], traps: [{ src: fmtQ(div(q(a), q(b))), tag: 'sign', msg: 'Pindahkan ax ke ruas kanan: tandanya berubah menjadi −a.' }].filter((t) => t.src !== fmtQ(m)) as Trap[] };
  },

  /* A10: SPLDV */
  sys_1: (r) => {
    const x = nz(r, 1, 6);
    const y = nz(r, 1, 6);
    return sysQ(`x + y = ${x + y};  x - y = ${x - y}`, x, y);
  },
  sys_2: (r) => {
    const x = nz(r, 1, 5);
    const y = nz(r, 1, 5);
    const a = r.int(2, 3);
    return sysQ(`${a}x + y = ${a * x + y};  x + y = ${x + y}`, x, y);
  },
  sys_3: (r) => {
    let x = nz(r, 1, 4);
    let y = nz(r, 1, 4);
    let a1 = r.int(1, 3), b1 = r.int(1, 3), a2 = r.int(1, 3), b2 = -r.int(1, 3);
    if (a1 * b2 - a2 * b1 === 0) { a2 += 1; }
    if (a1 * b2 - a2 * b1 === 0) { b1 += 1; }
    x = x || 1; y = y || 1;
    return sysQ(`${fmtTerms([[a1, 'x'], [b1, 'y']])} = ${a1 * x + b1 * y};  ${fmtTerms([[a2, 'x'], [b2, 'y']])} = ${a2 * x + b2 * y}`, x, y);
  },

  /* A17: persamaan kuadrat */
  quad_1: (r, d) => {
    const [p, s] = twoRoots(r, 2 + d);
    return rootsQ(`${fmtTerms([[1, 'x^2'], [-(p + s), 'x'], [p * s, '']])} = 0`, p, s, [`(x ${p > 0 ? '-' : '+'} ${Math.abs(p)})(x ${s > 0 ? '-' : '+'} ${Math.abs(s)}) = 0`]);
  },
  quad_2: (r, d) => {
    const [p, s] = twoRoots(r, 2 + d);
    const f = (n: number): string => `(x ${n > 0 ? '-' : '+'} ${Math.abs(n)})`;
    return rootsQ(`${fmtTerms([[1, 'x^2'], [-(p + s), 'x']])} = ${-(p * s)}`, p, s, [`${fmtTerms([[1, 'x^2'], [-(p + s), 'x'], [p * s, '']])} = 0`, `${f(p)}${f(s)} = 0`]);
  },
  quad_3: (r, d) => {
    const [p, s] = twoRoots(r, 1 + d);
    const a = r.int(2, 3);
    return rootsQ(`${fmtTerms([[a, 'x^2'], [-a * (p + s), 'x'], [a * p * s, '']])} = 0`, p, s, [`${a}(x ${p > 0 ? '-' : '+'} ${Math.abs(p)})(x ${s > 0 ? '-' : '+'} ${Math.abs(s)}) = 0`]);
  },
  quad_4: (r, d) => {
    const k = r.int(2, 5 + d);
    return rootsQ(`x^2 - ${k * k} = 0`, k, -k, [`(x - ${k})(x + ${k}) = 0`]);
  },

};

function facQ(factored: string, poly: string, traps: Trap[]): ReturnType<Make> {
  return { kind: 'factor', expr: poly, answer: factored, steps: [factored], traps };
}

function polyAddSub(r: Rng, d: number, sgn: 1 | -1, deg: 2 | 3): ReturnType<Make> {
  const top = deg === 3 ? 'x^3' : 'x^2';
  const mid = deg === 3 ? 'x^2' : 'x';
  const mk = (): Array<[number, string]> => (deg === 3 ? [[nz(r, 1, 6), top], [nz(r, 1, 6), mid], [nz(r, 1, 6), 'x'], [nz(r, 1, 9), '']] : [[nz(r, 1, 6), top], [nz(r, 1, 8), mid], [nz(r, 1, 9), '']]);
  const A = mk();
  const B = mk();
  if (d <= 2) {
    // kesulitan rendah: semua koefisien positif agar fokus pada struktur
    A.forEach((t) => (t[0] = Math.abs(t[0])));
    B.forEach((t) => (t[0] = Math.abs(t[0])));
  }
  const op = sgn === 1 ? '+' : '-';
  const expr = `(${fmtTerms(A)}) ${op} (${fmtTerms(B)})`;
  const line1 = fmtTerms([...A, ...B.map(([c, v]) => [sgn * c, v] as [number, string])]);
  const grouped = A.map(([c, v], i) => `(${fmtTerms([[c, v], [sgn * B[i][0], v]])})`).join(' + ');
  const traps: Trap[] = [];
  if (sgn === -1) {
    traps.push({ src: fmtTerms([...A, [-B[0][0], B[0][1]], ...B.slice(1)]), tag: 'sign', msg: 'Minus di depan kurung mengubah tanda SEMUA suku di dalamnya, bukan hanya suku pertama.' });
  }
  return { kind: 'expr', expr, answer: F(expr), steps: [line1, grouped, F(expr)], traps };
}

function likeTerms(r: Rng, shape: string[][], signed: boolean): ReturnType<Make> {
  const ts: Array<[number, string]> = shape.map(([v]) => [(signed ? nz(r, 1, 9) : r.int(1, 9)), v]);
  const order = r.shuffle(ts.map((_, i) => i));
  const mixed = ts.length > 2 ? order.map((i) => ts[i]) : ts;
  const expr = fmtTerms(mixed);
  const monos = [...new Set(mixed.map((t) => t[1]))];
  const grouped = monos.map((m) => `(${fmtTerms(mixed.filter((t) => t[1] === m))})`).join(' + ');
  const allSum = mixed.reduce((s, t) => s + t[0], 0);
  const firstVar = monos.find((m) => m !== '') ?? '';
  return {
    kind: 'expr', expr, answer: F(expr), steps: [grouped, F(expr)],
    traps: monos.length > 1 ? [{ src: fmtTerms([[allSum, firstVar]]), tag: 'concept', msg: 'Hanya suku SEJENIS (variabel & pangkat sama) yang boleh dijumlahkan.' }] : [],
  };
}

/* ---------- Metadata varian ---------- */
export const PROMPT: Record<WbKind, Bi> = {
  expr: bi('Sederhanakan bentuk aljabar', 'Simplify the algebraic expression'),
  equation: bi('Selesaikan persamaan', 'Solve the equation'),
  factor: bi('Faktorkan bentuk aljabar', 'Factor the expression'),
  value: bi('Hitung nilai ekspresi', 'Evaluate the expression'),
  ineq: bi('Selesaikan pertidaksamaan', 'Solve the inequality'),
  roots: bi('Tentukan akar-akar persamaan', 'Find the roots'),
  point: bi('Tentukan titik hasilnya', 'Find the resulting point'),
  rad: bi('Sederhanakan (tulis akar dengan √)', 'Simplify (write roots with √)'),
  matrix: bi('Hitung hasil matriks', 'Compute the resulting matrix'),
};
const VAR_PROMPT: Record<string, Bi> = {
  co_quad: bi('Tentukan kuadran titik (tulis 1–4)', 'Find the quadrant (write 1–4)'),
  fn_val1: bi('Hitung nilai fungsi', 'Evaluate the function'),
  fn_val2: bi('Hitung nilai fungsi', 'Evaluate the function'),
  fn_find: bi('Tentukan x yang memenuhi', 'Find the x that satisfies it'),
  sl_pts: bi('Hitung gradien (pecahan boleh)', 'Find the slope (fractions allowed)'),
  sl_int: bi('Tentukan intersep c', 'Find the intercept c'),
  sl_std: bi('Tentukan gradien garis', 'Find the slope'),
  sys_1: bi('Selesaikan sistem persamaan', 'Solve the system'),
  sys_2: bi('Selesaikan sistem persamaan', 'Solve the system'),
  sys_3: bi('Selesaikan sistem persamaan', 'Solve the system'),
  quad_1: bi('Tentukan akar (pisahkan koma)', 'Find the roots (comma separated)'),
  quad_2: bi('Tentukan akar (pisahkan koma)', 'Find the roots (comma separated)'),
  quad_3: bi('Tentukan akar (pisahkan koma)', 'Find the roots (comma separated)'),
  quad_4: bi('Tentukan akar (pisahkan koma)', 'Find the roots (comma separated)'),
  distribute: bi('Jabarkan dengan sifat distributif', 'Expand using the distributive property'),
  binomial: bi('Jabarkan dan sederhanakan', 'Expand and simplify'),
  poly_mul: bi('Jabarkan dan sederhanakan', 'Expand and simplify'),
  divide: bi('Sederhanakan hasil bagi', 'Simplify the quotient'),
  sq_sum: bi('Jabarkan memakai identitas', 'Expand using the identity'),
  sq_diff: bi('Jabarkan memakai identitas', 'Expand using the identity'),
  diff_sq: bi('Jabarkan memakai identitas', 'Expand using the identity'),
  sq_lin: bi('Jabarkan memakai identitas', 'Expand using the identity'),
  add: bi('Jumlahkan bentuk aljabar', 'Add the algebraic expressions'),
  sub: bi('Kurangkan bentuk aljabar', 'Subtract the algebraic expressions'),
  poly_add: bi('Jumlahkan polinomial', 'Add the polynomials'),
  poly_sub: bi('Kurangkan polinomial', 'Subtract the polynomials'),
  cubic_add: bi('Jumlahkan polinomial', 'Add the polynomials'),
  cubic_sub: bi('Kurangkan polinomial', 'Subtract the polynomials'),
  mixed: bi('Sederhanakan operasi campuran', 'Simplify the mixed operation'),
  rad_1: bi('Sederhanakan bentuk akar', 'Simplify the radical'),
  rad_2: bi('Kalikan lalu sederhanakan', 'Multiply, then simplify'),
  rad_3: bi('Jumlahkan/kurangkan akar sejenis', 'Add/subtract like radicals'),
  rad_4: bi('Sederhanakan tiap akar, lalu gabung', 'Simplify each root, then combine'),
  rad_5: bi('Kalikan bentuk akar', 'Multiply the radicals'),
  lg_1: bi('Hitung nilai logaritma', 'Evaluate the logarithm'),
  lg_2: bi('Hitung nilai logaritma', 'Evaluate the logarithm'),
  lg_3: bi('Tentukan x', 'Find x'),
  lg_4: bi('Hitung (sifat logaritma)', 'Evaluate (log laws)'),
  lg_5: bi('Tentukan basis x', 'Find the base x'),
  qf_5: bi('Tentukan titik puncak (h, k)', 'Find the vertex (h, k)'),
  qf_1: bi('Tentukan sumbu simetri x = …', 'Find the axis of symmetry x = …'),
  qf_2: bi('Tentukan titik puncak (x, y)', 'Find the vertex (x, y)'),
  qf_3: bi('Tentukan nilai maksimum/minimum', 'Find the maximum/minimum value'),
  qf_4: bi('Tentukan titik potong sumbu-x (nilai x, pisahkan koma)', 'Find the x-intercepts (comma separated)'),
  rf_1: bi('Hitung f(x) pada x yang diberikan', 'Evaluate f(x) at the given x'),
  rf_2: bi('Nilai x yang dikecualikan dari domain', 'The x excluded from the domain'),
  rf_3: bi('Tentukan asimtot tegak x = …', 'Find the vertical asymptote x = …'),
  rf_4: bi('Tentukan asimtot datar y = …', 'Find the horizontal asymptote y = …'),
  rf_5: bi('Tentukan titik potong sumbu-x', 'Find the x-intercept'),
  rf_6: bi('Nilai x yang dikecualikan (penyebut = 0, pisahkan koma)', 'Excluded x values (denominator = 0, comma separated)'),
  rd_1: bi('Tentukan domain (isi akar ≥ 0)', 'Find the domain (radicand ≥ 0)'),
  rd_2: bi('Tentukan domain (isi akar ≥ 0)', 'Find the domain (radicand ≥ 0)'),
  rd_3: bi('Hitung f(x) pada x yang diberikan', 'Evaluate f(x) at the given x'),
  rd_4: bi('Selesaikan persamaan akar', 'Solve the radical equation'),
  rd_5: bi('Tentukan nilai minimum f(x)', 'Find the minimum of f(x)'),
  mx_1: bi('Tentukan elemen a_ij (i = baris, j = kolom)', 'Find element a_ij (i = row, j = column)'),
  mx_2: bi('Hitung jumlah diagonal utama', 'Compute the main-diagonal sum'),
  mx_3: bi('Jumlahkan/kurangkan matriks  [[a,b],[c,d]]', 'Add/subtract the matrices  [[a,b],[c,d]]'),
  mx_4: bi('Kalikan skalar dengan matriks', 'Multiply the matrix by the scalar'),
  mo_1: bi('Tentukan transpose matriks', 'Find the transpose'),
  mo_2: bi('Hitung (skalar dahulu, lalu jumlah/kurang)', 'Compute (scalar first, then add/subtract)'),
  mo_3: bi('Hitung elemen c_ij dari hasil kali A × B', 'Compute entry c_ij of the product A × B'),
  mo_4: bi('Kalikan dua matriks 2×2', 'Multiply the two 2×2 matrices'),
  mo_5: bi('Kalikan matriks 2×2 dengan 2×1', 'Multiply the 2×2 by the 2×1 matrix'),
  dt_1: bi('Hitung determinan', 'Compute the determinant'),
  dt_2: bi('Hitung determinan', 'Compute the determinant'),
  dt_3: bi('Tentukan x agar determinan = 0', 'Find x so that det = 0'),
  dt_4: bi('Hitung determinan 3×3 (aturan Sarrus)', 'Compute the 3×3 determinant (Sarrus)'),
  iv_1: bi('Tentukan A⁻¹ (matriks invers)', 'Find A⁻¹ (the inverse matrix)'),
  iv_2: bi('Tentukan A⁻¹ (pecahan boleh, mis. 1/2)', 'Find A⁻¹ (fractions allowed, e.g. 1/2)'),
  iv_3: bi('Tentukan x agar tidak punya invers', 'Find x so there is no inverse'),
  iv_4: bi('Selesaikan dengan invers: tentukan (x, y)', 'Solve using the inverse: find (x, y)'),
};
const TIPS: Record<string, string> = {
  ineq_1: 'Selesaikan seperti persamaan; tanda tetap bila dibagi bilangan positif.',
  ineq_2: 'Dibagi bilangan negatif → balik arah tanda.',
  ineq_3: 'Kumpulkan suku x di satu ruas; periksa tanda koefisien sebelum membagi.',
  co_quad: 'Kuadran I (+,+), II (−,+), III (−,−), IV (+,−).',
  co_reflect: 'Sumbu-y: x ganti tanda. Sumbu-x: y ganti tanda.',
  co_trans: 'Tambahkan komponen vektor ke x dan y masing-masing.',
  co_combo: 'Kerjakan berurutan: cerminkan dahulu, lalu geser. Tulis titik antara.',
  fn_val1: 'Ganti x dengan nilainya, lalu hitung.',
  fn_val2: 'Beri kurung pada nilai negatif saat substitusi.',
  fn_find: 'Samakan f(x) dengan nilai yang diberikan, lalu selesaikan.',
  sl_pts: 'm = (y₂ − y₁)/(x₂ − x₁). Tulis pecahan, mis. 3/2.',
  sl_int: 'c = y − m·x memakai titik yang diberikan.',
  sl_std: 'Ubah ke y = mx + c: m = −a/b.',
  sys_1: 'Jumlahkan atau kurangkan kedua persamaan untuk menghapus satu variabel.',
  sys_2: 'Kurangkan persamaan agar y hilang, cari x, lalu substitusi.',
  sys_3: 'Samakan koefisien satu variabel, eliminasi, lalu substitusi.',
  quad_1: 'Faktorkan, lalu setiap faktor = 0.',
  quad_2: 'Pindahkan semua suku ke satu ruas hingga sama dengan 0, lalu faktorkan.',
  quad_3: 'Keluarkan faktor persekutuan a, lalu faktorkan sisanya.',
  quad_4: 'x² = k² → x = ±k, atau faktorkan (x+k)(x−k).',
  os_add: 'Kurangi kedua ruas dengan konstanta di sisi x.',
  os_sub: 'Tambah kedua ruas dengan konstanta yang dikurangkan.',
  os_mul: 'Bagi kedua ruas dengan koefisien x.',
  os_div: 'Kalikan kedua ruas dengan penyebutnya.',
  eval1: 'Ganti x dengan nilainya (beri kurung), lalu hitung.',
  eval2: 'Beri kurung pada nilai negatif saat substitusi.',
  eval3: 'Hitung pangkat dahulu, baru kali, lalu tambah/kurang.',
  eval4: 'Substitusikan x dan y secara bersamaan.',
  add: 'Hilangkan kurung, lalu kelompokkan suku sejenis.',
  sub: 'Minus di depan kurung mengubah semua tanda di dalamnya.',
  poly_add: 'Kelompokkan suku dengan pangkat yang sama.',
  poly_sub: 'Ubah tanda semua suku kurung kedua, lalu kelompokkan.',
  cubic_add: 'Kelompokkan x³ dengan x³, x² dengan x², dan seterusnya.',
  cubic_sub: 'Ubah tanda semua suku kurung kedua, lalu kelompokkan.',
  distribute: 'Kalikan pengali dengan setiap suku di dalam kurung.',
  binomial: 'Kalikan setiap suku kurung pertama dengan setiap suku kurung kedua.',
  divide: 'Bagi setiap suku pembilang dengan penyebut.',
  mixed: 'Jabarkan semua kurung dahulu, lalu gabungkan suku sejenis.',
  poly_mul: 'Kalikan x, lalu a, dengan setiap suku trinomial.',
  sq_sum: '(a+b)² = a² + 2ab + b².',
  sq_diff: '(a−b)² = a² − 2ab + b².',
  diff_sq: '(a+b)(a−b) = a² − b².',
  sq_lin: 'Tentukan a dan b, lalu terapkan (a±b)² = a² ± 2ab + b².',
  fac_1: 'Cari dua bilangan: jumlahnya = koefisien x, hasil kalinya = konstanta.',
  fac_2: 'Perhatikan tanda: hasil kali negatif berarti kedua bilangan berbeda tanda.',
  fac_3: 'Selisih dua kuadrat: a² − b² = (a+b)(a−b).',
  fac_4: 'Coba kombinasi faktor a dan c, uji suku tengah dengan menjabarkan.',
  exp_mul: 'Basis sama dikali: jumlahkan pangkatnya.',
  exp_mulc: 'Kalikan koefisien, jumlahkan pangkat x.',
  exp_pow: 'Pangkat dari pangkat: kalikan pangkatnya.',
  exp_powc: 'Pangkatkan koefisien, kalikan pangkat x.',
  lin_a: 'Pindahkan konstanta, lalu bagi dengan koefisien x.',
  lin_b: 'Kumpulkan suku x di satu ruas dan konstanta di ruas lain.',
  lin_c: 'Jabarkan kurung dahulu, lalu selesaikan.',
  lin_d: 'Jabarkan kurung, kumpulkan suku x, lalu bagi.',
  rad_1: 'Cari faktor kuadrat sempurna terbesar: √(a²·b) = a√b.',
  rad_2: '√a × √b = √(a·b), lalu sederhanakan.',
  rad_3: 'Seperti suku sejenis: jumlahkan koefisiennya, isi akar tetap.',
  rad_4: 'Sederhanakan tiap akar dahulu supaya isi akarnya sama.',
  rad_5: 'Kalikan koefisien dengan koefisien, isi akar dengan isi akar.',
  lg_1: 'log_b(N) = k berarti b^k = N.',
  lg_2: 'log_b(1) = 0, log_b(b) = 1, log_b(1/b^k) = −k.',
  lg_3: 'log_b(x) = k berarti x = b^k.',
  lg_4: 'Hitung tiap log, lalu jumlah/kurangkan hasilnya.',
  lg_5: 'log_x(N) = k berarti x^k = N.',
  qf_5: 'Bentuk a(x − h)² + k punya puncak (h, k).',
  qf_1: 'Sumbu simetri x = −b/(2a).',
  qf_2: 'Cari h = −b/(2a), lalu substitusi ke y untuk mendapat k.',
  qf_3: 'Nilai ekstrem adalah y di puncak; a > 0 minimum, a < 0 maksimum.',
  qf_4: 'Titik potong sumbu-x: y = 0, faktorkan lalu setiap faktor = 0.',
  rf_1: 'Ganti x, hitung pembilang dan penyebut, lalu bagi.',
  rf_2: 'Penyebut tidak boleh nol: samakan penyebut dengan 0.',
  rf_3: 'Asimtot tegak di x yang membuat penyebut = 0.',
  rf_4: 'Asimtot datar y = a/c (koefisien x pembilang ÷ penyebut).',
  rf_5: 'f(x) = 0 saat pembilang = 0.',
  rf_6: 'Faktorkan penyebut; tiap faktor = 0 menghasilkan x yang dikeluarkan.',
  rd_1: 'Isi akar ≥ 0: selesaikan pertidaksamaannya.',
  rd_2: 'Isi akar ≥ 0. Bila membagi bilangan negatif, balik tanda.',
  rd_3: 'Substitusi x, hitung isi akar, lalu ambil akarnya.',
  rd_4: 'Kuadratkan kedua ruas untuk menghilangkan akar.',
  rd_5: 'Akar paling kecil = 0, sehingga f minimum = konstanta c.',
  mx_1: 'a_ij: baris ke-i, kolom ke-j.',
  mx_2: 'Diagonal utama: a11, a22, ... Jumlahkan.',
  mx_3: 'Operasikan elemen yang bersesuaian posisi. Tulis matriks seperti [[1,2],[3,4]].',
  mx_4: 'Kalikan skalar ke setiap elemen.',
  mo_1: 'Transpose: baris menjadi kolom.',
  mo_2: 'Kalikan skalar ke seluruh matriks, lalu operasikan elemen demi elemen.',
  mo_3: 'c_ij = baris i dari A × kolom j dari B, dijumlahkan.',
  mo_4: 'Baris A × kolom B untuk tiap posisi hasil.',
  mo_5: 'Setiap baris A dikali kolom tunggal, lalu dijumlahkan.',
  dt_1: 'det [[a,b],[c,d]] = ad − bc.',
  dt_2: 'Hati-hati tanda: −(negatif) = positif.',
  dt_3: 'Tulis ad − bc = 0 lalu selesaikan x.',
  dt_4: 'Sarrus: jumlah 3 diagonal utama − jumlah 3 diagonal kedua.',
  iv_1: 'A⁻¹ = (1/det)·[[d,−b],[−c,a]].',
  iv_2: 'Bagi tiap elemen [[d,−b],[−c,a]] dengan determinan.',
  iv_3: 'Tidak punya invers bila determinan = 0.',
  iv_4: 'x,y = A⁻¹ · hasil, atau gunakan eliminasi.',
};
const tip = (v: string): string => TIPS[v] ?? (v.startsWith('lt_') ? 'Kelompokkan suku dengan variabel dan pangkat yang sama.' : 'Kerjakan satu langkah pada satu waktu.');

export const WB_VARIANTS: Record<string, TopicCode> = {
  os_add: 'A01', os_sub: 'A01', os_mul: 'A01', os_div: 'A01',
  eval1: 'A02', eval2: 'A02', eval3: 'A02', eval4: 'A02',
  add: 'A03', sub: 'A03', poly_add: 'A03', poly_sub: 'A03', distribute: 'A03', binomial: 'A03', divide: 'A03', mixed: 'A03',
  lt_1: 'A04', lt_2: 'A04', lt_3: 'A04', lt_4: 'A04', lt_5: 'A04',
  lin_a: 'A05', lin_b: 'A05', lin_c: 'A05', lin_d: 'A05',
  exp_mul: 'A11', exp_mulc: 'A11', exp_pow: 'A11', exp_powc: 'A11',
  cubic_add: 'A14', cubic_sub: 'A14', poly_mul: 'A14',
  sq_sum: 'A15', sq_diff: 'A15', diff_sq: 'A15', sq_lin: 'A15',
  fac_1: 'A16', fac_2: 'A16', fac_3: 'A16', fac_4: 'A16',
  ineq_1: 'A06', ineq_2: 'A06', ineq_3: 'A06',
  co_quad: 'A07', co_reflect: 'A07', co_trans: 'A07', co_combo: 'A07',
  fn_val1: 'A08', fn_val2: 'A08', fn_find: 'A08',
  sl_pts: 'A09', sl_int: 'A09', sl_std: 'A09',
  sys_1: 'A10', sys_2: 'A10', sys_3: 'A10',
  quad_1: 'A17', quad_2: 'A17', quad_3: 'A17', quad_4: 'A17',
  rad_1: 'A12', rad_2: 'A12', rad_3: 'A12', rad_4: 'A12', rad_5: 'A12',
  lg_1: 'A13', lg_2: 'A13', lg_3: 'A13', lg_4: 'A13', lg_5: 'A13',
  qf_5: 'A18', qf_1: 'A18', qf_2: 'A18', qf_3: 'A18', qf_4: 'A18',
  rf_1: 'A19', rf_2: 'A19', rf_3: 'A19', rf_4: 'A19', rf_5: 'A19', rf_6: 'A19',
  rd_1: 'A20', rd_2: 'A20', rd_3: 'A20', rd_4: 'A20', rd_5: 'A20',
  mx_1: 'A22', mx_2: 'A22', mx_3: 'A22', mx_4: 'A22',
  mo_1: 'A23', mo_2: 'A23', mo_3: 'A23', mo_4: 'A23', mo_5: 'A23',
  dt_1: 'A24', dt_2: 'A24', dt_3: 'A24', dt_4: 'A24',
  iv_1: 'A25', iv_2: 'A25', iv_3: 'A25', iv_4: 'A25',
};
/** Varian yang masuk akal per kesulitan (rentang inklusif) untuk mode bebas/Archive. */
export const WB_BY_TOPIC: Partial<Record<TopicCode, Array<[string, number, number]>>> = {
  A01: [['os_add', 1, 3], ['os_sub', 1, 3], ['os_mul', 2, 5], ['os_div', 3, 5]],
  A02: [['eval1', 1, 2], ['eval2', 2, 4], ['eval3', 3, 5], ['eval4', 4, 5]],
  A03: [['add', 1, 3], ['sub', 1, 4], ['poly_add', 2, 4], ['poly_sub', 3, 5], ['distribute', 1, 5], ['binomial', 3, 5], ['divide', 3, 5], ['mixed', 4, 5]],
  A04: [['lt_1', 1, 1], ['lt_2', 1, 2], ['lt_3', 2, 4], ['lt_4', 3, 5], ['lt_5', 4, 5]],
  A05: [['lin_a', 1, 3], ['lin_b', 2, 5], ['lin_c', 3, 5], ['lin_d', 4, 5]],
  A11: [['exp_mul', 1, 3], ['exp_mulc', 2, 4], ['exp_pow', 3, 5], ['exp_powc', 4, 5]],
  A14: [['cubic_add', 1, 3], ['cubic_sub', 2, 5], ['poly_mul', 3, 5]],
  A15: [['sq_sum', 1, 2], ['sq_diff', 2, 4], ['diff_sq', 2, 5], ['sq_lin', 4, 5]],
  A16: [['fac_1', 1, 2], ['fac_2', 2, 4], ['fac_3', 3, 5], ['fac_4', 4, 5]],
  A06: [['ineq_1', 1, 3], ['ineq_2', 2, 5], ['ineq_3', 4, 5]],
  A07: [['co_quad', 1, 2], ['co_reflect', 2, 4], ['co_trans', 2, 4], ['co_combo', 4, 5]],
  A08: [['fn_val1', 1, 3], ['fn_val2', 2, 5], ['fn_find', 3, 5]],
  A09: [['sl_pts', 1, 4], ['sl_int', 2, 5], ['sl_std', 4, 5]],
  A10: [['sys_1', 1, 2], ['sys_2', 2, 4], ['sys_3', 4, 5]],
  A17: [['quad_4', 1, 2], ['quad_1', 1, 3], ['quad_2', 3, 5], ['quad_3', 4, 5]],
  A12: [['rad_1', 1, 2], ['rad_3', 2, 3], ['rad_2', 3, 5], ['rad_4', 4, 5], ['rad_5', 4, 5]],
  A13: [['lg_1', 1, 2], ['lg_2', 2, 3], ['lg_3', 2, 4], ['lg_4', 3, 5], ['lg_5', 4, 5]],
  A18: [['qf_5', 1, 2], ['qf_1', 2, 4], ['qf_2', 3, 5], ['qf_3', 4, 5], ['qf_4', 4, 5]],
  A19: [['rf_1', 1, 2], ['rf_2', 2, 3], ['rf_3', 3, 4], ['rf_4', 4, 5], ['rf_5', 4, 5], ['rf_6', 4, 5]],
  A20: [['rd_1', 1, 2], ['rd_2', 2, 4], ['rd_3', 3, 4], ['rd_4', 4, 5], ['rd_5', 4, 5]],
  A22: [['mx_1', 1, 2], ['mx_2', 2, 3], ['mx_3', 2, 5], ['mx_4', 3, 5]],
  A23: [['mo_1', 1, 2], ['mo_2', 2, 4], ['mo_3', 3, 4], ['mo_4', 4, 5], ['mo_5', 4, 5]],
  A24: [['dt_1', 1, 2], ['dt_2', 2, 4], ['dt_3', 3, 5], ['dt_4', 4, 5]],
  A25: [['iv_1', 1, 2], ['iv_2', 2, 4], ['iv_3', 3, 4], ['iv_4', 4, 5]],
};
export const hasWb = (t: TopicCode): boolean => !!WB_BY_TOPIC[t];
export function variantsFor(topic: TopicCode, target: number): string[] {
  const all = WB_BY_TOPIC[topic] ?? [];
  const f = all.filter(([, lo, hi]) => target >= lo && target <= hi).map(([v]) => v);
  return f.length ? f : all.map(([v]) => v);
}

export function genWb(variant: string, seed: number, difficulty: number): WbQuestion {
  const make = M[variant];
  if (!make) throw new Error(`Varian Workboard tidak dikenal: ${variant}`);
  const topic = WB_VARIANTS[variant];
  const r = new Rng(seed ^ (variant.length * 2654435761));
  const d = Math.max(1, Math.min(5, difficulty));
  const b = make(r, d);
  const expr = b.expr;
  const traps = b.traps.filter((t) => !trapEqualsAnswer(b, t));
  const hints = [TOPIC_BY_CODE[topic].concept, tip(variant), b.kind === 'equation' || b.kind === 'ineq' ? 'Lakukan operasi yang sama pada kedua ruas.' : 'Tuliskan setiap langkah pada Work Area; satu perubahan per baris.', b.steps[0] ?? '', b.steps.join('  →  ')];
  return {
    ...b, traps, id: `wb-${variant}-${seed}`, topic, variant, seed, difficulty: d,
    prompt: VAR_PROMPT[variant] ?? PROMPT[b.kind], hints,
    signature: `wb|${variant}|${expr.replace(/\s+/g, '')}`,
    shape: `${variant}|${expr.replace(/\s+/g, '').replace(/\d+/g, '#')}`,
  };
}

function trapEqualsAnswer(b: ReturnType<Make>, t: Trap): boolean {
  try {
    if (b.kind === 'equation') return rootOf(t.src) === rootOf(b.answer);
    if (b.kind === 'ineq') return ineqKey(t.src) === ineqKey(b.answer);
    if (b.kind === 'roots') return rootsOf(t.src) === rootsOf(b.answer);
    if (b.kind === 'point') return JSON.stringify(pointOf(t.src)) === JSON.stringify(pointOf(b.answer));
    if (b.kind === 'rad') {
      const x = evalRad(t.src);
      const y = evalRad(b.answer);
      return x === null || y === null || radClose(x, y);
    }
    if (b.kind === 'matrix') {
      const x = parseMat(t.src);
      const y = parseMat(b.answer);
      return !x || !y || matEq(x, y);
    }
    if (b.kind === 'value') return pFormat(parseExpr(t.src)) === pFormat(parseExpr(b.answer));
    return pFormat(parseExpr(t.src)) === pFormat(parseExpr(b.answer));
  } catch {
    return true;
  }
}

/** Akar persamaan linear satu variabel x (string "p/q" atau null bila bukan linear x). */
export function rootOf(line: string): string | null {
  const rel = parseRelation(line);
  if (rel.rel !== '=') return null;
  const d = sub0(rel.lhs, rel.rhs);
  if (pDegree(d, 'x') !== 1 || Array.from(d.keys()).some((k) => k !== '' && k !== 'x:1')) return null;
  const a = pCoeff(d, 'x', 1);
  const c = pCoeff(d, 'x', 0);
  return fmtQ(div(neg(c), a));
}
function sub0(a: Map<string, Q>, b: Map<string, Q>): Map<string, Q> {
  const out = new Map(a);
  for (const [k, v] of b) {
    const cur = out.get(k);
    const nv = cur ? sub(cur, v) : neg(v);
    if (nv.n === 0) out.delete(k);
    else out.set(k, nv);
  }
  return out;
}

export const wbLabel = (v: string): string => (VAR_PROMPT[v] ?? PROMPT.expr).id;
