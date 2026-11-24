/** Parser ekspresi aljabar aman (tanpa eval) dan aritmetika polinomial multivariabel. */
import { MathError, Q, ZERO, ONE, add, mul, div, neg, eq, isZero, q, parseQ, fmtQ, cmp } from './rational';

export type Poly = Map<string, Q>; // kunci monomial: "" | "x:2" | "x:1,y:1"
export type Env = Record<string, Q>;

const mono = (m: Record<string, number>): string =>
  Object.keys(m)
    .filter((v) => m[v] > 0)
    .sort()
    .map((v) => `${v}:${m[v]}`)
    .join(',');
const unmono = (k: string): Record<string, number> => {
  const r: Record<string, number> = {};
  if (!k) return r;
  for (const part of k.split(',')) {
    const [v, e] = part.split(':');
    r[v] = Number(e);
  }
  return r;
};

export const pConst = (c: Q): Poly => (isZero(c) ? new Map() : new Map([['', c]]));
export const pVar = (v: string): Poly => new Map([[mono({ [v]: 1 }), ONE]]);

export function pAdd(a: Poly, b: Poly): Poly {
  const r = new Map(a);
  for (const [k, c] of b) {
    const s = add(r.get(k) ?? ZERO, c);
    if (isZero(s)) r.delete(k);
    else r.set(k, s);
  }
  return r;
}
export const pNeg = (a: Poly): Poly => new Map([...a].map(([k, c]) => [k, neg(c)]));
export const pSub = (a: Poly, b: Poly): Poly => pAdd(a, pNeg(b));
export function pMul(a: Poly, b: Poly): Poly {
  const r: Poly = new Map();
  for (const [ka, ca] of a) {
    for (const [kb, cb] of b) {
      const m = unmono(ka);
      for (const [v, e] of Object.entries(unmono(kb))) m[v] = (m[v] ?? 0) + e;
      const key = mono(m);
      const s = add(r.get(key) ?? ZERO, mul(ca, cb));
      if (isZero(s)) r.delete(key);
      else r.set(key, s);
    }
  }
  return r;
}
export function pPow(a: Poly, e: number): Poly {
  if (!Number.isInteger(e) || e < 0 || e > 12) throw new MathError('Pangkat tidak didukung');
  let r = pConst(ONE);
  for (let i = 0; i < e; i++) r = pMul(r, a);
  return r;
}
export const pIsZero = (a: Poly): boolean => a.size === 0;
export const pEq = (a: Poly, b: Poly): boolean => pIsZero(pSub(a, b));
/** Pembagian eksak oleh monomial (mis. 6x^2/(3x)). Gagal bila ada suku yang tidak habis dibagi. */
export function pDivMono(a: Poly, b: Poly): Poly {
  if (b.size !== 1) throw new MathError('Pembagi harus berupa satu suku');
  const [[bk, bc]] = [...b];
  const bm = unmono(bk);
  const out: Poly = new Map();
  for (const [k, c] of a) {
    const m = unmono(k);
    const r: Record<string, number> = { ...m };
    for (const [v, e] of Object.entries(bm)) {
      if ((m[v] ?? 0) < e) throw new MathError('Pembagian tidak habis');
      r[v] = (m[v] ?? 0) - e;
    }
    out.set(mono(r), div(c, bc));
  }
  return out;
}
export const pIsConst = (a: Poly): boolean => a.size === 0 || (a.size === 1 && a.has(''));
export const pConstValue = (a: Poly): Q => a.get('') ?? ZERO;

/** Koefisien monomial satu variabel: pCoeff(p,'x',2) = koefisien x^2 (variabel lain harus tidak ada). */
export function pCoeff(p: Poly, v: string, e: number): Q {
  const key = e === 0 ? '' : mono({ [v]: e });
  return p.get(key) ?? ZERO;
}
export function pDegree(p: Poly, v: string): number {
  let d = 0;
  for (const k of p.keys()) d = Math.max(d, unmono(k)[v] ?? 0);
  return d;
}
export function pVars(p: Poly): string[] {
  const s = new Set<string>();
  for (const k of p.keys()) for (const v of Object.keys(unmono(k))) s.add(v);
  return [...s].sort();
}
export function pEval(p: Poly, env: Env): Q {
  let total = ZERO;
  for (const [k, c] of p) {
    let t = c;
    for (const [v, e] of Object.entries(unmono(k))) {
      const val = env[v];
      if (!val) throw new MathError(`Variabel ${v} belum bernilai`);
      for (let i = 0; i < e; i++) t = mul(t, val);
    }
    total = add(total, t);
  }
  return total;
}
export function pFormat(p: Poly, order = 'x'): string {
  if (p.size === 0) return '0';
  const terms = [...p].map(([k, c]) => ({ k, c, deg: Object.values(unmono(k)).reduce((a, b) => a + b, 0) }));
  terms.sort((a, b) => b.deg - a.deg || (a.k < b.k ? -1 : 1));
  void order;
  let out = '';
  terms.forEach(({ k, c }, i) => {
    const m = unmono(k);
    const vs = Object.keys(m)
      .sort()
      .map((v) => (m[v] === 1 ? v : `${v}^${m[v]}`))
      .join('');
    const a = c.n < 0 ? neg(c) : c;
    const body = vs ? (eq(a, ONE) ? vs : `${fmtQ(a)}${vs}`) : fmtQ(a);
    out += i === 0 ? (c.n < 0 ? `-${body}` : body) : c.n < 0 ? ` - ${body}` : ` + ${body}`;
  });
  return out;
}

