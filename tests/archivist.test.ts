import { describe, expect, it } from 'vitest';
import { TOPICS } from '../src/data/topics';
import { foundryOne, validateCandidate } from '../src/archivist/pipeline';
import { generateCandidate } from '../src/archivist/generators';
import { solveCandidate, verifyAnswer } from '../src/archivist/kinds';
import { QuestionWarehouse } from '../src/archivist/warehouse';
import { q } from '../src/math/rational';

describe('Archivist Engine', () => {
  it('setiap topik × kesulitan menghasilkan soal Active tervalidasi (solver first)', () => {
    const report: string[] = [];
    for (const t of TOPICS) {
      for (let d = 1; d <= 5; d++) {
        let ok = 0;
        const reasons = new Map<string, number>();
        for (let s = 0; s < 40; s++) {
          const c = foundryOne(t.code, 1000 + s * 31, d);
          if (c.status === 'Active') {
            ok++;
            // jejak & hint tersedia, solusi lolos verifier
            expect(c.hints).toHaveLength(5);
            expect(c.trace.length).toBeGreaterThan(0);
            expect(verifyAnswer(c, c.solution!).ok).toBe(true);
          } else reasons.set(c.rejectReason ?? c.status, (reasons.get(c.rejectReason ?? c.status) ?? 0) + 1);
        }
        if (ok < 25) report.push(`${t.code} d${d}: ${ok}/40 ${JSON.stringify([...reasons])}`);
        expect(ok, `${t.code} d${d} terlalu sering ditolak: ${JSON.stringify([...reasons])}`).toBeGreaterThanOrEqual(25);
      }
    }
    expect(report).toEqual([]);
  });

  it('deterministik: seed sama → soal sama', () => {
    for (const t of TOPICS) {
      const a = generateCandidate(t.code, 4242, 3);
      const b = generateCandidate(t.code, 4242, 3);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
  });

  it('niat generator selalu disetujui solver independen', () => {
    for (const t of TOPICS) {
      for (let s = 0; s < 30; s++) {
        const c = generateCandidate(t.code, 7 + s * 13, 1 + (s % 5));
        if (!c.intended) continue;
        const sol = solveCandidate(c);
        if (!sol) continue; // ditolak oleh validator; diuji terpisah
        expect(verifyAnswer(c, c.intended).ok, `${c.id}: ${JSON.stringify(c.data)}`).toBe(true);
      }
    }
  });

  it('jawaban salah ditolak secara matematis', () => {
    const c = foundryOne('A05', 11, 3);
    expect(c.status).toBe('Active');
    const wrong = { x: q(((c.solution!.x.n / c.solution!.x.d) as number) + 1) };
    expect(verifyAnswer(c, wrong).ok).toBe(false);
  });

  it('multi-solusi: semua eigenpair & kelipatannya sah, vektor nol ditolak', () => {
    let found = 0;
    for (let s = 0; s < 60 && found < 3; s++) {
      const c = foundryOne('A30', 500 + s, 5);
      if (c.status !== 'Active' || c.data.mode !== 'pair') continue;
      found++;
      expect(c.multiSolution).toBe(true);
      const sol = c.solution!;
      const scaled = { lam: sol.lam, vx: q(sol.vx.n * 3, sol.vx.d), vy: q(sol.vy.n * 3, sol.vy.d) };
      expect(verifyAnswer(c, scaled).ok).toBe(true);
      for (const alt of c.alternatives ?? []) expect(verifyAnswer(c, alt).ok).toBe(true);
      expect(verifyAnswer(c, { lam: sol.lam, vx: q(0), vy: q(0) }).ok).toBe(false);
    }
    expect(found).toBeGreaterThan(0);
  });

  it('soal tanpa solusi / ambigu ditolak', () => {
    const c = generateCandidate('A05', 1, 3);
    const noSol = validateCandidate({ ...c, data: { eq: 'x + 1 = x + 2' }, intended: null });
    expect(noSol.status).toBe('Rejected');
    const dual = generateCandidate('A10', 3, 3);
    const parallel = validateCandidate({ ...dual, data: { eqs: ['y = 2x + 1', 'y = 2x + 3'] }, intended: null });
    expect(parallel.status).toBe('Rejected');
    const multiFlag = validateCandidate({ ...generateCandidate('A05', 2, 3), multiSolution: true });
    expect(multiFlag.status).toBe('Rejected');
    const root = generateCandidate('A17', 5, 2);
    expect(validateCandidate({ ...root, data: { eq: 'x^2 + 1 = 0', mode: 'roots' }, intended: null }).status).toBe('Rejected');
  });

  it('gudang soal: duplikat dicegah, pick adaptif bekerja', () => {
    const w = new QuestionWarehouse();
    const first = w.foundry('A10', 2, 6, 99);
    expect(first.length).toBe(6);
    const again = w.foundry('A10', 2, 6, 99);
    expect(again.length).toBeLessThanOrEqual(6);
    expect(new Set([...w.items.values()].map((c) => c.signature)).size).toBe(w.items.size);
    const p = w.pick({ topics: ['A10'], difficulty: 2 });
    expect(p.status).toBe('Active');
    w.retire(p.id);
    expect(w.items.get(p.id)!.status).toBe('Retired');
  });
});
