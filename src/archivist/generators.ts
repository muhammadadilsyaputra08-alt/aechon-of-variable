/** Question Generator: membuat kandidat soal dari template + parameter konsep. Belum divalidasi. */
import { Bi, bi, TopicCode, TOPIC_BY_CODE } from '../data/topics';
import { Rng, hashStr } from './rng';
import { Candidate, CheckKind, Knob, knob, A, Answer } from './types';
import { mat, matMul, inverse } from '../math/solve';
import { fmtQ } from '../math/rational';

type Draft = Pick<Candidate, 'kind' | 'mechanic' | 'title' | 'prompt' | 'data' | 'display' | 'knobs' | 'intended' | 'multiSolution'> & { misconceptions?: string[] };
type Gen = (r: Rng, d: number) => Draft;

export function fmtTerms(terms: Array<[number, string]>): string {
  let s = '';
  for (const [c, v] of terms) {
    if (c === 0) continue;
    const a = Math.abs(c);
    const body = v === '' ? String(a) : a === 1 ? v : `${a}${v}`;
    s += s === '' ? (c < 0 ? '-' : '') + body : ` ${c < 0 ? '-' : '+'} ${body}`;
  }
  return s || '0';
}
const MISC: Partial<Record<CheckKind, string[]>> = {
  balance: ['Mengubah satu sisi saja tanpa melakukan hal yang sama di sisi lain.', 'Salah tanda saat memindahkan konstanta.'],
  simplify: ['Menggabungkan suku yang tidak sejenis (mis. x dengan x²).', 'Lupa mengalikan semua suku di dalam kurung.'],
  ineq: ['Lupa membalik tanda saat membagi dengan bilangan negatif.', 'Tertukar titik kosong (<, >) dan titik penuh (≤, ≥).'],
  line: ['Tertukar gradien dengan intersep.', 'Terbalik: selisih y dibagi selisih x, bukan sebaliknya.'],
  dual: ['Hanya mencocokkan satu persamaan.'],
  factor: ['Tanda p dan q tertukar.', 'Lupa memeriksa jumlah dan hasil kali sekaligus.'],
  roots: ['Lupa tanda saat akar = −konstanta faktor.'],
  exponent: ['Mengalikan pangkat padahal seharusnya menjumlahkan.'],
  expand: ['Lupa suku tengah 2ab pada (a + b)².'],
  domain: ['Mengira x = 0 yang dilarang, padahal yang dilarang adalah pembuat penyebut nol.'],
  det: ['Tertukar ad − bc menjadi bc − ad.'],
  matop: ['Mengalikan elemen sejajar, bukan baris × kolom.'],
  complex: ['Lupa bahwa i² = −1.'],
  eigen: ['Mengira eigenvector berubah arah setelah transformasi.'],
};
const sgnr = (r: Rng): number => (r.chance(0.5) ? 1 : -1);
const clampd = (d: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, d));
const vecStr = (v: number[]): string => `(${v.join(', ')})`;
const matLines = (M: number[][]): string => M.map((r) => `[${r.join(' ')}]`).join(' ');

/* ========== Tier I ========== */
const genA01: Gen = (r, d) => {
  const x = r.int(1, 4 + 2 * d);
  const form = d >= 2 && r.chance(0.5);
  let e: string;
  if (form) {
    const a = r.int(2, 3);
    e = `${a}x = ${a * x}`;
  } else {
    const b = r.int(1, 5 + d);
    e = `x + ${b} = ${x + b}`;
  }
  return {
    kind: 'balance', mechanic: 'balance_scale', title: bi('Peti Misteri', 'The Mystery Chest'),
    prompt: bi('Temukan nilai kristal emas x agar timbangan seimbang', 'Find the gold crystal value x to balance the scale'),
    data: { eq: e, simple: true }, display: [e], knobs: [knob('x', 'x', -30, 60, 1, 0)], intended: A({ x }), multiSolution: false,
  };
};
const genA05: Gen = (r, d) => {
  const x = r.int(1, 5 + 2 * d);
  const a = d <= 2 ? r.int(1, 3) : r.int(2, 5);
  const c = d >= 4 ? r.int(1, a - 1) : 0;
  const b = d === 1 || d === 2 ? (d === 1 ? r.int(1, 6) : 0) : r.int(1, 8);
  const aa = d === 1 ? 1 : a;
  const cc = d >= 4 ? Math.min(c, aa - 1) : 0;
  const rhsConst = (aa - cc) * x + b;
  const lhs = fmtTerms([[aa, 'x'], [b, '']]);
  const rhs = cc > 0 ? fmtTerms([[cc, 'x'], [rhsConst, '']]) : String(rhsConst);
  const e = `${lhs} = ${rhs}`;
  return {
    kind: 'balance', mechanic: 'balance_scale', title: bi('Foundation Core', 'The Foundation Core'),
    prompt: bi('Seimbangkan timbangan: temukan nilai x', 'Balance the scale: find x'),
    data: { eq: e }, display: [e], knobs: [knob('x', 'x', -30, 60, 1, 0)], intended: A({ x }), multiSolution: false,
  };
};
const genA02: Gen = (r, d) => {
  const a = sgnr(r) * r.int(1, 9);
  const b = sgnr(r) * r.int(1, 9);
  const c = sgnr(r) * r.int(1, 9);
  let expr: string;
  let coefx: number;
  let konst: number;
  let terms = 2;
  if (d <= 2) {
    expr = fmtTerms([[a, 'x'], [b, '']]);
    coefx = a;
    konst = b;
  } else if (d === 3) {
    expr = fmtTerms([[a, 'x'], [b, 'y'], [c, '']]);
    coefx = a;
    konst = c;
    terms = 3;
  } else {
    expr = fmtTerms([[a, 'x^2'], [b, 'x'], [c, '']]);
    coefx = b;
    konst = c;
    terms = 3;
  }
  return {
    kind: 'classify', mechanic: 'symbol_blocks', title: bi('Blok Simbol', 'Symbol Blocks'),
    prompt: bi('Analisis ekspresi: banyak suku, koefisien x, dan konstanta', 'Analyze: number of terms, coefficient of x, and constant'),
    data: { expr }, display: [expr],
    knobs: [knob('terms', 'Suku', 1, 6, 1, 1), knob('coef', 'Koef. x', -12, 12, 1, 0), knob('konst', 'Konstanta', -12, 12, 1, 0)],
    intended: A({ terms, coef: coefx, konst }), multiSolution: false,
  };
};
const simplifyKnobs = (deg: number): Knob[] => Array.from({ length: deg + 1 }, (_, i) => deg - i).map((i) => knob(`c${i}`, i === 0 ? 'Konst.' : i === 1 ? 'Koef. x' : `Koef. x²`, -40, 40, 1, 0));
const genA03: Gen = (r, d) => {
  const a = r.int(2, 4);
  const b = sgnr(r) * r.int(1, 6);
  const c = r.int(2, 5);
  const e = r.int(1, 6);
  let expr: string;
  switch (clampd(d, 1, 5)) {
    case 1: expr = `${a}(x ${b < 0 ? '-' : '+'} ${Math.abs(b)})`; break;
    case 2: expr = `${a}(x ${b < 0 ? '-' : '+'} ${Math.abs(b)}) + ${e}`; break;
    case 3: expr = r.chance(0.5) ? `${a * c}x + ${a * e}) ÷ ${a}`.replace(/^/, '(') : `${a}(${c}x + ${e}) + ${r.int(2, 5)}x`; break;
    case 4: expr = `${a}(${c}x - ${e}) - ${r.int(2, 4)}(x + ${r.int(1, 4)})`; break;
    default: expr = `${a}(${c}x + ${e}) - ${r.int(2, 4)}(${r.int(2, 4)}x - ${r.int(1, 5)}) + ${r.int(1, 9)}`;
  }
  return {
    kind: 'simplify', mechanic: 'symbol_blocks', title: bi('Operasi Aljabar', 'Algebraic Operations'),
    prompt: bi('Sederhanakan ekspresi aljabar', 'Simplify the algebraic expression'),
    data: { expr, deg: 1 }, display: [expr], knobs: simplifyKnobs(1), intended: null, multiSolution: false,
  };
};
const genA04: Gen = (r, d) => {
  const n = () => sgnr(r) * r.int(1, 8);
  let expr: string;
  let deg = 1;
  if (d === 1) expr = fmtTerms([[r.int(1, 6), 'x'], [r.int(1, 6), 'x']]);
  else if (d === 2) expr = fmtTerms([[r.int(1, 6), 'x'], [r.int(1, 8), ''], [r.int(1, 6), 'x'], [r.int(1, 8), '']]);
  else if (d === 3) expr = fmtTerms([[n(), 'x'], [n(), ''], [n(), 'x'], [n(), '']]);
  else {
    deg = 2;
    expr = fmtTerms([[r.int(1, 5), 'x^2'], [n(), 'x'], [r.int(1, 5), 'x^2'], [n(), 'x'], [n(), '']]);
  }
  if (d === 5) {
    deg = 2;
    expr = fmtTerms([[n(), 'x^2'], [n(), 'x'], [n(), ''], [n(), 'x^2'], [n(), 'x'], [n(), '']]);
  }
  return {
    kind: 'simplify', mechanic: 'crystal_merge', title: bi('Gabung Kristal', 'Merge Crystals'),
    prompt: bi('Gabungkan suku sejenis', 'Combine like terms'),
    data: { expr, deg }, display: [expr], knobs: simplifyKnobs(deg), intended: null, multiSolution: false,
  };
};

