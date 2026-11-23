/** Solver: persamaan/pertidaksamaan linear, kuadrat, sistem linear, matriks, eigen, kompleks. */
import { MathError, Q, ZERO, ONE, add, sub, mul, div, neg, eq, isZero, q, cmp, fmtQ, qsqrt, isInt } from './rational';
import { Poly, pCoeff, pDegree, pSub, Relation } from './poly';

/* ---------- Linear satu variabel ---------- */
export type LinearSolution =
  | { kind: 'unique'; value: Q; a: Q; b: Q; c: Q; d: Q; trace: string[]; balanceOps: number }
  | { kind: 'none' | 'infinite'; trace: string[] };

export function solveLinear1(rel: Relation, v = 'x'): LinearSolution {
  if (pDegree(rel.lhs, v) > 1 || pDegree(rel.rhs, v) > 1) throw new MathError('Bukan persamaan linear');
  const a = pCoeff(rel.lhs, v, 1);
  const b = pCoeff(rel.lhs, v, 0);
  const c = pCoeff(rel.rhs, v, 1);
  const d = pCoeff(rel.rhs, v, 0);
  const trace: string[] = [];
  const k = sub(a, c);
  const m = sub(d, b);
  let ops = 0;
  if (!isZero(c)) {
    trace.push(`Kurangi kedua ruas dengan ${fmtQ(c)}${v}`);
    ops++;
  }
  if (!isZero(b)) {
    trace.push(`${b.n > 0 ? 'Kurangi' : 'Tambah'} kedua ruas dengan ${fmtQ(b.n < 0 ? neg(b) : b)}`);
    ops++;
  }
  if (isZero(k)) return { kind: isZero(m) ? 'infinite' : 'none', trace };
  if (!eq(k, ONE)) {
    trace.push(`Bagi kedua ruas dengan ${fmtQ(k)}`);
    ops++;
  }
  const value = div(m, k);
  trace.push(`${v} = ${fmtQ(value)}`);
  return { kind: 'unique', value, a, b, c, d, trace, balanceOps: ops };
}

export interface IneqSolution {
  bound: Q;
  dir: 'lt' | 'gt'; // himpunan penyelesaian: x < bound  atau  x > bound
  inclusive: boolean;
  trace: string[];
}
export function solveInequality1(rel: Relation, v = 'x'): IneqSolution | null {
  if (rel.rel === '=') return null;
  const k = sub(pCoeff(rel.lhs, v, 1), pCoeff(rel.rhs, v, 1));
  const m = sub(pCoeff(rel.rhs, v, 0), pCoeff(rel.lhs, v, 0));
  if (isZero(k)) return null;
  let dir: 'lt' | 'gt' = rel.rel === '<' || rel.rel === '<=' ? 'lt' : 'gt';
  const trace = [`Kumpulkan suku ${v}: ${fmtQ(k)}${v} ${rel.rel} ${fmtQ(m)}`];
  if (k.n < 0) {
    dir = dir === 'lt' ? 'gt' : 'lt';
    trace.push('Dibagi bilangan negatif → tanda pertidaksamaan dibalik');
  } else trace.push(`Bagi kedua ruas dengan ${fmtQ(k)}`);
  const bound = div(m, k);
  trace.push(`${v} ${dir === 'lt' ? '<' : '>'}${rel.rel.includes('=') ? '=' : ''} ${fmtQ(bound)}`);
  return { bound, dir, inclusive: rel.rel.includes('='), trace };
}

/* ---------- Kuadrat ---------- */
export interface QuadSolution {
  disc: Q;
  roots: Q[] | null; // null bila akar tidak rasional / kompleks
  vertex: { x: Q; y: Q };
}
export function solveQuadratic(a: Q, b: Q, c: Q): QuadSolution {
  if (isZero(a)) throw new MathError('Bukan kuadrat');
  const disc = sub(mul(b, b), mul(q(4), mul(a, c)));
  const vx = div(neg(b), mul(q(2), a));
  const vy = add(add(mul(a, mul(vx, vx)), mul(b, vx)), c);
  let roots: Q[] | null = null;
  const s = qsqrt(disc);
  if (s) {
    const r1 = div(add(neg(b), s), mul(q(2), a));
    const r2 = div(sub(neg(b), s), mul(q(2), a));
    roots = eq(r1, r2) ? [r1] : cmp(r1, r2) < 0 ? [r1, r2] : [r2, r1];
  }
  return { disc, roots, vertex: { x: vx, y: vy } };
}

