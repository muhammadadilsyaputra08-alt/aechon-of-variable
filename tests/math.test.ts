import { describe, expect, it } from 'vitest';
import { parseExpr, parseRelation, pEq, pFormat, relationHolds } from '../src/math/poly';
import { fmtQ, parseQ, q } from '../src/math/rational';
import { det, eigen2, inverse, mat, matMul, identity, matEq, solveInequality1, solveLinear1, solveQuadratic, solveSystem, simplifySqrt, intLog, cx, cMul, cDiv, cEq } from '../src/math/solve';

describe('Math Engine', () => {
  it('parser aman: ekspansi & perkalian implisit', () => {
    expect(pEq(parseExpr('(x+2)(x+3)'), parseExpr('x^2+5x+6'))).toBe(true);
    expect(pEq(parseExpr('2(3x+4)-5x+1'), parseExpr('x+9'))).toBe(true);
    expect(pFormat(parseExpr('(x-1)^3'))).toBe('x^3 - 3x^2 + 3x - 1');
    expect(parseExpr('2^3*2^2').get('')).toEqual(q(32));
    expect(pEq(parseExpr('(6x+9)÷3'), parseExpr('2x+3'))).toBe(true);
  });
  it('menolak masukan berbahaya / tidak valid', () => {
    for (const bad of ['eval("1")', 'x**2', '1/0', 'x/(x+1)', '2^x', 'process.exit()', '(((', '1+']) expect(() => parseExpr(bad)).toThrow();
  });
  it('rasional eksak, tanpa galat floating-point', () => {
    expect(fmtQ(parseQ('0.1')!)).toBe('1/10');
    expect(parseQ('1/0')).toBeNull();
    expect(fmtQ(parseQ('-7/14')!)).toBe('-1/2');
  });
  it('persamaan linear 2x+3=11 → x=4', () => {
    const s = solveLinear1(parseRelation('2x + 3 = 11'));
    expect(s.kind === 'unique' && fmtQ(s.value)).toBe('4');
    expect(solveLinear1(parseRelation('x + 1 = x + 2')).kind).toBe('none');
    expect(solveLinear1(parseRelation('x + 1 = x + 1')).kind).toBe('infinite');
    expect(relationHolds(parseRelation('3x - 1 = 2x + 4'), { x: q(5) })).toBe(true);
  });
  it('pertidaksamaan: tanda dibalik untuk koefisien negatif', () => {
    const s = solveInequality1(parseRelation('-2x + 4 > 10'))!;
    expect(s.dir).toBe('lt');
    expect(fmtQ(s.bound)).toBe('-3');
  });
  it('kuadrat, SPLDV, 3 variabel', () => {
    expect(solveQuadratic(q(1), q(-5), q(6)).roots!.map(fmtQ)).toEqual(['2', '3']);
    expect(solveQuadratic(q(1), q(0), q(1)).roots).toBeNull();
    const s = solveSystem(mat([[2, -1], [1, 1]]), [q(-1), q(7)]);
    expect(s.kind === 'unique' && s.values.map(fmtQ)).toEqual(['2', '5']);
    expect(solveSystem(mat([[1, 1], [2, 2]]), [q(1), q(3)]).kind).toBe('none');
  });
  it('matriks: determinan, invers, eigen', () => {
    expect(fmtQ(det(mat([[2, 1], [4, 2]])))).toBe('0');
    expect(fmtQ(det(mat([[2, 0, 1], [1, 3, 2], [0, 5, 1]])))).toBe('-3'.replace('-3', String(2 * (3 - 10) - 0 + 1 * 5)));
    const A = mat([[2, 1], [1, 1]]);
    expect(matEq(matMul(A, inverse(A)!), identity(2))).toBe(true);
    expect(inverse(mat([[1, 2], [2, 4]]))).toBeNull();
    const ev = eigen2(mat([[2, 0], [0, 3]]))!;
    expect(ev.map((e) => fmtQ(e.value))).toEqual(['2', '3']);
  });
  it('akar, logaritma, kompleks', () => {
    expect(simplifySqrt(72)).toEqual({ a: 6, b: 2 });
    expect(intLog(2, 8)).toBe(3);
    expect(intLog(2, 9)).toBeNull();
    const z = cMul(cx(3, 2), cx(1, -4));
    expect(cEq(z, cx(11, -10))).toBe(true);
    expect(cEq(cDiv(z, cx(1, -4)), cx(3, 2))).toBe(true);
  });
});
