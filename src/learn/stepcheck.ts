/**
 * Step Validator: memeriksa satu baris pengerjaan terhadap soal secara matematis (bukan perbandingan teks).
 * Klasifikasi: benar & final, setara tapi belum sederhana, kesalahan tanda/operasi/konsep, sintaks.
 */
import { MathError, div, eq as qeq, mul, neg, parseQ } from '../math/rational';
import { Poly, parseExpr, parseRelation, pEq, pIsConst, pConstValue, pSub, relationHolds } from '../math/poly';
import { Trap, WbQuestion, ineqKey, pointOf, rootOf, rootsOf } from './wbgen';
import { evalRad, isSimpleRad, radClose, parseMat, matEq, matIsFinal, matShape } from '../math/special';

export type VerdictLevel = 'final' | 'valid' | 'unsimplified' | 'unfactored' | 'sign' | 'operation' | 'concept' | 'syntax';
export interface Verdict {
  level: VerdictLevel;
  /** Langkah diterima ke Work Area (setara dengan soal). */
  accept: boolean;
  /** Jawaban akhir benar (bentuk final yang diminta). */
  final: boolean;
  msg: string;
}
const V = (level: VerdictLevel, accept: boolean, final: boolean, msg: string): Verdict => ({ level, accept, final, msg });