/* ---------- Tokenizer & parser ---------- */
type Tok = { t: 'num' | 'var' | 'op' | 'lp' | 'rp'; v: string };

function normalize(s: string): string {
  return s
    .replace(/−|–/g, '-')
    .replace(/×|·/g, '*')
    .replace(/÷/g, '/')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/\s+/g, '');
}

function tokenize(src: string): Tok[] {
  const s = normalize(src);
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      out.push({ t: 'num', v: s.slice(i, j) });
      i = j;
    } else if (/[a-z]/.test(ch)) {
      out.push({ t: 'var', v: ch });
      i++;
    } else if ('+-*/^'.includes(ch)) {
      out.push({ t: 'op', v: ch });
      i++;
    } else if (ch === '(') {
      out.push({ t: 'lp', v: ch });
      i++;
    } else if (ch === ')') {
      out.push({ t: 'rp', v: ch });
      i++;
    } else throw new MathError(`Karakter tidak valid: ${ch}`);
  }
  return out;
}

class Parser {
  private p = 0;
  constructor(private readonly toks: Tok[]) {}
  private peek(): Tok | undefined {
    return this.toks[this.p];
  }
  parse(): Poly {
    const r = this.expr();
    if (this.p < this.toks.length) throw new MathError('Sintaks tidak valid');
    return r;
  }
  private expr(): Poly {
    let r = this.term();
    for (;;) {
      const t = this.peek();
      if (t?.t === 'op' && (t.v === '+' || t.v === '-')) {
        this.p++;
        const rhs = this.term();
        r = t.v === '+' ? pAdd(r, rhs) : pSub(r, rhs);
      } else return r;
    }
  }
  private term(): Poly {
    let r = this.unary();
    for (;;) {
      const t = this.peek();
      if (t?.t === 'op' && (t.v === '*' || t.v === '/')) {
        this.p++;
        const rhs = this.unary();
        if (t.v === '*') r = pMul(r, rhs);
        else {
          if (pIsConst(rhs)) {
            if (isZero(pConstValue(rhs))) throw new MathError('Pembagi tidak boleh nol');
            r = pMul(r, pConst(div(ONE, pConstValue(rhs))));
          } else r = pDivMono(r, rhs);
        }
      } else if (t && (t.t === 'var' || t.t === 'lp')) {
        r = pMul(r, this.power()); // perkalian implisit: 2x, 3(x+1), (x+1)(x-2)
      } else return r;
    }
  }
  private unary(): Poly {
    const t = this.peek();
    if (t?.t === 'op' && (t.v === '-' || t.v === '+')) {
      this.p++;
      const r = this.unary();
      return t.v === '-' ? pNeg(r) : r;
    }
    return this.power();
  }
  private power(): Poly {
    const base = this.atom();
    const t = this.peek();
    if (t?.t === 'op' && t.v === '^') {
      this.p++;
      const e = this.exponent();
      return pPow(base, e);
    }
    return base;
  }
  private exponent(): number {
    const t = this.peek();
    if (t?.t === 'num') {
      this.p++;
      const v = Number(t.v);
      if (!Number.isInteger(v)) throw new MathError('Pangkat harus bulat');
      return v;
    }
    if (t?.t === 'lp') {
      this.p++;
      const r = this.expr();
      if (this.peek()?.t !== 'rp') throw new MathError('Kurung tidak seimbang');
      this.p++;
      if (!pIsConst(r)) throw new MathError('Pangkat harus konstanta');
      const c = pConstValue(r);
      if (c.d !== 1) throw new MathError('Pangkat harus bulat');
      return c.n;
    }
    throw new MathError('Pangkat tidak valid');
  }
  private atom(): Poly {
    const t = this.peek();
    if (!t) throw new MathError('Ekspresi berakhir tiba-tiba');
    this.p++;
    if (t.t === 'num') {
      const v = parseQ(t.v);
      if (!v) throw new MathError('Angka tidak valid');
      return pConst(v);
    }
    if (t.t === 'var') return pVar(t.v);
    if (t.t === 'lp') {
      const r = this.expr();
      if (this.peek()?.t !== 'rp') throw new MathError('Kurung tidak seimbang');
      this.p++;
      return r;
    }
    throw new MathError('Sintaks tidak valid');
  }
}

export function parseExpr(src: string): Poly {
  if (src.length > 200) throw new MathError('Ekspresi terlalu panjang');
  return new Parser(tokenize(src)).parse();
}

export type Rel = '=' | '<' | '>' | '<=' | '>=';
export interface Relation {
  lhs: Poly;
  rhs: Poly;
  rel: Rel;
}
export function parseRelation(src: string): Relation {
  const s = src.replace(/≤/g, '<=').replace(/≥/g, '>=');
  const m = /^(.*?)(<=|>=|<|>|=)(.*)$/.exec(s);
  if (!m) throw new MathError('Bukan persamaan/pertidaksamaan');
  return { lhs: parseExpr(m[1]), rhs: parseExpr(m[3]), rel: m[2] as Rel };
}

/** Uji relasi pada nilai variabel tertentu. */
export function relationHolds(r: Relation, env: Env): boolean {
  const c = cmp(pEval(r.lhs, env), pEval(r.rhs, env));
  switch (r.rel) {
    case '=':
      return c === 0;
    case '<':
      return c < 0;
    case '>':
      return c > 0;
    case '<=':
      return c <= 0;
    default:
      return c >= 0;
  }
}

export const qs = q;