/* ========== Tier II ========== */
const genA06: Gen = (r, d) => {
  const x0 = r.int(-6, 8);
  const ops = ['<', '≤', '>', '≥'];
  const op = r.pick(ops);
  let a: number;
  let b: number;
  let ineq: string;
  if (d === 1) {
    a = 1; b = r.int(1, 6);
    ineq = `${fmtTerms([[a, 'x'], [b, '']])} ${op} ${a * x0 + b}`;
  } else if (d === 2) {
    a = r.int(2, 4); b = 0;
    ineq = `${fmtTerms([[a, 'x']])} ${op} ${a * x0}`;
  } else if (d === 3) {
    a = r.int(2, 4); b = sgnr(r) * r.int(1, 6);
    ineq = `${fmtTerms([[a, 'x'], [b, '']])} ${op} ${a * x0 + b}`;
  } else if (d === 4) {
    a = -r.int(1, 4); b = r.int(1, 8);
    ineq = `${fmtTerms([[a, 'x'], [b, '']])} ${op} ${a * x0 + b}`;
  } else {
    a = r.int(2, 5); const c = r.int(1, a - 1); b = sgnr(r) * r.int(1, 6);
    ineq = `${fmtTerms([[a, 'x'], [b, '']])} ${op} ${fmtTerms([[c, 'x'], [(a - c) * x0 + b, '']])}`;
  }
  return {
    kind: 'ineq', mechanic: 'boundary_field', title: bi('Medan Batas', 'Boundary Field'),
    prompt: bi('Tentukan batas solusi, arah, dan jenis titiknya', 'Set the boundary, direction and endpoint type'),
    data: { ineq }, display: [ineq],
    knobs: [knob('bound', 'Batas', -30, 30, 1, 0), knob('dir', 'Arah', 0, 1, 1, 0, ['x <', 'x >']), knob('incl', 'Titik', 0, 1, 1, 0, ['kosong', 'penuh'])],
    intended: null, multiSolution: false,
  };
};
const genA07: Gen = (r, d) => {
  const nz = () => sgnr(r) * r.int(1, 6);
  const px = nz();
  const py = nz();
  const modes = d <= 1 ? ['quadrant'] : d === 2 ? ['plot'] : d === 3 ? ['reflect-y', 'reflect-x'] : ['translate'];
  const mode = r.pick(modes);
  const tx = r.int(-3, 3);
  const ty = r.int(-3, 3);
  const prompts: Record<string, Bi> = {
    quadrant: bi('Di kuadran berapa titik energi ini berada?', 'Which quadrant holds this energy point?'),
    plot: bi('Tempatkan kristal energi pada titik koordinat', 'Place the energy crystal on the target coordinate'),
    'reflect-y': bi('Cerminkan titik terhadap sumbu-y lalu tempatkan', 'Reflect the point over the y-axis and place it'),
    'reflect-x': bi('Cerminkan titik terhadap sumbu-x lalu tempatkan', 'Reflect the point over the x-axis and place it'),
    translate: bi('Geser titik sesuai vektor lalu tempatkan', 'Shift the point by the vector and place it'),
  };
  const disp = mode === 'translate' ? [`P = ${vecStr([px, py])}`, `geser ${vecStr([tx, ty])}`] : [`P = ${vecStr([px, py])}`];
  return {
    kind: 'coord', mechanic: 'coordinate_grid', title: bi('Koordinat Kartesius', 'Cartesian Grid'), prompt: prompts[mode],
    data: { mode, px, py, tx, ty }, display: disp,
    knobs: mode === 'quadrant' ? [knob('qd', 'Kuadran', 1, 4, 1, 1)] : [knob('x', 'x', -8, 8, 1, 0), knob('y', 'y', -8, 8, 1, 0)],
    intended: null, multiSolution: false,
  };
};
function linePts(r: Rng, m: number, c: number, n: number, nonZeroX: boolean): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < 80 && out.length < n; i++) {
    const x = r.int(-5, 5);
    if (nonZeroX && x === 0) continue;
    const y = m * x + c;
    if (!Number.isInteger(y) || Math.abs(y) > 6 || out.some((p) => p[0] === x)) continue;
    out.push([x, y]);
  }
  return out;
}
const genLine = (mode: 'slope' | 'm' | 'mc', title: Bi): Gen => (r, d) => {
  const half = d >= 3;
  const m = (half ? r.pick([-2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2]) : sgnr(r) * r.int(1, 2));
  const c = r.int(-3, 3);
  const pts = linePts(r, m, c, mode === 'm' ? 1 : 2, mode !== 'slope');
  const display = mode === 'm' ? [`y = mx + ${c < 0 ? `(${c})` : c}`, `titik ${vecStr(pts[0] ?? [0, 0])}`] : [`titik ${vecStr(pts[0] ?? [0, 0])}`, `titik ${vecStr(pts[1] ?? [0, 0])}`];
  return {
    kind: 'line', mechanic: 'energy_rail', title,
    prompt: mode === 'slope' ? bi('Atur gradien m agar jalur melewati kedua titik', 'Set slope m so the rail passes both points') : mode === 'm' ? bi('Atur gradien agar jalur mengenai titik tujuan', 'Set the slope to hit the target') : bi('Atur gradien m dan intersep c agar mengenai kedua titik', 'Set slope m and intercept c to hit both points'),
    data: { mode, c, pts }, display,
    knobs: mode === 'mc' ? [knob('m', 'm', -4, 4, half ? 0.5 : 1, 0), knob('c', 'c', -6, 6, 1, 0)] : [knob('m', 'm', -4, 4, half ? 0.5 : 1, 0)],
    intended: mode === 'mc' ? A({ m, c }) : A({ m }), multiSolution: false,
  };
};
const genA09: Gen = (r, d) => (d <= 2 ? genLine('slope', bi('Gradien Jalur', 'Rail Gradient')) : genLine('m', bi('Gradien Jalur', 'Rail Gradient')))(r, d);
const genA08: Gen = (r, d) => (d <= 2 ? genLine('m', bi('Fungsi Linear', 'Linear Function')) : genLine('mc', bi('Fungsi Linear', 'Linear Function')))(r, d);
const genA10: Gen = (r, d) => {
  const x0 = r.int(-4, 5);
  const y0 = r.int(-4, 6);
  let eqs: string[] = [];
  for (let t = 0; t < 30; t++) {
    if (d <= 2) {
      const m1 = r.int(-3, 3);
      const m2 = r.int(-3, 3);
      if (m1 === m2) continue;
      const c1 = y0 - m1 * x0;
      const c2 = y0 - m2 * x0;
      if (Math.abs(c1) > 9 || Math.abs(c2) > 9) continue;
      eqs = [`y = ${fmtTerms([[m1, 'x'], [c1, '']])}`, `y = ${fmtTerms([[m2, 'x'], [c2, '']])}`];
    } else {
      const a1 = r.nonZero(-3, 3), b1 = r.nonZero(-3, 3), a2 = r.nonZero(-3, 3), b2 = r.nonZero(-3, 3);
      if (a1 * b2 - a2 * b1 === 0) continue;
      eqs = [`${fmtTerms([[a1, 'x'], [b1, 'y']])} = ${a1 * x0 + b1 * y0}`, `${fmtTerms([[a2, 'x'], [b2, 'y']])} = ${a2 * x0 + b2 * y0}`];
    }
    break;
  }
  return {
    kind: 'dual', mechanic: 'dual_gate', title: bi('Gerbang Ganda', 'Dual Gate'),
    prompt: bi('Temukan titik perpotongan kedua jalur energi', 'Find the point where both energy rails meet'),
    data: { eqs }, display: eqs, knobs: [knob('x', 'x', -9, 9, 1, 0), knob('y', 'y', -9, 9, 1, 0)], intended: A({ x: x0, y: y0 }), multiSolution: false,
  };
};

