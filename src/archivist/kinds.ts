/**
 * Math Engine bridge: untuk setiap jenis soal ada `solve` (penyelesai internal dari struktur yang
 * DITAMPILKAN) dan `verify` (evaluasi matematis jawaban pemain — bukan pencocokan teks).
 */
import {
  Q, ZERO, ONE, q, add, sub, mul, div, neg, eq, isZero, cmp, fmtQ,
} from '../math/rational';
import {
  Poly, parseExpr, parseRelation, relationHolds, pCoeff, pDegree, pConst, pVar, pAdd, pMul, pPow, pEq, Relation,
} from '../math/poly';
import {
  solveLinear1, solveInequality1, solveQuadratic, solveSystem, Mat, mat, matAdd, matMul, matT, matScale, matEq, det,
  inverse, identity, eigen2, applyMat, C, cAdd, cSub, cMul, cDiv, cConj, cEq, simplifySqrt, isSquareFree, bpow, intLog,
} from '../math/solve';
import { Answer, Candidate, CheckKind, SolveResult, VerifyResult, A, getData, nq } from './types';

interface Kind {
  solve(c: Candidate): SolveResult | null;
  verify(c: Candidate, a: Answer): VerifyResult;
}
const ok: VerifyResult = { ok: true };
const bad = (msg: string): VerifyResult => ({ ok: false, msg });
const g = (a: Answer, k: string): Q => a[k] ?? ZERO;
const sameAnswer = (sol: Answer, a: Answer): boolean => Object.keys(sol).every((k) => a[k] && eq(sol[k], a[k]));
const polyFrom = (coeffs: Q[]): Poly => {
  let p: Poly = new Map();
  coeffs.forEach((c, i) => {
    p = pAdd(p, pMul(pConst(c), pPow(pVar('x'), i)));
  });
  return p;
};
const toMat = (rows: number[][]): Mat => mat(rows);

/** Bentuk linear a·x + b·y + c·z = d dari relasi. */
export function linearForm(rel: Relation, vars: string[]): { co: Q[]; rhs: Q } {
  const diff = pAdd(rel.lhs, new Map([...rel.rhs].map(([k, v]) => [k, neg(v)] as [string, Q])));
  const co = vars.map((v) => pCoeff(diff, v, 1));
  const k = diff.get('') ?? ZERO;
  return { co, rhs: neg(k) };
}