const MONO_RE = /^(\d+(\/\d+)?)?([a-z](\^\d+)?)*$/;
/** Bentuk paling sederhana: tanpa kurung, tiap monomial satu kali, tiap suku berbentuk koefisien·variabel^pangkat. */
export function isSimplified(src: string): boolean {
  const s = src.replace(/\s+/g, '').replace(/−/g, '-');
  if (/[()]/.test(s) || /[*×÷/]/.test(s)) return /^-?\d+(\/\d+)?$/.test(s) || MONO_OK(s);
  return MONO_OK(s);
}
function MONO_OK(s: string): boolean {
  const terms = s.replace(/-/g, '+-').split('+').filter(Boolean);
  const seen = new Set<string>();
  for (const raw of terms) {
    const t = raw.replace(/^-/, '');
    if (!MONO_RE.test(t) || t === '') return false;
    const letters = (t.match(/[a-z](\^\d+)?/g) ?? []).map((m) => m[0]);
    if (new Set(letters).size !== letters.length) return false;
    const key = (t.match(/[a-z](\^\d+)?/g) ?? []).sort().join('');
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return terms.length > 0;
}
/** Bentuk faktor: ≥ 1 pasang kurung perkalian atau faktor persekutuan di depan kurung. */
export function isFactored(src: string): boolean {
  return /\)\*?\(/.test(src.replace(/\s+/g, ''));
}

const monoName = (k: string): string => (k === '' ? 'konstanta' : k.split(',').map((p) => { const [v, e] = p.split(':'); return e === '1' ? v : `${v}^${e}`; }).join(''));

function trapHit(q: WbQuestion, line: string): Trap | null {
  for (const t of q.traps) {
    try {
      if (q.kind === 'equation') {
        if (rootOf(t.src) !== null && rootOf(t.src) === rootOf(line)) return t;
      } else if (q.kind === 'ineq') {
        if (ineqKey(t.src) !== null && ineqKey(t.src) === ineqKey(line)) return t;
      } else if (q.kind === 'roots') {
        if (rootsOf(t.src) !== null && rootsOf(t.src) === rootsOf(line)) return t;
      } else if (q.kind === 'point') {
        const a = pointOf(t.src);
        const b = pointOf(line);
        if (a && b && a[0] === b[0] && a[1] === b[1]) return t;
      } else if (q.kind === 'rad') {
        const a = evalRad(t.src);
        const b = evalRad(line);
        if (a !== null && b !== null && radClose(a, b)) return t;
      } else if (q.kind === 'matrix') {
        const a = parseMat(t.src);
        const b = parseMat(line);
        if (a && b && matEq(a, b)) return t;
      } else if (q.kind === 'value') {
        if (pEq(parseExpr(t.src), parseExpr(line))) return t;
      } else if (pEq(parseExpr(t.src), parseExpr(line))) return t;
    } catch {
      /* jebakan tidak berlaku untuk baris ini */
    }
  }
  return null;
}
const qpoly = (q: WbQuestion): Poly => parseExpr(q.kind === 'factor' ? q.expr : q.expr);

/** Selisih koefisien pertama yang berbeda → pesan diagnostik yang spesifik. */
function diagnose(target: Poly, got: Poly): Verdict {
  const diff = pSub(got, target);
  const keys = [...diff.keys()].sort();
  const k = keys[0];
  if (k === undefined) return V('concept', false, false, 'Belum tepat.');
  const g = got.get(k);
  const t = target.get(k);
  const name = monoName(k);
  if (g && t && qeq(g, neg(t))) return V('sign', false, false, `Tanda suku ${name} terbalik. Periksa pemindahan atau pengurangan.`);
  if (!t) return V('concept', false, false, `Suku ${name} seharusnya tidak muncul / sudah habis.`);
  if (!g) return V('operation', false, false, `Suku ${name} hilang atau saling menghapus keliru.`);
  return V('operation', false, false, `Koefisien suku ${name} belum tepat. Hitung ulang bagian itu.`);
}

/** Memeriksa satu baris terhadap soal. `finalMode` menuntut bentuk akhir (sederhana / faktor / x = k). */
export function checkLine(q: WbQuestion, raw: string, finalMode: boolean): Verdict {
  const line = raw.trim();
  if (!line) return V('syntax', false, false, 'Tulis langkah pengerjaan lebih dulu.');
  try {
    if (q.kind === 'equation') return checkEquation(q, line, finalMode);
    if (q.kind === 'ineq') return checkIneq(q, line, finalMode);
    if (q.kind === 'roots') return checkRoots(q, line, finalMode);
    if (q.kind === 'point') return checkPoint(q, line, finalMode);
    if (q.kind === 'value') return checkValue(q, line, finalMode);
    if (q.kind === 'rad') return checkRad(q, line, finalMode);
    if (q.kind === 'matrix') return checkMatrix(q, line, finalMode);
    const target = qpoly(q);
    const ans = parseExpr(q.answer);
    const got = parseExpr(line);
    const same = q.kind === 'factor' ? pEq(got, target) : pEq(got, ans);
    if (!same) {
      const t = trapHit(q, line);
      if (t) return V(t.tag, false, false, t.msg);
      return diagnose(q.kind === 'factor' ? target : ans, got);
    }
    if (q.kind === 'factor') {
      return isFactored(line) ? V('final', true, true, 'Benar! Bentuk faktor sudah tepat.') : V(finalMode ? 'unfactored' : 'valid', true, false, finalMode ? 'Nilainya benar, tetapi belum dalam bentuk perkalian faktor.' : 'Setara. Lanjutkan sampai berbentuk faktor.');
    }
    if (isSimplified(line)) return V('final', true, true, 'Benar! Bentuk paling sederhana.');
    return V(finalMode ? 'unsimplified' : 'valid', true, false, finalMode ? 'Setara, tetapi belum paling sederhana. Gabungkan suku sejenis.' : 'Langkah benar. Lanjutkan menyederhanakan.');
  } catch (e) {
    return V('syntax', false, false, e instanceof MathError ? syntaxMsg(e.message) : 'Bentuk tulisan tidak dikenali.');
  }
}

function syntaxMsg(m: string): string {
  if (/Pembagian tidak habis/.test(m)) return 'Pembagian tidak habis. Bagi tiap suku secara terpisah.';
  if (/Kurung/.test(m)) return 'Kurung tidak seimbang.';
  return `Tulisan belum valid (${m.toLowerCase()}).`;
}

function checkEquation(q: WbQuestion, line: string, finalMode: boolean): Verdict {
  const want = rootOf(q.answer);
  const got = rootOf(line);
  if (got === null) return V('syntax', false, false, 'Tulis persamaan linear dengan satu tanda "=" dan variabel x.');
  if (got !== want) {
    const t = trapHit(q, line);
    if (t) return V(t.tag, false, false, t.msg);
    return V('concept', false, false, 'Persamaan ini tidak setara dengan soal: operasi harus dilakukan pada KEDUA ruas.');
  }
  const m = /^\s*x\s*=\s*(-?[\d/.]+)\s*$/.exec(line.replace(/−/g, '-')) ?? /^\s*(-?[\d/.]+)\s*=\s*x\s*$/.exec(line.replace(/−/g, '-'));
  if (m) return V('final', true, true, 'Benar! Nilai x ditemukan.');
  return V(finalMode ? 'unsimplified' : 'valid', true, false, finalMode ? 'Setara, tetapi belum berbentuk x = nilai.' : 'Langkah benar. Lanjutkan sampai x berdiri sendiri.');
}

function checkRad(q: WbQuestion, line: string, finalMode: boolean): Verdict {
  const got = evalRad(line);
  if (got === null) return V('syntax', false, false, 'Tulis dengan √ untuk akar, mis. 3√2 atau √(8). Kurung harus seimbang.');
  const want = evalRad(q.answer) as number;
  if (!radClose(got, want)) {
    const t = trapHit(q, line);
    if (t) return V(t.tag, false, false, t.msg);
    return V('operation', false, false, 'Nilainya belum sama dengan soal. Periksa penyederhanaan akar dan operasinya.');
  }
  if (isSimpleRad(line)) return V('final', true, true, 'Benar! Bentuk akar paling sederhana.');
  return V(finalMode ? 'unsimplified' : 'valid', true, false, finalMode ? 'Nilainya setara, tetapi akar belum paling sederhana (keluarkan kuadrat sempurna).' : 'Langkah benar. Lanjutkan menyederhanakan.');
}

function checkMatrix(q: WbQuestion, line: string, finalMode: boolean): Verdict {
  const got = parseMat(line);
  if (!got) return V('syntax', false, false, 'Tulis matriks seperti [[1,2],[3,4]] (tiap baris dalam [ ], dipisah koma).');
  const want = parseMat(q.answer) as NonNullable<ReturnType<typeof parseMat>>;
  if (matShape(got) !== matShape(want)) {
    const t = trapHit(q, line);
    if (t) return V(t.tag, false, false, t.msg);
    return V('concept', false, false, `Ordo hasil seharusnya ${matShape(want).replace('x', '×')} (baris × kolom).`);
  }
  if (!matEq(got, want)) {
    const t = trapHit(q, line);
    if (t) return V(t.tag, false, false, t.msg);
    for (let i = 0; i < want.length; i++)
      for (let j = 0; j < want[0].length; j++)
        if (got[i][j].n !== want[i][j].n || got[i][j].d !== want[i][j].d) return V('operation', false, false, `Elemen baris ${i + 1}, kolom ${j + 1} belum tepat. Hitung ulang bagian itu.`);
    return V('operation', false, false, 'Belum tepat.');
  }
  if (matIsFinal(line)) return V('final', true, true, 'Benar! Matriks hasil sudah tepat.');
  return V(finalMode ? 'unsimplified' : 'valid', true, false, finalMode ? 'Isinya benar, tetapi hitung tiap elemen hingga menjadi bilangan.' : 'Langkah benar. Hitung tiap elemen.');
}

function checkValue(q: WbQuestion, line: string, finalMode: boolean): Verdict {
  const got = parseExpr(line);
  if (!pIsConst(got)) return V('syntax', false, false, 'Substitusikan nilai variabel sehingga tidak ada huruf yang tersisa.');
  const want = parseExpr(q.answer);
  const gv = pConstValue(got);
  if (!qeq(gv, pConstValue(want))) {
    const t = trapHit(q, line);
    if (t) return V(t.tag, false, false, t.msg);
    return V('operation', false, false, 'Hasilnya belum tepat. Periksa substitusi dan urutan operasi.');
  }
  const single = /^-?\d+(\/\d+)?$/.test(line.replace(/\s+/g, '').replace(/−/g, '-'));
  if (single) return V('final', true, true, 'Benar! Nilainya tepat.');
  return V(finalMode ? 'unsimplified' : 'valid', true, false, finalMode ? 'Nilai benar, tetapi hitung sampai menjadi satu bilangan.' : 'Langkah benar. Hitung sampai satu bilangan.');
}

function checkIneq(q: WbQuestion, line: string, finalMode: boolean): Verdict {
  const want = ineqKey(q.answer);
  const got = ineqKey(line);
  if (got === null) return V('syntax', false, false, 'Tulis pertidaksamaan linear dengan variabel x (gunakan < > atau <= >=).');
  if (got !== want) {
    const t = trapHit(q, line);
    if (t) return V(t.tag, false, false, t.msg);
    return V('concept', false, false, 'Pertidaksamaan ini tidak setara dengan soal. Ingat: kali/bagi bilangan negatif membalik tanda.');
  }
  if (/^x(<=|>=|<|>|≤|≥)-?[\d/.]+$/.test(line.replace(/\s+/g, '').replace(/−/g, '-'))) return V('final', true, true, 'Benar! Himpunan penyelesaian ditemukan.');
  return V(finalMode ? 'unsimplified' : 'valid', true, false, finalMode ? 'Setara, tetapi belum berbentuk x < nilai.' : 'Langkah benar. Lanjutkan sampai x berdiri sendiri.');
}

function checkRoots(q: WbQuestion, line: string, finalMode: boolean): Verdict {
  const want = rootsOf(q.answer) as string;
  const got = rootsOf(line);
  if (got !== null) {
    if (got === want) return V('final', true, true, 'Benar! Semua akar ditemukan.');
    const t = trapHit(q, line);
    if (t) return V(t.tag, false, false, t.msg);
    const mine = got.split(',');
    if (mine.every((r) => want.split(',').includes(r))) return V(finalMode ? 'unsimplified' : 'valid', true, false, 'Akar ini benar, tetapi masih ada akar lain.');
    return V('operation', false, false, 'Himpunan akar belum tepat. Uji dengan mengganti ke persamaan semula.');
  }
  try {
    const rel = parseRelation(line);
    const ds = pSub(rel.lhs, rel.rhs);
    const dq = (() => {
      const r0 = parseRelation(q.expr);
      return pSub(r0.lhs, r0.rhs);
    })();
    if (rel.rel === '=' && (pEq(ds, dq) || pEq(ds, pSub(new Map(), dq)) || scaledEq(ds, dq))) return V(finalMode ? 'unsimplified' : 'valid', true, false, 'Persamaan setara. Lanjutkan sampai akar-akarnya ditulis.');
    const r1 = rootOf(line);
    if (r1 !== null && want.split(',').includes(r1)) return V(finalMode ? 'unsimplified' : 'valid', true, false, 'Satu faktor benar; cari akar dari faktor lainnya.');
    return V('concept', false, false, 'Persamaan ini tidak setara dengan soal. Jabarkan hasil faktorisasi untuk menguji.');
  } catch (e) {
    return V('syntax', false, false, e instanceof MathError ? syntaxMsg(e.message) : 'Tulis akar dipisah koma, mis. -3, 2.');
  }
}
/** ds = a·dq untuk suatu konstanta a ≠ 0 (faktor persekutuan boleh muncul). */
function scaledEq(ds: Poly, dq: Poly): boolean {
  const first = [...dq][0];
  if (!first) return false;
  const c2 = ds.get(first[0]);
  if (!c2 || c2.n === 0) return false;
  const ratio = div(c2, first[1]);
  return pEq(ds, new Map([...dq].map(([m, c]) => [m, mul(c, ratio)])));
}

function checkPoint(q: WbQuestion, line: string, finalMode: boolean): Verdict {
  const want = pointOf(q.answer) as [string, string];
  const got = pointOf(line);
  if (got) {
    if (got[0] === want[0] && got[1] === want[1]) return V('final', true, true, 'Benar! Titiknya tepat.');
    const mids = q.steps.slice(0, -1).map(pointOf);
    if (mids.some((m) => m && m[0] === got[0] && m[1] === got[1])) return V(finalMode ? 'unsimplified' : 'valid', true, false, 'Titik antara benar. Lanjutkan ke langkah berikutnya.');
    const t = trapHit(q, line);
    if (t) return V(t.tag, false, false, t.msg);
    return V('operation', false, false, 'Titik belum tepat. Periksa tanda dan urutan (x, y).');
  }
  try {
    const rel = parseRelation(line);
    const env = { x: parseQ(want[0]), y: parseQ(want[1]) } as Record<string, NonNullable<ReturnType<typeof parseQ>>>;
    if (relationHolds(rel, env)) return V(finalMode ? 'unsimplified' : 'valid', true, false, 'Persamaan ini berlaku untuk solusi. Lanjutkan sampai menulis titik (x, y).');
    return V('concept', false, false, 'Persamaan ini tidak berlaku untuk solusi sistem. Periksa eliminasi/substitusi.');
  } catch (e) {
    return V('syntax', false, false, e instanceof MathError ? syntaxMsg(e.message) : 'Tulis titik seperti (3, -2) atau persamaan seperti x = 3.');
  }
}

/** Memeriksa seluruh kunci model sebagai jalur langkah (dipakai uji dan Level Guide). */
export function modelPathValid(q: WbQuestion): boolean {
  const lines = q.steps;
  if (!lines.length) return false;
  for (let i = 0; i < lines.length; i++) {
    const v = checkLine(q, lines[i], i === lines.length - 1);
    if (!v.accept) return false;
    if (i === lines.length - 1 && !v.final) return false;
  }
  return true;
}