/* ========== Tier III ========== */
const genA11: Gen = (r, d) => {
  const b = d >= 4 ? r.int(2, 3) : r.int(2, 5);
  const cap = b >= 5 ? 6 : b === 4 ? 8 : 12;
  let expr: string;
  if (d === 1) { const m = r.int(1, 4), n = r.int(1, 4); expr = `${b}^${m} × ${b}^${n}`; }
  else if (d === 2) { const n = r.int(1, 4), m = n + r.int(1, Math.max(1, cap - n - 1)); expr = `${b}^${m} ÷ ${b}^${n}`; }
  else if (d === 3) { const m = r.int(2, 4), n = r.int(2, 3); expr = `(${b}^${m})^${n}`; }
  else { const m = r.int(2, 5), n = r.int(1, 4), p = r.int(1, m + n - 1); expr = `${b}^${m} × ${b}^${n} ÷ ${b}^${p}`; }
  return {
    kind: 'exponent', mechanic: 'exponent_reactor', title: bi('Reaktor Eksponen', 'Exponent Reactor'),
    prompt: bi('Gabungkan sumber energi: berapa pangkat akhirnya?', 'Combine the energy sources: what is the final exponent?'),
    data: { expr, base: b, mode: 'combine' }, display: [`${expr} = ${b}^?`], knobs: [knob('e', 'Pangkat', 0, 30, 1, 0)], intended: null, multiSolution: false,
  };
};
const genA12: Gen = (r, d) => {
  if (d >= 3 && r.chance(0.6)) {
    const rr = r.pick([2, 3, 5, 6, 7]);
    const p = r.int(2, 9), q = r.int(2, 9);
    return {
      kind: 'radical', mechanic: 'radical_stabilizer', title: bi('Stabilkan Energi', 'Stabilize Energy'),
      prompt: bi('Jumlahkan akar sejenis', 'Add like radicals'),
      data: { mode: 'add', r: rr, p, qq: q }, display: [`${p}√${rr} + ${q}√${rr} = k√${rr}`], knobs: [knob('k', 'k', 0, 40, 1, 0)], intended: A({ k: p + q }), multiSolution: false,
    };
  }
  const a = r.int(2, d >= 4 ? 7 : 4);
  const b = r.pick([2, 3, 5, 6, 7, 10]);
  const n = a * a * b;
  return {
    kind: 'radical', mechanic: 'radical_stabilizer', title: bi('Stabilkan Energi', 'Stabilize Energy'),
    prompt: bi('Sederhanakan √n menjadi a√b', 'Simplify √n into a√b'),
    data: { mode: 'simplify', n }, display: [`√${n} = a√b`], knobs: [knob('a', 'a', 1, 12, 1, 1), knob('b', 'b', 1, 30, 1, 1)], intended: A({ a, b }), multiSolution: false,
  };
};
const genA13: Gen = (r, d) => {
  const b = r.int(2, d >= 4 ? 9 : 5);
  const k = r.int(1, d >= 4 ? 5 : 4);
  const N = b ** k;
  if (d <= 2) return { kind: 'log', mechanic: 'log_archive', title: bi('Arsip Logaritma', 'Logarithmic Archive'), prompt: bi('Cari pangkat yang hilang', 'Find the missing exponent'), data: { mode: 'value', b, k, N }, display: [`log_${b}(${N}) = ?`, `${b}^? = ${N}`], knobs: [knob('k', 'k', 0, 20, 1, 0)], intended: A({ k }), multiSolution: false };
  if (d === 3) return { kind: 'log', mechanic: 'log_archive', title: bi('Arsip Logaritma', 'Logarithmic Archive'), prompt: bi('Cari basis yang hilang', 'Find the missing base'), data: { mode: 'base', b, k, N }, display: [`log_?(${N}) = ${k}`], knobs: [knob('b', 'basis', 2, 12, 1, 2)], intended: A({ b }), multiSolution: false };
  return { kind: 'log', mechanic: 'log_archive', title: bi('Arsip Logaritma', 'Logarithmic Archive'), prompt: bi('Cari nilai yang hilang di dalam logaritma', 'Find the missing argument'), data: { mode: 'arg', b, k, N }, display: [`log_${b}(?) = ${k}`], knobs: [knob('N', 'N', 1, 2000, 1, 1)], intended: A({ N }), multiSolution: false };
};
const expandKnobs = (deg: number): Knob[] => Array.from({ length: deg + 1 }, (_, i) => deg - i).map((i) => knob(`c${i}`, i === 0 ? 'Konst.' : i === 1 ? 'Koef. x' : i === 2 ? 'Koef. x²' : 'Koef. x³', -60, 60, 1, 0));
const genA14: Gen = (r, d) => {
  const p = r.nonZero(-6, 6), q = r.nonZero(-6, 6);
  let expr: string;
  let deg = 2;
  if (d <= 2) expr = `(${fmtTerms([[1, 'x'], [p, '']])})(${fmtTerms([[1, 'x'], [q, '']])})`;
  else if (d === 3) expr = `(${fmtTerms([[r.int(1, 3), 'x'], [p, '']])})(${fmtTerms([[r.int(1, 3), 'x'], [q, '']])})`;
  else if (d === 4) expr = `(${fmtTerms([[r.int(1, 3), 'x^2'], [p, 'x'], [q, '']])}) ${r.chance(0.5) ? '+' : '-'} (${fmtTerms([[r.int(1, 3), 'x^2'], [r.nonZero(-5, 5), 'x'], [r.nonZero(-5, 5), '']])})`;
  else { deg = 3; expr = `(${fmtTerms([[1, 'x'], [p, '']])})(${fmtTerms([[1, 'x^2'], [q, 'x'], [r.nonZero(-4, 4), '']])})`; }
  return {
    kind: 'expand', mechanic: 'polynomial_blocks', title: bi('Blok Polinomial', 'Polynomial Blocks'),
    prompt: bi('Gabungkan blok: jabarkan dan sederhanakan', 'Combine the blocks: expand and simplify'),
    data: { expr, deg }, display: [expr], knobs: expandKnobs(deg), intended: null, multiSolution: false,
  };
};
const genA15: Gen = (r, d) => {
  const a = r.int(1, 9);
  const k = r.int(2, 3);
  const forms: string[] = d <= 2 ? [`(x + ${a})^2`, `(x - ${a})^2`] : d === 3 ? [`(x + ${a})(x - ${a})`, `(x + ${a})^2`] : d === 4 ? [`(${k}x + ${r.int(1, 5)})^2`, `(${k}x + ${a})(${k}x - ${a})`, `(${k}x - ${r.int(1, 5)})^2`] : [`(x + ${r.int(1, 3)})^3`, `(x - ${r.int(1, 3)})^3`];
  const expr = r.pick(forms);
  const deg = expr.endsWith('^3') ? 3 : 2;
  return {
    kind: 'expand', mechanic: 'polynomial_blocks', title: bi('Kombinasi Identitas', 'Identity Combination'),
    prompt: bi('Gunakan identitas aljabar untuk menjabarkan', 'Use algebraic identities to expand'),
    data: { expr, deg }, display: [expr], knobs: expandKnobs(deg), intended: null, multiSolution: false,
  };
};
const genA16: Gen = (r, d) => {
  const lead = d >= 4 ? r.int(2, 3) : 1;
  const p = r.nonZero(-8, 8);
  const q = r.nonZero(-8, 8);
  const poly = fmtTerms([[lead, 'x^2'], [q + lead * p, 'x'], [p * q, '']]);
  return {
    kind: 'factor', mechanic: 'factor_machine', title: bi('Mesin Faktor', 'Factor Machine'),
    prompt: bi(lead === 1 ? 'Faktorkan: (x + p)(x + q)' : `Faktorkan: (x + p)(${lead}x + q)`, lead === 1 ? 'Factor: (x + p)(x + q)' : `Factor: (x + p)(${lead}x + q)`),
    data: { poly, lead }, display: [poly], knobs: [knob('p', 'p', -20, 20, 1, 0), knob('q', 'q', -20, 20, 1, 0)], intended: A({ p, q }), multiSolution: false,
  };
};
const genA17: Gen = (r, d) => {
  const r1 = r.int(-7, 7);
  const r2 = r.int(-7, 7);
  const a = d >= 3 ? r.int(2, 3) : 1;
  if (d === 4) {
    const aa = r.int(1, 3), b = r.int(-6, 6), c = r.int(-6, 6);
    const e = `${fmtTerms([[aa, 'x^2'], [b, 'x'], [c, '']])} = 0`;
    return { kind: 'roots', mechanic: 'factor_machine', title: bi('Diskriminan', 'The Discriminant'), prompt: bi('Hitung diskriminan D = b² − 4ac', 'Compute the discriminant D = b² − 4ac'), data: { eq: e, mode: 'disc' }, display: [e], knobs: [knob('D', 'D', -100, 200, 1, 0)], intended: A({ D: b * b - 4 * aa * c }), multiSolution: false };
  }
  let e = `${fmtTerms([[a, 'x^2'], [-a * (r1 + r2), 'x'], [a * r1 * r2, '']])} = 0`;
  if (d === 5) {
    const lhs = fmtTerms([[1, 'x^2'], [-(r1 + r2), 'x']]);
    e = `${lhs} = ${-r1 * r2}`;
  }
  return {
    kind: 'roots', mechanic: 'factor_machine', title: bi('Akar Persamaan', 'Equation Roots'),
    prompt: bi('Aktifkan kedua titik akar (urutan bebas)', 'Activate both root points (any order)'),
    data: { eq: e, mode: 'roots' }, display: [e], knobs: [knob('r1', 'Akar 1', -20, 20, 1, 0), knob('r2', 'Akar 2', -20, 20, 1, 0)], intended: A({ r1, r2 }), multiSolution: false,
  };
};
const genA18: Gen = (r, d) => {
  const half = d >= 4;
  const a = half ? r.pick([-2, -1, -0.5, 0.5, 1, 2]) : r.pick([-2, -1, 1, 2]);
  const b = r.int(-4, 4);
  const c = r.int(-4, 4);
  const need = d === 1 ? 1 : d === 2 ? 2 : 3;
  const fixed: Record<string, number> = d === 1 ? { a, b } : d === 2 ? { a } : {};
  const cand: number[][] = [];
  for (let x = -5; x <= 5; x++) {
    const y = a * x * x + b * x + c;
    if (Number.isInteger(y) && Math.abs(y) <= 8) cand.push([x, y]);
  }
  const pts = r.shuffle(cand).slice(0, need);
  const knobs = [
    ...(fixed.a === undefined ? [knob('a', 'a', -3, 3, 0.5, 1)] : []),
    ...(fixed.b === undefined ? [knob('b', 'b', -6, 6, 1, 0)] : []),
    knob('c', 'c', -8, 8, 1, 0),
  ];
  const intended: Answer = A({ ...(fixed.a === undefined ? { a } : {}), ...(fixed.b === undefined ? { b } : {}), c });
  return {
    kind: 'parabola', mechanic: 'parabolic_launcher', title: bi('Peluncur Parabola', 'Parabolic Launcher'),
    prompt: bi('Atur parabola agar melewati semua cincin energi', 'Shape the parabola to pass through every ring'),
    data: { pts, fixed }, display: [`y = ax² + bx + c`, ...(fixed.a !== undefined ? [`a = ${fixed.a}`] : []), ...(fixed.b !== undefined ? [`b = ${fixed.b}`] : [])],
    knobs, intended, multiSolution: false,
  };
};
const genA19: Gen = (r, d) => {
  if (d >= 4) {
    const p = r.int(1, 6), q = r.int(-6, -1);
    const den = fmtTerms([[1, 'x^2'], [-(p + q), 'x'], [p * q, '']]);
    return { kind: 'domain', mechanic: 'rational_bridge', title: bi('Jembatan Rasional', 'Rational Bridge'), prompt: bi('Temukan dua nilai x yang dilarang', 'Find the two forbidden x values'), data: { mode: 'rational2', num: '1', den }, display: [`f(x) = 1 / (${den})`], knobs: [knob('h1', 'x₁', -12, 12, 1, 0), knob('h2', 'x₂', -12, 12, 1, 0)], intended: A({ h1: Math.min(p, q), h2: Math.max(p, q) }), multiSolution: false };
  }
  const h = r.int(-8, 8);
  const k = d >= 3 ? r.int(2, 3) : 1;
  const den = fmtTerms([[k, 'x'], [-k * h, '']]);
  const num = r.pick(['1', '2', '3']);
  return { kind: 'domain', mechanic: 'rational_bridge', title: bi('Jembatan Rasional', 'Rational Bridge'), prompt: bi('Temukan nilai x yang tidak boleh dilewati jembatan', 'Find the x the bridge must avoid'), data: { mode: 'rational', num, den }, display: [`f(x) = ${num} / (${den})`], knobs: [knob('h', 'x terlarang', -15, 15, 1, 0)], intended: A({ h }), multiSolution: false };
};
const genA20: Gen = (r, d) => {
  const a = d >= 3 ? r.int(2, 3) : 1;
  const root = r.int(-6, 6);
  const sign = d >= 4 ? -1 : 1;
  const radicand = fmtTerms([[sign * a, 'x'], [-sign * a * root, '']]);
  return {
    kind: 'domain', mechanic: 'rational_bridge', title: bi('Akar Resonansi', 'Radical Resonance'),
    prompt: bi('Tentukan batas domain agar isi akar tidak negatif', 'Find the domain boundary so the radicand is non-negative'),
    data: { mode: 'radical', radicand }, display: [`f(x) = √(${radicand})`, 'isi akar ≥ 0'],
    knobs: [knob('bound', 'Batas', -20, 20, 1, 0), knob('dir', 'Arah', 0, 1, 1, 0, ['x ≤', 'x ≥'])], intended: A({ bound: root, dir: sign > 0 ? 1 : 0 }), multiSolution: false,
  };
};