const KINDS: Record<CheckKind, Kind> = {
  balance: {
    solve(c): SolveResult | null {
      const s = solveLinear1(parseRelation(getData<{ eq: string }>(c).eq));
      if (s.kind !== 'unique') return null;
      return { solution: { x: s.value }, trace: s.trace, steps: s.balanceOps, unique: true };
    },
    verify(c, a) {
      const rel = parseRelation(getData<{ eq: string }>(c).eq);
      return relationHolds(rel, { x: g(a, 'x') }) ? ok : bad('Nilai x belum membuat kedua ruas sama.');
    },
  },

  classify: {
    solve(c): SolveResult | null {
      const p = parseExpr(getData<{ expr: string }>(c).expr);
      return {
        solution: { terms: q(p.size), coef: pCoeff(p, 'x', 1), konst: p.get('') ?? ZERO },
        trace: ['Hitung suku yang dipisahkan tanda + atau −', 'Koefisien = angka yang menempel pada x', 'Konstanta = suku tanpa variabel'],
        steps: 3,
        unique: true,
      };
    },
    verify(c, a) {
      const s = KINDS.classify.solve(c)!.solution;
      if (!eq(g(a, 'terms'), s.terms)) return bad('Hitung kembali banyak suku (dipisahkan tanda + / −).');
      if (!eq(g(a, 'coef'), s.coef)) return bad('Koefisien adalah angka di depan variabel x, lengkap dengan tandanya.');
      if (!eq(g(a, 'konst'), s.konst)) return bad('Konstanta adalah suku yang tidak memuat variabel.');
      return ok;
    },
  },

  simplify: {
    solve(c): SolveResult | null {
      const d = getData<{ expr: string; deg: number }>(c);
      const p = parseExpr(d.expr);
      const sol: Answer = {};
      for (let i = 0; i <= d.deg; i++) sol[`c${i}`] = pCoeff(p, 'x', i);
      return {
        solution: sol,
        trace: [`Jabarkan kurung (sifat distributif) bila ada`, `Gabungkan suku sejenis`, `Hasil: ${polyStr(sol, d.deg)}`],
        steps: 3,
        unique: true,
      };
    },
    verify(c, a) {
      const d = getData<{ expr: string; deg: number }>(c);
      const built = polyFrom(Array.from({ length: d.deg + 1 }, (_, i) => g(a, `c${i}`)));
      return pEq(parseExpr(d.expr), built) ? ok : bad('Bentuk sederhananya belum sama dengan ekspresi awal. Gabungkan hanya suku sejenis.');
    },
  },

  ineq: {
    solve(c): SolveResult | null {
      const s = solveInequality1(parseRelation(getData<{ ineq: string }>(c).ineq));
      if (!s) return null;
      return {
        solution: { bound: s.bound, dir: q(s.dir === 'lt' ? 0 : 1), incl: q(s.inclusive ? 1 : 0) },
        trace: s.trace,
        steps: s.trace.length,
        unique: true,
      };
    },
    verify(c, a) {
      const s = KINDS.ineq.solve(c)!.solution;
      if (!eq(g(a, 'bound'), s.bound)) return bad('Batas solusi belum tepat. Selesaikan seperti persamaan dulu.');
      if (!eq(g(a, 'dir'), s.dir)) return bad('Arah salah. Ingat: dibagi bilangan negatif → tanda dibalik.');
      if (!eq(g(a, 'incl'), s.incl)) return bad('Perhatikan tanda: ≤ / ≥ memakai titik penuh, < / > titik kosong.');
      return ok;
    },
  },

  coord: {
    solve(c): SolveResult | null {
      const d = getData<{ mode: string; px: number; py: number; tx?: number; ty?: number }>(c);
      let sol: Answer;
      if (d.mode === 'quadrant') sol = A({ qd: d.px > 0 ? (d.py > 0 ? 1 : 4) : d.py > 0 ? 2 : 3 });
      else if (d.mode === 'reflect-y') sol = A({ x: -d.px, y: d.py });
      else if (d.mode === 'reflect-x') sol = A({ x: d.px, y: -d.py });
      else if (d.mode === 'translate') sol = A({ x: d.px + (d.tx ?? 0), y: d.py + (d.ty ?? 0) });
      else sol = A({ x: d.px, y: d.py });
      return { solution: sol, trace: [`Titik tujuan: (${Object.values(sol).map(fmtQ).join(', ')})`], steps: 1, unique: true };
    },
    verify(c, a) {
      return sameAnswer(KINDS.coord.solve(c)!.solution, a) ? ok : bad('Titik belum tepat. Baca x (mendatar) lalu y (tegak).');
    },
  },

  line: {
    solve(c): SolveResult | null {
      const d = getData<{ mode: string; c?: number; pts: number[][] }>(c);
      const [p1, p2] = d.pts;
      if (d.mode === 'slope' || d.mode === 'mc') {
        if (p1[0] === p2[0]) return null;
        const m = div(q(p2[1] - p1[1]), q(p2[0] - p1[0]));
        const cc = sub(q(p1[1]), mul(m, q(p1[0])));
        const sol: Answer = d.mode === 'slope' ? { m } : { m, c: cc };
        return {
          solution: sol,
          trace: [`Gradien m = (${p2[1]} − ${p1[1]}) / (${p2[0]} − ${p1[0]}) = ${fmtQ(m)}`, ...(d.mode === 'mc' ? [`c = y − m·x = ${fmtQ(cc)}`] : [])],
          steps: d.mode === 'mc' ? 2 : 1,
          unique: true,
        };
      }
      if (p1[0] === 0) return null;
      const m = div(sub(q(p1[1]), q(d.c ?? 0)), q(p1[0]));
      return { solution: { m }, trace: [`m = (y − c) / x = (${p1[1]} − ${d.c ?? 0}) / ${p1[0]} = ${fmtQ(m)}`], steps: 1, unique: true };
    },
    verify(c, a) {
      const d = getData<{ mode: string; c?: number; pts: number[][] }>(c);
      const m = g(a, 'm');
      if (d.mode === 'slope') {
        const s = KINDS.line.solve(c)!.solution;
        return eq(m, s.m) ? ok : bad('Gradien = selisih y dibagi selisih x. Periksa tandanya.');
      }
      const cc = d.mode === 'm' ? q(d.c ?? 0) : g(a, 'c');
      const all = d.pts.every(([x, y]) => eq(add(mul(m, q(x)), cc), q(y)));
      return all ? ok : bad('Garis belum melewati semua titik tujuan.');
    },
  },

  dual: {
    solve(c): SolveResult | null {
      const { eqs } = getData<{ eqs: string[] }>(c);
      const rows = eqs.map((s) => linearForm(parseRelation(s), ['x', 'y']));
      const s = solveSystem(rows.map((r) => r.co), rows.map((r) => r.rhs));
      if (s.kind !== 'unique') return null;
      return {
        solution: { x: s.values[0], y: s.values[1] },
        trace: ['Samakan kedua persamaan (substitusi / eliminasi)', `x = ${fmtQ(s.values[0])}`, `y = ${fmtQ(s.values[1])}`],
        steps: 3,
        unique: true,
      };
    },
    verify(c, a) {
      const { eqs } = getData<{ eqs: string[] }>(c);
      const env = { x: g(a, 'x'), y: g(a, 'y') };
      return eqs.every((s) => relationHolds(parseRelation(s), env)) ? ok : bad('Titik itu belum memenuhi kedua persamaan sekaligus.');
    },
  },

  factor: {
    solve(c): SolveResult | null {
      const { poly, lead } = getData<{ poly: string; lead: number }>(c);
      const p = parseExpr(poly);
      const b = pCoeff(p, 'x', 1);
      const cc = pCoeff(p, 'x', 0);
      const found: Answer[] = [];
      for (let pp = -80; pp <= 80; pp++) {
        const qq = sub(b, q(lead * pp));
        if (qq.d === 1 && eq(mul(q(pp), qq), cc)) found.push({ p: q(pp), q: qq });
      }
      if (!found.length) return null;
      const canon = new Set(found.map((f) => (lead === 1 ? [f.p.n, f.q.n].sort((x, y) => x - y).join(',') : `${f.p.n},${f.q.n}`)));
      return {
        solution: found[0],
        alternatives: found.slice(1),
        trace: [`Cari dua bilangan: jumlah = ${fmtQ(b)}${lead > 1 ? ' (disesuaikan koefisien depan)' : ''}, hasil kali = ${fmtQ(cc)}`, `Faktor: (x ${sgn(found[0].p)}) (${lead > 1 ? lead : ''}x ${sgn(found[0].q)})`],
        steps: 2,
        unique: canon.size === 1,
      };
    },
    verify(c, a) {
      const { poly, lead } = getData<{ poly: string; lead: number }>(c);
      const f1 = pAdd(pVar('x'), pConst(g(a, 'p')));
      const f2 = pAdd(pMul(pConst(q(lead)), pVar('x')), pConst(g(a, 'q')));
      return pEq(pMul(f1, f2), parseExpr(poly)) ? ok : bad('Kembangkan kembali faktornya — hasilnya belum sama dengan polinomial.');
    },
  },

  roots: {
    solve(c): SolveResult | null {
      const { eq: e, mode } = getData<{ eq: string; mode: string }>(c);
      const rel = parseRelation(e);
      const diff = pAdd(rel.lhs, new Map([...rel.rhs].map(([k, v]) => [k, neg(v)] as [string, Q])));
      if (pDegree(diff, 'x') !== 2) return null;
      const s = solveQuadratic(pCoeff(diff, 'x', 2), pCoeff(diff, 'x', 1), pCoeff(diff, 'x', 0));
      if (mode === 'disc') return { solution: { D: s.disc }, trace: ['D = b² − 4ac', `D = ${fmtQ(s.disc)}`], steps: 2, unique: true };
      if (!s.roots) return null;
      const [r1, r2] = s.roots.length === 1 ? [s.roots[0], s.roots[0]] : s.roots;
      return { solution: { r1, r2 }, trace: ['Faktorkan atau gunakan rumus kuadrat', 'Setiap faktor = 0', `x = ${fmtQ(r1)} atau x = ${fmtQ(r2)}`], steps: 3, unique: true };
    },
    verify(c, a) {
      const s = KINDS.roots.solve(c)!.solution;
      if ('D' in s) return eq(g(a, 'D'), s.D) ? ok : bad('Hitung D = b² − 4ac dengan hati-hati.');
      const mine = [g(a, 'r1'), g(a, 'r2')].sort((x, y) => cmp(x, y));
      return eq(mine[0], s.r1) && eq(mine[1], s.r2) ? ok : bad('Salah satu akar belum memenuhi persamaan.');
    },
  },

  parabola: {
    solve(c): SolveResult | null {
      const d = getData<{ pts: number[][]; fixed: Record<string, number> }>(c);
      const unk = ['a', 'b', 'c'].filter((k) => !(k in d.fixed));
      const rows: Q[][] = [];
      const rhs: Q[] = [];
      for (const [x, y] of d.pts) {
        const coef: Record<string, Q> = { a: q(x * x), b: q(x), c: ONE };
        let r = q(y);
        for (const k of Object.keys(d.fixed)) r = sub(r, mul(coef[k], nq(d.fixed[k])));
        rows.push(unk.map((k) => coef[k]));
        rhs.push(r);
      }
      if (rows.length < unk.length) return null;
      const s = solveSystem(rows, rhs);
      if (s.kind !== 'unique') return null;
      const sol: Answer = {};
      unk.forEach((k, i) => (sol[k] = s.values[i]));
      return { solution: sol, trace: [`Substitusikan tiap titik ke y = ax² + bx + c`, `Selesaikan ${unk.length} persamaan yang terbentuk`, ...unk.map((k) => `${k} = ${fmtQ(sol[k])}`)], steps: 3, unique: true };
    },
    verify(c, a) {
      const d = getData<{ pts: number[][]; fixed: Record<string, number> }>(c);
      const co = (k: string): Q => (k in d.fixed ? nq(d.fixed[k]) : g(a, k));
      const all = d.pts.every(([x, y]) => eq(add(add(mul(co('a'), q(x * x)), mul(co('b'), q(x))), co('c')), q(y)));
      return all ? ok : bad('Parabola belum melewati semua cincin. Periksa a (bukaan), b, dan c (titik potong y).');
    },
  },

  exponent: {
    solve(c): SolveResult | null {
      const { expr, base, mode } = getData<{ expr: string; base: number; mode: string }>(c);
      const v = parseExpr(expr).get('') ?? ZERO;
      if (v.d !== 1) return null;
      if (mode === 'value') return { solution: { v }, trace: ['Hitung nilai pangkat', `= ${fmtQ(v)}`], steps: 1, unique: true };
      const e = intLog(base, v.n);
      if (e === null) return null;
      return { solution: { e: q(e) }, trace: ['Samakan basis lalu gunakan sifat pangkat', `Pangkat akhir = ${e}`], steps: 2, unique: true };
    },
    verify(c, a) {
      const { expr, base, mode } = getData<{ expr: string; base: number; mode: string }>(c);
      const v = parseExpr(expr).get('') ?? ZERO;
      if (mode === 'value') return eq(g(a, 'v'), v) ? ok : bad('Hitung ulang nilai pangkatnya.');
      const e = g(a, 'e');
      if (e.d !== 1 || e.n < 0 || e.n > 60) return bad('Pangkat harus bilangan bulat tak negatif.');
      return bpow(base, e.n) === BigInt(v.n) ? ok : bad('Ingat: kali → pangkat dijumlah, bagi → dikurang, pangkat-dari-pangkat → dikali.');
    },
  },

  radical: {
    solve(c): SolveResult | null {
      const d = getData<{ mode: string; n?: number; p?: number; qq?: number }>(c);
      if (d.mode === 'add') return { solution: { k: q((d.p ?? 0) + (d.qq ?? 0)) }, trace: ['Akar sejenis: jumlahkan koefisiennya'], steps: 1, unique: true };
      const { a, b } = simplifySqrt(d.n ?? 1);
      return { solution: { a: q(a), b: q(b) }, trace: [`Cari faktor kuadrat sempurna terbesar dari ${d.n}`, `√${d.n} = ${a === 1 ? '' : a}√${b}`], steps: 2, unique: true };
    },
    verify(c, a) {
      const d = getData<{ mode: string; n?: number; p?: number; qq?: number }>(c);
      if (d.mode === 'add') return eq(g(a, 'k'), q((d.p ?? 0) + (d.qq ?? 0))) ? ok : bad('Akar sejenis dijumlahkan koefisiennya saja.');
      const aa = g(a, 'a');
      const bb = g(a, 'b');
      if (aa.d !== 1 || bb.d !== 1 || aa.n < 1 || bb.n < 1) return bad('a dan b harus bilangan bulat positif.');
      if (aa.n * aa.n * bb.n !== d.n) return bad('a² × b harus sama dengan bilangan di dalam akar.');
      return isSquareFree(bb.n) ? ok : bad('Masih bisa disederhanakan: b tidak boleh punya faktor kuadrat.');
    },
  },

  log: {
    solve(c): SolveResult | null {
      const d = getData<{ mode: string; b: number; k: number; N: number }>(c);
      if (d.mode === 'value') {
        const k = intLog(d.b, d.N);
        return k === null ? null : { solution: { k: q(k) }, trace: [`log_${d.b} ${d.N} = k  ⇔  ${d.b}^k = ${d.N}`, `k = ${k}`], steps: 2, unique: true };
      }
      if (d.mode === 'arg') return { solution: { N: q(Number(bpow(d.b, d.k))) }, trace: [`N = ${d.b}^${d.k}`], steps: 1, unique: true };
      const cands: number[] = [];
      for (let b = 2; b <= Math.min(d.N, 1000); b++) if (intLog(b, d.N) === d.k) cands.push(b);
      return cands.length === 1 ? { solution: { b: q(cands[0]) }, trace: [`b^${d.k} = ${d.N}`, `b = ${cands[0]}`], steps: 2, unique: true } : null;
    },
    verify(c, a) {
      const d = getData<{ mode: string; b: number; k: number; N: number }>(c);
      if (d.mode === 'value') {
        const k = g(a, 'k');
        return k.d === 1 && k.n >= 0 && k.n <= 60 && bpow(d.b, k.n) === BigInt(d.N) ? ok : bad('Ingat: log_b N = k berarti b^k = N.');
      }
      if (d.mode === 'arg') return eq(g(a, 'N'), q(Number(bpow(d.b, d.k)))) ? ok : bad('N = b^k.');
      const b = g(a, 'b');
      return b.d === 1 && b.n >= 2 && b.n <= 1000 && intLog(b.n, d.N) === d.k ? ok : bad('Cari basis b sehingga b^k = N.');
    },
  },

  expand: {
    solve(c): SolveResult | null {
      const d = getData<{ expr: string; deg: number }>(c);
      const p = parseExpr(d.expr);
      const sol: Answer = {};
      for (let i = 0; i <= d.deg; i++) sol[`c${i}`] = pCoeff(p, 'x', i);
      if (pDegree(p, 'x') !== d.deg) return null;
      return { solution: sol, trace: ['Kalikan setiap suku dengan setiap suku lain', 'Gabungkan suku sejenis', `Hasil: ${polyStr(sol, d.deg)}`], steps: 2, unique: true };
    },
    verify(c, a) {
      const d = getData<{ expr: string; deg: number }>(c);
      const built = polyFrom(Array.from({ length: d.deg + 1 }, (_, i) => g(a, `c${i}`)));
      return pEq(parseExpr(d.expr), built) ? ok : bad('Hasil penjabaran belum sama. Kalikan semua pasangan suku, lalu gabungkan.');
    },
  },

  domain: {
    solve(c): SolveResult | null {
      const d = getData<{ mode: string; den?: string; radicand?: string }>(c);
      if (d.mode === 'radical') {
        const s = solveInequality1(parseRelation(`${d.radicand} >= 0`));
        if (!s) return null;
        return { solution: { bound: s.bound, dir: q(s.dir === 'lt' ? 0 : 1) }, trace: ['Isi akar harus ≥ 0', ...s.trace], steps: 2, unique: true };
      }
      const rel = parseRelation(`${d.den} = 0`);
      if (d.mode === 'rational') {
        const s = solveLinear1(rel);
        return s.kind === 'unique' ? { solution: { h: s.value }, trace: ['Penyebut = 0 → nilai terlarang', `x = ${fmtQ(s.value)}`], steps: 2, unique: true } : null;
      }
      const s = solveQuadratic(pCoeff(rel.lhs, 'x', 2), pCoeff(rel.lhs, 'x', 1), pCoeff(rel.lhs, 'x', 0));
      if (!s.roots || s.roots.length !== 2) return null;
      return { solution: { h1: s.roots[0], h2: s.roots[1] }, trace: ['Penyebut = 0, faktorkan', `x = ${fmtQ(s.roots[0])} atau ${fmtQ(s.roots[1])}`], steps: 2, unique: true };
    },
    verify(c, a) {
      const s = KINDS.domain.solve(c)!.solution;
      if ('h1' in s) {
        const mine = [g(a, 'h1'), g(a, 'h2')].sort((x, y) => cmp(x, y));
        return eq(mine[0], s.h1) && eq(mine[1], s.h2) ? ok : bad('Cari semua x yang membuat penyebut = 0.');
      }
      return sameAnswer(s, a) ? ok : bad('Penyebut tidak boleh 0; isi akar tidak boleh negatif.');
    },
  },

  system3: {
    solve(c): SolveResult | null {
      const { eqs } = getData<{ eqs: string[] }>(c);
      const rows = eqs.map((s) => linearForm(parseRelation(s), ['x', 'y', 'z']));
      const s = solveSystem(rows.map((r) => r.co), rows.map((r) => r.rhs));
      if (s.kind !== 'unique') return null;
      return { solution: { x: s.values[0], y: s.values[1], z: s.values[2] }, trace: ['Eliminasi z dari dua pasang persamaan', 'Selesaikan SPLDV yang terbentuk', `x = ${fmtQ(s.values[0])}, y = ${fmtQ(s.values[1])}, z = ${fmtQ(s.values[2])}`], steps: 3, unique: true };
    },
    verify(c, a) {
      const { eqs } = getData<{ eqs: string[] }>(c);
      const env = { x: g(a, 'x'), y: g(a, 'y'), z: g(a, 'z') };
      return eqs.every((s) => relationHolds(parseRelation(s), env)) ? ok : bad('Substitusikan ke ketiga persamaan — masih ada yang tidak seimbang.');
    },
  },

  matbasic: {
    solve(c): SolveResult | null {
      const d = getData<{ A: number[][]; mode: string; i?: number; j?: number }>(c);
      if (d.mode === 'order') return { solution: { rows: q(d.A.length), cols: q(d.A[0].length) }, trace: ['Ordo = banyak baris × banyak kolom'], steps: 1, unique: true };
      if (d.mode === 'element') return { solution: { v: q(d.A[(d.i ?? 1) - 1][(d.j ?? 1) - 1]) }, trace: [`Ambil baris ${d.i}, kolom ${d.j}`], steps: 1, unique: true };
      return { solution: { t: q(d.A.reduce((s, r, i) => s + r[i], 0)) }, trace: ['Jumlahkan elemen diagonal utama'], steps: 1, unique: true };
    },
    verify(c, a) {
      return sameAnswer(KINDS.matbasic.solve(c)!.solution, a) ? ok : bad('Baris dulu, baru kolom: a_ij = baris i, kolom j.');
    },
  },

  matop: {
    solve(c): SolveResult | null {
      const r = matopResult(c);
      if (!r) return null;
      const sol: Answer = {};
      r.forEach((row, i) => row.forEach((v, j) => (sol[`r${i + 1}${j + 1}`] = v)));
      return { solution: sol, trace: ['Hitung setiap elemen hasil satu per satu'], steps: r.length * r[0].length, unique: true };
    },
    verify(c, a) {
      const r = matopResult(c);
      if (!r) return bad('Soal tidak valid.');
      const mine: Mat = r.map((row, i) => row.map((_, j) => g(a, `r${i + 1}${j + 1}`)));
      return matEq(mine, r) ? ok : bad('Ada elemen yang salah. Perkalian: baris × kolom lalu jumlahkan.');
    },
  },

  det: {
    solve(c): SolveResult | null {
      const d = getData<{ A: number[][]; mode: string; hide?: number[] }>(c);
      if (d.mode === 'compute') {
        const v = det(toMat(d.A));
        return { solution: { d: v }, trace: d.A.length === 2 ? ['det = ad − bc', `det = ${fmtQ(v)}`] : ['Ekspansi kofaktor sepanjang baris pertama', `det = ${fmtQ(v)}`], steps: 2, unique: true };
      }
      const [hi, hj] = d.hide ?? [0, 0];
      const m0 = toMat(d.A);
      const m1 = toMat(d.A);
      m1[hi][hj] = ONE;
      m0[hi][hj] = ZERO;
      const d0 = det(m0);
      const slope = sub(det(m1), d0);
      if (isZero(slope)) return null;
      const k = neg(div(d0, slope));
      return { solution: { k }, trace: ['Tulis det sebagai fungsi k lalu samakan dengan 0', `k = ${fmtQ(k)}`], steps: 2, unique: true };
    },
    verify(c, a) {
      const d = getData<{ A: number[][]; mode: string; hide?: number[] }>(c);
      if (d.mode === 'compute') return eq(g(a, 'd'), det(toMat(d.A))) ? ok : bad('Hitung ulang: ad − bc (diagonal utama dikurangi diagonal lain).');
      const [hi, hj] = d.hide ?? [0, 0];
      const m = toMat(d.A);
      m[hi][hj] = g(a, 'k');
      return isZero(det(m)) ? ok : bad('Determinan belum nol — platform masih stabil.');
    },
  },

  inverse: {
    solve(c): SolveResult | null {
      const d = getData<{ A: number[][]; mode: string; b?: number[] }>(c);
      const M = toMat(d.A);
      if (d.mode === 'apply') {
        const inv = inverse(M);
        if (!inv) return null;
        const x = applyMat(inv, (d.b ?? []).map((v) => q(v)));
        return { solution: { x: x[0], y: x[1] }, trace: ['x = A⁻¹ · b', `x = ${fmtQ(x[0])}, y = ${fmtQ(x[1])}`], steps: 2, unique: true };
      }
      const inv = inverse(M);
      if (!inv) return null;
      return { solution: { i11: inv[0][0], i12: inv[0][1], i21: inv[1][0], i22: inv[1][1] }, trace: ['A⁻¹ = (1/det)·[[d, −b], [−c, a]]', `det = ${fmtQ(det(M))}`], steps: 2, unique: true };
    },
    verify(c, a) {
      const d = getData<{ A: number[][]; mode: string; b?: number[] }>(c);
      const M = toMat(d.A);
      if (d.mode === 'apply') {
        const r = applyMat(M, [g(a, 'x'), g(a, 'y')]);
        return r.every((v, i) => eq(v, q((d.b ?? [])[i]))) ? ok : bad('A·x belum sama dengan b.');
      }
      const X: Mat = [[g(a, 'i11'), g(a, 'i12')], [g(a, 'i21'), g(a, 'i22')]];
      return matEq(matMul(M, X), identity(2)) ? ok : bad('A · A⁻¹ harus menghasilkan matriks identitas.');
    },
  },

  transform: {
    solve(c): SolveResult | null {
      const d = getData<{ mode: string; v: number[]; w: number[] }>(c);
      if (d.mode === 'scale') {
        const k = isZero(q(d.v[0])) ? div(q(d.w[1]), q(d.v[1])) : div(q(d.w[0]), q(d.v[0]));
        return { solution: { k }, trace: ['Skala k = komponen bayangan ÷ komponen asal', `k = ${fmtQ(k)}`], steps: 1, unique: true };
      }
      if (d.mode === 'map') {
        // Pencarian bilangan bulat kecil (jangkauan kontrol -4..4): kanonik = jumlah |entri| terkecil.
        const [v1, v2] = d.v;
        const found: Array<{ m: number[]; cost: number }> = [];
        for (let a = -4; a <= 4; a++) for (let b = -4; b <= 4; b++) for (let c2 = -4; c2 <= 4; c2++) for (let d2 = -4; d2 <= 4; d2++) {
          if (a * v1 + b * v2 === d.w[0] && c2 * v1 + d2 * v2 === d.w[1]) found.push({ m: [a, b, c2, d2], cost: Math.abs(a) + Math.abs(b) + Math.abs(c2) + Math.abs(d2) });
        }
        found.sort((x, y) => x.cost - y.cost);
        const cands: Answer[] = found.slice(0, 4).map((f) => A({ a: f.m[0], b: f.m[1], c: f.m[2], d: f.m[3] }));
        if (!cands.length) return null;
        return { solution: cands[0], alternatives: cands.slice(1), trace: ['Cari a,b,c,d dengan a·v₁ + b·v₂ = w₁ dan c·v₁ + d·v₂ = w₂', 'Ada banyak matriks yang memenuhi — pilih salah satu'], steps: 2, unique: false };
      }
      const M: Record<string, number[]> = { rot90: [0, -1, 1, 0], 'reflect-x': [1, 0, 0, -1], 'reflect-y': [-1, 0, 0, 1] };
      const m = M[d.mode];
      if (!m) return null;
      return { solution: A({ a: m[0], b: m[1], c: m[2], d: m[3] }), trace: ['Kolom 1 = bayangan (1,0); kolom 2 = bayangan (0,1)'], steps: 2, unique: true };
    },
    verify(c, a) {
      const d = getData<{ mode: string; v: number[]; w: number[] }>(c);
      if (d.mode === 'scale') return eq(mul(g(a, 'k'), q(d.v[0])), q(d.w[0])) && eq(mul(g(a, 'k'), q(d.v[1])), q(d.w[1])) ? ok : bad('Kalikan vektor dengan k — hasilnya belum sama dengan target.');
      const M: Mat = [[g(a, 'a'), g(a, 'b')], [g(a, 'c'), g(a, 'd')]];
      if (d.mode === 'map') {
        const r = applyMat(M, d.v.map((x) => q(x)));
        return eq(r[0], q(d.w[0])) && eq(r[1], q(d.w[1])) ? ok : bad('A·v belum sama dengan target.');
      }
      const sol = KINDS.transform.solve(c)!.solution;
      const exp: Mat = [[sol.a, sol.b], [sol.c, sol.d]];
      return matEq(M, exp) ? ok : bad('Periksa ke mana (1,0) dan (0,1) berpindah — itu kolom matriksnya.');
    },
  },

  vector: {
    solve(c): SolveResult | null {
      const d = getData<{ mode: string; u: number[]; v: number[]; a?: number; b?: number; w?: number[] }>(c);
      const u = d.u.map((x) => q(x));
      const v = d.v.map((x) => q(x));
      if (d.mode === 'add' || d.mode === 'scale') {
        const ka = q(d.mode === 'add' ? 1 : (d.a ?? 1));
        const kb = q(d.mode === 'add' ? 1 : (d.b ?? 1));
        const w = [add(mul(ka, u[0]), mul(kb, v[0])), add(mul(ka, u[1]), mul(kb, v[1]))];
        return { solution: { wx: w[0], wy: w[1] }, trace: ['Hitung komponen x lalu komponen y', `w = (${fmtQ(w[0])}, ${fmtQ(w[1])})`], steps: 2, unique: true };
      }
      if (d.mode === 'mag') {
        const s = add(mul(u[0], u[0]), mul(u[1], u[1]));
        const r = Math.round(Math.sqrt(s.n));
        return s.d === 1 && r * r === s.n ? { solution: { m: q(r) }, trace: ['|v| = √(x² + y²)', `= √${s.n} = ${r}`], steps: 2, unique: true } : null;
      }
      const w = (d.w ?? [0, 0]).map((x) => q(x));
      const s = solveSystem([[u[0], v[0]], [u[1], v[1]]], w);
      return s.kind === 'unique' ? { solution: { a: s.values[0], b: s.values[1] }, trace: ['w = a·u + b·v → dua persamaan untuk a dan b', `a = ${fmtQ(s.values[0])}, b = ${fmtQ(s.values[1])}`], steps: 3, unique: true } : null;
    },
    verify(c, a) {
      const d = getData<{ mode: string; u: number[]; v: number[]; w?: number[] }>(c);
      if (d.mode === 'comb') {
        const [aa, bb] = [g(a, 'a'), g(a, 'b')];
        const w = d.w ?? [0, 0];
        const okk = [0, 1].every((i) => eq(add(mul(aa, q(d.u[i])), mul(bb, q(d.v[i]))), q(w[i])));
        return okk ? ok : bad('a·u + b·v belum sama dengan w.');
      }
      return sameAnswer(KINDS.vector.solve(c)!.solution, a) ? ok : bad('Periksa komponen demi komponen dan tandanya.');
    },
  },

  complex: {
    solve(c): SolveResult | null {
      const r = complexResult(c);
      return r ? { solution: { re: r.re, im: r.im }, trace: ['Gunakan i² = −1', `Hasil: ${fmtQ(r.re)} + ${fmtQ(r.im)}i`], steps: 2, unique: true } : null;
    },
    verify(c, a) {
      const r = complexResult(c);
      if (!r) return bad('Soal tidak valid.');
      return cEq(r, { re: g(a, 're'), im: g(a, 'im') }) ? ok : bad('Ingat i² = −1 saat mengalikan.');
    },
  },

  eigen: {
    solve(c): SolveResult | null {
      const d = getData<{ A: number[][]; mode: string; v?: number[] }>(c);
      const M = toMat(d.A);
      if (d.mode === 'lambda') {
        const v = (d.v ?? []).map((x) => q(x));
        const Av = applyMat(M, v);
        const k = isZero(v[0]) ? 1 : 0;
        const lam = div(Av[k], v[k]);
        return v.every((vi, i) => eq(Av[i], mul(lam, vi))) ? { solution: { lam }, trace: ['Hitung A·v', 'λ = komponen (A·v) ÷ komponen v', `λ = ${fmtQ(lam)}`], steps: 2, unique: true } : null;
      }
      const pairs = eigen2(M);
      if (!pairs) return null;
      if (d.mode === 'values') {
        const vals = pairs.map((p) => p.value);
        const l = vals.length === 1 ? [vals[0], vals[0]] : vals;
        return { solution: { l1: l[0], l2: l[1] }, trace: ['Persamaan karakteristik: λ² − (a+d)λ + det = 0', `λ = ${fmtQ(l[0])} dan ${fmtQ(l[1])}`], steps: 3, unique: true };
      }
      const [p0, ...rest] = pairs;
      return {
        solution: { lam: p0.value, vx: p0.vector[0], vy: p0.vector[1] },
        alternatives: rest.map((p) => ({ lam: p.value, vx: p.vector[0], vy: p.vector[1] })),
        trace: ['Cari λ dari det(A − λI) = 0', 'Selesaikan (A − λI)v = 0 untuk v', 'Kelipatan v juga eigenvector (multi-solusi)'],
        steps: 3,
        unique: false,
      };
    },
    verify(c, a) {
      const d = getData<{ A: number[][]; mode: string }>(c);
      const M = toMat(d.A);
      if (d.mode === 'values') {
        const mine = [g(a, 'l1'), g(a, 'l2')].sort((x, y) => cmp(x, y));
        const s = KINDS.eigen.solve(c)!.solution;
        const exp = [s.l1, s.l2].sort((x, y) => cmp(x, y));
        return eq(mine[0], exp[0]) && eq(mine[1], exp[1]) ? ok : bad('Selesaikan det(A − λI) = 0.');
      }
      if (d.mode === 'lambda') return eq(g(a, 'lam'), KINDS.eigen.solve(c)!.solution.lam) ? ok : bad('Bandingkan A·v dengan v.');
      const v = [g(a, 'vx'), g(a, 'vy')];
      if (isZero(v[0]) && isZero(v[1])) return bad('Vektor nol bukan eigenvector.');
      const Av = applyMat(M, v);
      return Av.every((x, i) => eq(x, mul(g(a, 'lam'), v[i]))) ? ok : bad('A·v harus sama dengan λ·v (arah tidak berubah).');
    },
  },
};

