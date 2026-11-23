/** Aritmetika rasional eksak (tanpa floating-point). */
export class MathError extends Error {}

export interface Q {
  readonly n: number;
  readonly d: number;
}

const LIMIT = 2 ** 40;

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

export function q(n: number, d = 1): Q {
  if (d === 0) throw new MathError('Pembagian dengan nol');
  if (!Number.isInteger(n) || !Number.isInteger(d)) throw new MathError('Bukan bilangan bulat');
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(Math.abs(n), d) || 1;
  n /= g;
  d /= g;
  if (Math.abs(n) > LIMIT || d > LIMIT) throw new MathError('Bilangan terlalu besar');
  return { n: n === 0 ? 0 : n, d };
}

export const ZERO = q(0);
export const ONE = q(1);
export const add = (a: Q, b: Q): Q => q(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a: Q, b: Q): Q => q(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a: Q, b: Q): Q => q(a.n * b.n, a.d * b.d);
export const div = (a: Q, b: Q): Q => {
  if (b.n === 0) throw new MathError('Pembagian dengan nol');
  return q(a.n * b.d, a.d * b.n);
};
export const neg = (a: Q): Q => q(-a.n, a.d);
export const eq = (a: Q, b: Q): boolean => a.n === b.n && a.d === b.d;
export const cmp = (a: Q, b: Q): number => Math.sign(a.n * b.d - b.n * a.d);
export const isZero = (a: Q): boolean => a.n === 0;
export const isInt = (a: Q): boolean => a.d === 1;
export const toNumber = (a: Q): number => a.n / a.d;
export const abs = (a: Q): Q => (a.n < 0 ? neg(a) : a);
export const sign = (a: Q): number => Math.sign(a.n);

export function qpow(a: Q, e: number): Q {
  if (!Number.isInteger(e)) throw new MathError('Pangkat harus bulat');
  if (e < 0) return div(ONE, qpow(a, -e));
  let r = ONE;
  for (let i = 0; i < e; i++) r = mul(r, a);
  return r;
}

export function fmtQ(a: Q): string {
  return a.d === 1 ? String(a.n) : `${a.n}/${a.d}`;
}

/** Parsing aman: "3", "-2.5", "7/4". Mengembalikan null bila tidak valid. */
export function parseQ(raw: string): Q | null {
  const s = raw.trim().replace('−', '-').replace(',', '.');
  if (!s) return null;
  const frac = /^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/.exec(s);
  try {
    if (frac) {
      const a = decimalToQ(frac[1]);
      const b = decimalToQ(frac[2]);
      return isZero(b) ? null : div(a, b);
    }
    if (/^-?\d+(?:\.\d+)?$/.test(s)) return decimalToQ(s);
  } catch {
    return null;
  }
  return null;
}

function decimalToQ(s: string): Q {
  const negative = s.startsWith('-');
  const body = negative ? s.slice(1) : s;
  const [ip, fp = ''] = body.split('.');
  const den = 10 ** fp.length;
  const num = Number(ip + fp);
  return q(negative ? -num : num, den);
}

export const isPerfectSquare = (n: number): boolean => n >= 0 && Number.isInteger(n) && Math.round(Math.sqrt(n)) ** 2 === n;

/** Akar kuadrat rasional eksak, atau null. */
export function qsqrt(a: Q): Q | null {
  if (a.n < 0) return null;
  if (!isPerfectSquare(a.n) || !isPerfectSquare(a.d)) return null;
  return q(Math.round(Math.sqrt(a.n)), Math.round(Math.sqrt(a.d)));
}