/* ========== Tier IV ========== */
const genA21: Gen = (r, d) => {
  const sol = [r.int(-3, 5), r.int(-3, 5), r.int(-3, 5)];
  const eqs: string[] = [];
  for (let t = 0; t < 60; t++) {
    const rows = [0, 1, 2].map(() => [0, 1, 2].map(() => (d <= 2 ? r.int(0, 2) : r.int(-3, 3))));
    const dt = rows[0][0] * (rows[1][1] * rows[2][2] - rows[1][2] * rows[2][1]) - rows[0][1] * (rows[1][0] * rows[2][2] - rows[1][2] * rows[2][0]) + rows[0][2] * (rows[1][0] * rows[2][1] - rows[1][1] * rows[2][0]);
    if (dt === 0 || rows.some((row) => row.every((v) => v === 0))) continue;
    eqs.length = 0;
    for (const row of rows) eqs.push(`${fmtTerms([[row[0], 'x'], [row[1], 'y'], [row[2], 'z']])} = ${row[0] * sol[0] + row[1] * sol[1] + row[2] * sol[2]}`);
    break;
  }
  return {
    kind: 'system3', mechanic: 'multi_balance', title: bi('Keseimbangan Multivariabel', 'Multivariable Balance'),
    prompt: bi('Temukan nilai x, y, dan z yang memenuhi ketiga persamaan', 'Find x, y, z satisfying all three equations'),
    data: { eqs }, display: eqs, knobs: [knob('x', 'x', -12, 12, 1, 0), knob('y', 'y', -12, 12, 1, 0), knob('z', 'z', -12, 12, 1, 0)], intended: A({ x: sol[0], y: sol[1], z: sol[2] }), multiSolution: false,
  };
};
const rndMat = (r: Rng, rows: number, cols: number, lo: number, hi: number): number[][] => Array.from({ length: rows }, () => Array.from({ length: cols }, () => r.int(lo, hi)));
const genA22: Gen = (r, d) => {
  if (d <= 1) {
    const [m, n] = r.pick([[2, 3], [3, 2], [2, 2], [3, 3], [1, 3], [3, 1]]);
    const M = rndMat(r, m, n, 0, 9);
    return { kind: 'matbasic', mechanic: 'matrix_grid', title: bi('Grid Matriks', 'Matrix Grid'), prompt: bi('Tentukan ordo matriks (baris × kolom)', 'Find the matrix order (rows × columns)'), data: { A: M, mode: 'order' }, display: ['ordo = baris × kolom'], knobs: [knob('rows', 'Baris', 1, 6, 1, 1), knob('cols', 'Kolom', 1, 6, 1, 1)], intended: A({ rows: m, cols: n }), multiSolution: false };
  }
  if (d <= 3) {
    const M = rndMat(r, 3, 3, -5, 9);
    const i = r.int(1, 3), j = r.int(1, 3);
    return { kind: 'matbasic', mechanic: 'matrix_grid', title: bi('Grid Matriks', 'Matrix Grid'), prompt: bi(`Berapa nilai elemen a${i}${j}?`, `What is element a${i}${j}?`), data: { A: M, mode: 'element', i, j }, display: [`a_${i}${j} = ?`], knobs: [knob('v', `a${i}${j}`, -30, 30, 1, 0)], intended: A({ v: M[i - 1][j - 1] }), multiSolution: false };
  }
  const M = rndMat(r, 3, 3, -5, 9);
  return { kind: 'matbasic', mechanic: 'matrix_grid', title: bi('Grid Matriks', 'Matrix Grid'), prompt: bi('Hitung trace: jumlah diagonal utama', 'Compute the trace: sum of the main diagonal'), data: { A: M, mode: 'trace' }, display: ['trace(A) = ?'], knobs: [knob('t', 'trace', -40, 60, 1, 0)], intended: A({ t: M[0][0] + M[1][1] + M[2][2] }), multiSolution: false };
};
const resKnobs = (rows: number, cols: number): Knob[] => {
  const ks: Knob[] = [];
  for (let i = 1; i <= rows; i++) for (let j = 1; j <= cols; j++) ks.push(knob(`r${i}${j}`, `r${i}${j}`, -80, 80, 1, 0));
  return ks;
};
const genA23: Gen = (r, d) => {
  let op: string, Am: number[][], Bm: number[][] | undefined, k: number | undefined, label: string;
  if (d <= 1) { op = 'add'; Am = rndMat(r, 2, 2, 0, 6); Bm = rndMat(r, 2, 2, 0, 6); label = 'A + B'; }
  else if (d === 2) { op = r.pick(['sub', 'scale']); Am = rndMat(r, 2, 2, -3, 7); Bm = rndMat(r, 2, 2, -3, 5); k = r.int(2, 4); label = op === 'sub' ? 'A − B' : `${k}A`; }
  else if (d === 3) { op = 'mul'; Am = rndMat(r, 2, 2, -2, 4); Bm = rndMat(r, 2, 2, -2, 4); label = 'A × B'; }
  else if (d === 4) { op = 'transpose'; Am = rndMat(r, 2, 3, -4, 8); label = 'Aᵀ'; }
  else { op = 'mul'; Am = rndMat(r, 2, 3, -2, 4); Bm = rndMat(r, 3, 2, -2, 4); label = 'A × B'; }
  const dims = op === 'transpose' ? [3, 2] : op === 'mul' ? [2, 2] : [2, 2];
  return {
    kind: 'matop', mechanic: 'matrix_grid', title: bi('Operasi Matriks', 'Matrix Operations'),
    prompt: bi(`Hitung ${label} dan isi setiap elemen hasil`, `Compute ${label} and fill every result cell`),
    data: { op, A: Am, B: Bm, k }, display: [label], knobs: resKnobs(dims[0], dims[1]), intended: null, multiSolution: false,
  };
};
const genA24: Gen = (r, d) => {
  if (d === 3) {
    const dd = r.pick([1, 2, 3]);
    let b = r.nonZero(-6, 6), c = r.nonZero(-6, 6);
    for (let t = 0; t < 40 && (b * c) % dd !== 0; t++) { b = r.nonZero(-6, 6); c = r.nonZero(-6, 6); }
    const k = (b * c) / dd;
    return { kind: 'det', mechanic: 'determinant_collapse', title: bi('Keruntuhan Determinan', 'Determinant Collapse'), prompt: bi('Atur k agar determinan = 0 (platform runtuh)', 'Set k so the determinant = 0 (the platform collapses)'), data: { A: [[0, b], [c, dd]], mode: 'collapse', hide: [0, 0] }, display: [`det [[k ${b}] [${c} ${dd}]] = 0`], knobs: [knob('k', 'k', -30, 30, 1, 0)], intended: A({ k }), multiSolution: false };
  }
  const n = d >= 4 ? 3 : 2;
  const M = rndMat(r, n, n, d >= 5 ? -4 : -3, d >= 5 ? 6 : 6);
  if (n === 3 && d === 4) for (const row of M) if (r.chance(0.5)) row[r.int(0, 2)] = 0;
  return { kind: 'det', mechanic: 'determinant_collapse', title: bi('Keruntuhan Determinan', 'Determinant Collapse'), prompt: bi('Hitung determinan matriks', 'Compute the matrix determinant'), data: { A: M, mode: 'compute' }, display: [`det(A) = ?`], knobs: [knob('d', 'det', -200, 200, 1, 0)], intended: null, multiSolution: false };
};
const genA25: Gen = (r, d) => {
  const target = d >= 3 && d <= 3 ? 2 : d >= 4 ? r.pick([1, -1, 2, -2]) : r.pick([1, -1]);
  let M: number[][] = [[1, 0], [0, 1]];
  for (let t = 0; t < 200; t++) {
    const a = r.nonZero(-3, 4), b = r.int(-3, 4), c = r.int(-3, 4);
    const dd = (target + b * c) / a;
    if (Number.isInteger(dd) && Math.abs(dd) <= 5 && !(a === 1 && b === 0 && c === 0 && dd === 1)) { M = [[a, b], [c, dd]]; break; }
  }
  const stepHalf = Math.abs(target) === 2;
  if (d >= 4) {
    const x0 = r.int(-4, 5), y0 = r.int(-4, 5);
    const b = [M[0][0] * x0 + M[0][1] * y0, M[1][0] * x0 + M[1][1] * y0];
    return { kind: 'inverse', mechanic: 'matrix_grid', title: bi('Balik Transformasi', 'Reverse the Transformation'), prompt: bi('Selesaikan A·x = b memakai matriks invers', 'Solve A·x = b using the matrix inverse'), data: { A: M, mode: 'apply', b }, display: [`A·(x, y) = ${vecStr(b)}`], knobs: [knob('x', 'x', -20, 20, 1, 0), knob('y', 'y', -20, 20, 1, 0)], intended: A({ x: x0, y: y0 }), multiSolution: false };
  }
  return { kind: 'inverse', mechanic: 'matrix_grid', title: bi('Balik Transformasi', 'Reverse the Transformation'), prompt: bi('Temukan matriks invers A⁻¹', 'Find the inverse matrix A⁻¹'), data: { A: M, mode: 'inverse' }, display: ['A⁻¹ = ?'], knobs: ['i11', 'i12', 'i21', 'i22'].map((id) => knob(id, id, -20, 20, stepHalf ? 0.5 : 1, 0)), intended: null, multiSolution: false };
};
const genA26: Gen = (r, d) => {
  if (d <= 1) {
    const v = [r.int(1, 4), r.int(1, 4)];
    const k = r.int(2, 4);
    return { kind: 'transform', mechanic: 'transformation_grid', title: bi('Grid Realitas', 'Reality Grid'), prompt: bi('Skalakan objek: cari faktor k', 'Scale the object: find factor k'), data: { mode: 'scale', v, w: v.map((x) => x * k) }, display: [`k · ${vecStr(v)} = ${vecStr(v.map((x) => x * k))}`], knobs: [knob('k', 'k', -6, 6, 1, 1)], intended: A({ k }), multiSolution: false };
  }
  const mm = d === 2 ? r.pick(['reflect-x', 'reflect-y']) : d === 3 ? 'rot90' : 'map';
  const titles: Record<string, string> = { 'reflect-x': 'Cerminkan terhadap sumbu-x', 'reflect-y': 'Cerminkan terhadap sumbu-y', rot90: 'Putar 90° berlawanan arah jarum jam' };
  const knobs4 = ['a', 'b', 'c', 'd'].map((id) => knob(id, id, -4, 4, 1, id === 'a' || id === 'd' ? 1 : 0));
  if (mm === 'map') {
    const v = [r.int(1, 3), r.int(1, 3)];
    const M0 = rndMat(r, 2, 2, -2, 3);
    const w = [M0[0][0] * v[0] + M0[0][1] * v[1], M0[1][0] * v[0] + M0[1][1] * v[1]];
    return { kind: 'transform', mechanic: 'transformation_grid', title: bi('Grid Realitas', 'Reality Grid'), prompt: bi('Pindahkan artefak: cari matriks A dengan A·v = w (banyak jawaban)', 'Move the artifact: find any A with A·v = w (many answers)'), data: { mode: 'map', v, w }, display: [`A · ${vecStr(v)} = ${vecStr(w)}`], knobs: knobs4, intended: A({ a: M0[0][0], b: M0[0][1], c: M0[1][0], d: M0[1][1] }), multiSolution: true };
  }
  return { kind: 'transform', mechanic: 'transformation_grid', title: bi('Grid Realitas', 'Reality Grid'), prompt: bi(titles[mm] + ': isi matriks A', 'Fill matrix A for the transformation'), data: { mode: mm, v: [1, 1], w: [1, 1] }, display: [titles[mm]], knobs: knobs4, intended: null, multiSolution: false };
};
const genA27: Gen = (r, d) => {
  if (d === 3) {
    const [p, q] = r.pick([[3, 4], [5, 12], [6, 8], [8, 15], [9, 12]]);
    const u = [p * sgnr(r), q * sgnr(r)];
    return { kind: 'vector', mechanic: 'vector_arrows', title: bi('Panah Arah', 'Direction Arrows'), prompt: bi('Hitung panjang vektor |v|', 'Compute the vector length |v|'), data: { mode: 'mag', u, v: [0, 0] }, display: [`v = ${vecStr(u)}`, '|v| = √(x² + y²)'], knobs: [knob('m', '|v|', 0, 30, 1, 0)], intended: A({ m: Math.hypot(p, q) }), multiSolution: false };
  }
  const u = [r.int(-5, 5), r.int(-5, 5)], v = [r.int(-5, 5), r.int(-5, 5)];
  const scale = d >= 2;
  const a = scale ? r.int(-2, 3) : 1, b = scale ? r.int(-2, 3) : 1;
  const label = scale ? `${a}u + ${b}v`.replace('+ -', '− ') : 'u + v';
  return { kind: 'vector', mechanic: 'vector_arrows', title: bi('Panah Arah', 'Direction Arrows'), prompt: bi(`Hitung w = ${label}`, `Compute w = ${label}`), data: { mode: scale ? 'scale' : 'add', u, v, a, b }, display: [`u = ${vecStr(u)}`, `v = ${vecStr(v)}`, `w = ${label}`], knobs: [knob('wx', 'wx', -40, 40, 1, 0), knob('wy', 'wy', -40, 40, 1, 0)], intended: null, multiSolution: false };
};
const genA28: Gen = (r, d) => {
  let u: number[] = [1, 0], v: number[] = [0, 1];
  for (let t = 0; t < 60; t++) {
    u = [r.int(-3, 4), r.int(-3, 4)]; v = [r.int(-3, 4), r.int(-3, 4)];
    if (u[0] * v[1] - u[1] * v[0] !== 0) break;
  }
  const a = r.int(-3, 4), b = r.int(-3, 4);
  const w = [a * u[0] + b * v[0], a * u[1] + b * v[1]];
  void d;
  return { kind: 'vector', mechanic: 'vector_arrows', title: bi('Kombinasi Linear', 'Linear Combination'), prompt: bi('Tulis w sebagai a·u + b·v', 'Write w as a·u + b·v'), data: { mode: 'comb', u, v, w }, display: [`u = ${vecStr(u)}`, `v = ${vecStr(v)}`, `w = ${vecStr(w)}`], knobs: [knob('a', 'a', -9, 9, 1, 0), knob('b', 'b', -9, 9, 1, 0)], intended: A({ a, b }), multiSolution: false };
};
const cstr = (z: number[]): string => `(${z[0]} ${z[1] < 0 ? '-' : '+'} ${Math.abs(z[1])}i)`;
const genA29: Gen = (r, d) => {
  const z1 = [r.int(-5, 6), r.nonZero(-5, 6)];
  const z2 = [r.int(-4, 5), r.nonZero(-4, 5)];
  const mode = d <= 1 ? 'add' : d === 2 ? 'sub' : d === 3 ? 'conj' : d === 4 ? 'mul' : 'div';
  let z1e = z1;
  if (mode === 'div') { const res = [r.int(-3, 4), r.int(-3, 4)]; z1e = [res[0] * z2[0] - res[1] * z2[1], res[0] * z2[1] + res[1] * z2[0]]; }
  const sym: Record<string, string> = { add: '+', sub: '−', mul: '×', div: '÷' };
  const disp = mode === 'conj' ? `conj${cstr(z1e)}` : `${cstr(z1e)} ${sym[mode]} ${cstr(z2)}`;
  return { kind: 'complex', mechanic: 'complex_resonance', title: bi('Resonansi Kompleks', 'Complex Resonance'), prompt: bi('Hitung hasilnya: bagian real dan imajiner', 'Compute: real and imaginary parts'), data: { mode, z1: z1e, z2 }, display: [disp, 'i² = −1'], knobs: [knob('re', 'Real', -60, 60, 1, 0), knob('im', 'Imajiner', -60, 60, 1, 0)], intended: null, multiSolution: false };
};
const UNIMOD: number[][][] = [[[1, 1], [0, 1]], [[1, 0], [1, 1]], [[1, 1], [1, 2]], [[2, 1], [1, 1]], [[1, 2], [0, 1]], [[1, -1], [1, 0]], [[1, 0], [2, 1]], [[2, 1], [3, 2]]];
const genA30: Gen = (r, d) => {
  let l1 = 0, l2 = 0;
  while (l1 === l2) { l1 = r.int(-3, 4); l2 = r.int(-3, 4); }
  const P = r.pick(UNIMOD);
  const Pm = mat(P);
  const Pi = inverse(Pm)!;
  const D = mat([[l1, 0], [0, l2]]);
  const Am = matMul(matMul(Pm, D), Pi);
  const Aint = Am.map((row) => row.map((v) => Number(fmtQ(v))));
  const v1 = [P[0][0], P[1][0]];
  const mode = d <= 2 ? 'lambda' : d === 3 ? 'values' : 'pair';
  const common = { title: bi('Penstabil Eigen', 'Eigenvector Stabilizer'), kind: 'eigen' as const, mechanic: 'eigen_stabilizer', data: { A: Aint, mode, v: v1 }, display: [`A = ${matLines(Aint)}`] };
  if (mode === 'lambda') return { ...common, prompt: bi(`v = ${vecStr(v1)} adalah eigenvector. Cari λ`, `v = ${vecStr(v1)} is an eigenvector. Find λ`), display: [...common.display, `v = ${vecStr(v1)}`, 'A·v = λ·v'], knobs: [knob('lam', 'λ', -12, 12, 1, 0)], intended: A({ lam: l1 }), multiSolution: false };
  if (mode === 'values') return { ...common, prompt: bi('Temukan kedua eigenvalue', 'Find both eigenvalues'), knobs: [knob('l1', 'λ₁', -12, 12, 1, 0), knob('l2', 'λ₂', -12, 12, 1, 0)], intended: A({ l1, l2 }), multiSolution: false };
  return { ...common, prompt: bi('Temukan pasangan λ dan vektor v dengan A·v = λ·v', 'Find λ and v with A·v = λ·v'), display: [...common.display, 'A·v = λ·v'], knobs: [knob('lam', 'λ', -12, 12, 1, 0), knob('vx', 'vx', -12, 12, 1, 0), knob('vy', 'vy', -12, 12, 1, 0)], intended: A({ lam: l1, vx: v1[0], vy: v1[1] }), multiSolution: true };
};