function polyStr(sol: Answer, deg: number): string {
  const parts: string[] = [];
  for (let i = deg; i >= 0; i--) {
    const c = sol[`c${i}`];
    if (!c || isZero(c)) continue;
    const a = c.n < 0 ? neg(c) : c;
    const body = i === 0 ? fmtQ(a) : `${eq(a, ONE) ? '' : fmtQ(a)}x${i > 1 ? `^${i}` : ''}`;
    parts.push(parts.length ? `${c.n < 0 ? '- ' : '+ '}${body}` : `${c.n < 0 ? '-' : ''}${body}`);
  }
  return parts.join(' ') || '0';
}
const sgn = (v: Q): string => (v.n < 0 ? `- ${-v.n}` : `+ ${v.n}`);

function matopResult(c: Candidate): Mat | null {
  const d = getData<{ op: string; A: number[][]; B?: number[][]; k?: number }>(c);
  const Am = toMat(d.A);
  try {
    switch (d.op) {
      case 'add': return matAdd(Am, toMat(d.B ?? []));
      case 'sub': return matAdd(Am, matScale(toMat(d.B ?? []), q(-1)));
      case 'mul': return matMul(Am, toMat(d.B ?? []));
      case 'transpose': return matT(Am);
      case 'scale': return matScale(Am, q(d.k ?? 1));
      default: return null;
    }
  } catch {
    return null;
  }
}
function complexResult(c: Candidate): C | null {
  const d = getData<{ mode: string; z1: number[]; z2: number[] }>(c);
  const z1: C = { re: q(d.z1[0]), im: q(d.z1[1]) };
  const z2: C = { re: q(d.z2[0]), im: q(d.z2[1]) };
  switch (d.mode) {
    case 'add': return cAdd(z1, z2);
    case 'sub': return cSub(z1, z2);
    case 'mul': return cMul(z1, z2);
    case 'conj': return cConj(z1);
    case 'div': return isZero(z2.re) && isZero(z2.im) ? null : cDiv(z1, z2);
    default: return null;
  }
}

export const solveCandidate = (c: Candidate): SolveResult | null => {
  try {
    return KINDS[c.kind].solve(c);
  } catch {
    return null;
  }
};
export const verifyAnswer = (c: Candidate, a: Answer): VerifyResult => {
  try {
    return KINDS[c.kind].verify(c, a);
  } catch {
    return bad('Jawaban tidak valid.');
  }
};
export { ZERO, mul };