/* ---------- Matriks & sistem linear ---------- */
export type Mat = Q[][];
export const mat = (rows: number[][]): Mat => rows.map((r) => r.map((x) => q(x)));
export const matEq = (A: Mat, B: Mat): boolean =>
  A.length === B.length && A.every((r, i) => r.length === B[i].length && r.every((x, j) => eq(x, B[i][j])));
export const identity = (n: number): Mat => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? ONE : ZERO)));
export function matAdd(A: Mat, B: Mat): Mat {
  if (A.length !== B.length || A[0].length !== B[0].length) throw new MathError('Ordo tidak sama');
  return A.map((r, i) => r.map((x, j) => add(x, B[i][j])));
}
export function matMul(A: Mat, B: Mat): Mat {
  if (A[0].length !== B.length) throw new MathError('Ordo tidak cocok untuk perkalian');
  return A.map((r) => B[0].map((_, j) => r.reduce((s, x, k) => add(s, mul(x, B[k][j])), ZERO)));
}
export const matT = (A: Mat): Mat => A[0].map((_, j) => A.map((r) => r[j]));
export const matScale = (A: Mat, k: Q): Mat => A.map((r) => r.map((x) => mul(x, k)));
export function det(A: Mat): Q {
  const n = A.length;
  if (A.some((r) => r.length !== n)) throw new MathError('Matriks harus persegi');
  if (n === 1) return A[0][0];
  if (n === 2) return sub(mul(A[0][0], A[1][1]), mul(A[0][1], A[1][0]));
  let total = ZERO;
  for (let j = 0; j < n; j++) {
    const minor = A.slice(1).map((r) => r.filter((_, c) => c !== j));
    const term = mul(A[0][j], det(minor));
    total = j % 2 === 0 ? add(total, term) : sub(total, term);
  }
  return total;
}
export function inverse(A: Mat): Mat | null {
  const n = A.length;
  const M = A.map((r, i) => [...r, ...identity(n)[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    while (piv < n && isZero(M[piv][col])) piv++;
    if (piv === n) return null;
    [M[col], M[piv]] = [M[piv], M[col]];
    const p = M[col][col];
    M[col] = M[col].map((x) => div(x, p));
    for (let r = 0; r < n; r++) {
      if (r !== col && !isZero(M[r][col])) {
        const f = M[r][col];
        M[r] = M[r].map((x, j) => sub(x, mul(f, M[col][j])));
      }
    }
  }
  return M.map((r) => r.slice(n));
}

export type SystemSolution = { kind: 'unique'; values: Q[]; trace: string[] } | { kind: 'none' | 'infinite'; trace: string[] };
/** Eliminasi Gauss-Jordan eksak untuk A·x = b. */
export function solveSystem(A: Mat, b: Q[]): SystemSolution {
  const n = A.length;
  const m = A[0].length;
  const M = A.map((r, i) => [...r, b[i]]);
  const trace: string[] = [];
  let row = 0;
  const pivots: number[] = [];
  for (let col = 0; col < m && row < n; col++) {
    let piv = row;
    while (piv < n && isZero(M[piv][col])) piv++;
    if (piv === n) continue;
    [M[row], M[piv]] = [M[piv], M[row]];
    const p = M[row][col];
    M[row] = M[row].map((x) => div(x, p));
    for (let r = 0; r < n; r++) {
      if (r !== row && !isZero(M[r][col])) {
        const f = M[r][col];
        M[r] = M[r].map((x, j) => sub(x, mul(f, M[row][j])));
        trace.push(`Eliminasi variabel ke-${col + 1} dari persamaan ${r + 1}`);
      }
    }
    pivots.push(col);
    row++;
  }
  for (let r = row; r < n; r++) if (!isZero(M[r][m])) return { kind: 'none', trace };
  if (pivots.length < m) return { kind: 'infinite', trace };
  const values: Q[] = Array(m).fill(ZERO);
  pivots.forEach((c, i) => (values[c] = M[i][m]));
  return { kind: 'unique', values, trace };
}

/* ---------- Eigen 2×2 ---------- */
export interface EigenPair {
  value: Q;
  vector: [Q, Q];
}
export function eigen2(A: Mat): EigenPair[] | null {
  const tr = add(A[0][0], A[1][1]);
  const d = det(A);
  const { roots } = solveQuadratic(ONE, neg(tr), d);
  if (!roots) return null;
  return roots.map((lam) => {
    const a = sub(A[0][0], lam);
    const b = A[0][1];
    const c = A[1][0];
    const dd = sub(A[1][1], lam);
    let vec: [Q, Q];
    if (!isZero(a) || !isZero(b)) vec = [neg(b), a];
    else if (!isZero(c) || !isZero(dd)) vec = [neg(dd), c];
    else vec = [ONE, ZERO];
    if (isZero(vec[0]) && isZero(vec[1])) vec = [ONE, ZERO];
    return { value: lam, vector: vec };
  });
}
export function applyMat(A: Mat, v: Q[]): Q[] {
  return A.map((r) => r.reduce((s, x, k) => add(s, mul(x, v[k])), ZERO));
}

/* ---------- Kompleks ---------- */
export interface C {
  re: Q;
  im: Q;
}
export const cx = (re: number, im: number): C => ({ re: q(re), im: q(im) });
export const cAdd = (a: C, b: C): C => ({ re: add(a.re, b.re), im: add(a.im, b.im) });
export const cSub = (a: C, b: C): C => ({ re: sub(a.re, b.re), im: sub(a.im, b.im) });
export const cMul = (a: C, b: C): C => ({ re: sub(mul(a.re, b.re), mul(a.im, b.im)), im: add(mul(a.re, b.im), mul(a.im, b.re)) });
export const cConj = (a: C): C => ({ re: a.re, im: neg(a.im) });
export const cEq = (a: C, b: C): boolean => eq(a.re, b.re) && eq(a.im, b.im);
export function cDiv(a: C, b: C): C {
  const den = add(mul(b.re, b.re), mul(b.im, b.im));
  const num = cMul(a, cConj(b));
  return { re: div(num.re, den), im: div(num.im, den) };
}
export function fmtC(z: C): string {
  const im = z.im;
  if (isZero(im)) return fmtQ(z.re);
  const ims = eq(im, ONE) ? 'i' : eq(im, q(-1)) ? '-i' : `${fmtQ(im)}i`;
  if (isZero(z.re)) return ims;
  return `${fmtQ(z.re)} ${im.n < 0 ? '-' : '+'} ${ims.replace('-', '')}`;
}

/* ---------- Bentuk akar, logaritma, pangkat ---------- */
export function simplifySqrt(n: number): { a: number; b: number } {
  let a = 1;
  let b = n;
  for (let f = 2; f * f <= b; f++) {
    while (b % (f * f) === 0) {
      b /= f * f;
      a *= f;
    }
  }
  return { a, b };
}
export const isSquareFree = (n: number): boolean => simplifySqrt(n).a === 1;
export function bpow(base: number, exp: number): bigint {
  if (!Number.isInteger(base) || !Number.isInteger(exp) || exp < 0 || exp > 60) throw new MathError('Pangkat tidak didukung');
  return BigInt(base) ** BigInt(exp);
}
/** log_base(N) bulat, atau null. */
export function intLog(base: number, N: number): number | null {
  if (base < 2 || N < 1) return null;
  let k = 0;
  let v = 1n;
  const target = BigInt(N);
  while (v < target && k < 60) {
    v *= BigInt(base);
    k++;
  }
  return v === target ? k : null;
}

export { isInt, pSub };
export type { Poly };