export const GENERATORS: Record<TopicCode, Gen> = {
  A01: genA01, A02: genA02, A03: genA03, A04: genA04, A05: genA05, A06: genA06, A07: genA07, A08: genA08, A09: genA09, A10: genA10,
  A11: genA11, A12: genA12, A13: genA13, A14: genA14, A15: genA15, A16: genA16, A17: genA17, A18: genA18, A19: genA19, A20: genA20,
  A21: genA21, A22: genA22, A23: genA23, A24: genA24, A25: genA25, A26: genA26, A27: genA27, A28: genA28, A29: genA29, A30: genA30,
};

export function generateCandidate(topic: TopicCode, seed: number, target: number): Candidate {
  const rng = new Rng(seed ^ hashStr(topic));
  const d = clampd(Math.round(target), 1, 5);
  const draft = GENERATORS[topic](rng, d);
  const meta = TOPIC_BY_CODE[topic];
  const signature = `${topic}|${draft.kind}|${JSON.stringify(draft.data)}`;
  return {
    id: `${topic}-${(seed >>> 0).toString(36)}-${d}`,
    topic, kind: draft.kind, mechanic: draft.mechanic, seed, target: d, difficulty: d,
    title: draft.title, prompt: draft.prompt, data: draft.data, display: draft.display, knobs: draft.knobs,
    intended: draft.intended, multiSolution: draft.multiSolution,
    trace: [], steps: 0, hints: [],
    misconceptions: draft.misconceptions ?? MISC[draft.kind] ?? [],
    prerequisites: meta.prereq, status: 'Candidate', signature,
  };
}
