import { describe, expect, it } from 'vitest';
import { WB_VARIANTS, genWb } from '../src/learn/wbgen';
import { checkLine, modelPathValid } from '../src/learn/stepcheck';
import { LEVELS, floorGoals } from '../src/learn/curriculum';
import { makeQuestion, qSig } from '../src/learn/factory';
import { BOSS_CFG, bossQuestion, resolve, sessionFor } from '../src/learn/boss';
import { GUARDIANS } from '../src/data/floors';
import { save } from '../src/engine/save';

describe('Workboard Question Factory', () => {
  it('semua varian × kesulitan: kunci langkah valid & jebakan tidak diterima sebagai final', () => {
    for (const v of Object.keys(WB_VARIANTS))
      for (let d = 1; d <= 5; d++)
        for (let s = 1; s <= 25; s++) {
          const q = genWb(v, s * 31 + d, d);
          expect(modelPathValid(q), `${v} d${d} s${s}: ${q.expr}`).toBe(true);
          for (const t of q.traps) expect(checkLine(q, t.src, true).final).toBe(false);
        }
  });
  it('validator membedakan setara-belum-sederhana, salah tanda, dan sintaks', () => {
    const q = genWb('sub', 3, 4);
    expect(checkLine(q, q.steps[0], true).level).toBe('unsimplified');
    expect(checkLine(q, q.answer, true).final).toBe(true);
    expect(checkLine(q, q.traps[0].src, false).level).toBe('sign');
    expect(checkLine(q, '(x', false).level).toBe('syntax');
  });
});

describe('Workboard lanjutan: akar, logaritma, fungsi, matriks', () => {
  const ADV_TOPICS = ['A12', 'A13', 'A18', 'A19', 'A20', 'A22', 'A23', 'A24', 'A25'];
  it('A12–A13, A18–A20, A22–A25 punya varian Workboard & sublevel non-puzzle', () => {
    for (const t of ADV_TOPICS) {
      expect(Object.values(WB_VARIANTS).includes(t as never), t).toBe(true);
      expect(LEVELS[t].subs.some((s) => s.variants.some((v) => v !== 'PZ')), t).toBe(true);
    }
  });
  it('akar: setara tetapi belum sederhana ≠ final; √ dan sqrt dikenali', () => {
    const q = genWb('rad_1', 5, 3);
    expect(checkLine(q, q.answer, true).final).toBe(true);
    expect(checkLine(q, q.expr, true).level).toBe('unsimplified');
    expect(checkLine(q, '(', false).level).toBe('syntax');
    expect(checkLine(q, q.traps[0].src, false).final).toBe(false);
  });
  it('matriks: ordo salah, elemen salah, dan ekspresi belum dihitung dibedakan', () => {
    const q = genWb('mo_4', 9, 3);
    expect(checkLine(q, q.answer, true).final).toBe(true);
    expect(checkLine(q, q.steps[0], true).level).toBe('unsimplified');
    expect(checkLine(q, '[[1,2,3]]', false).level).toBe('concept');
    expect(checkLine(q, '1,2', false).level).toBe('syntax');
    const w = genWb('iv_2', 4, 3);
    expect(checkLine(w, w.answer, true).final).toBe(true);
  });
  it('anti-duplikat: 100 pengundian tiap topik lanjutan tanpa melempar galat', () => {
    for (const t of ADV_TOPICS) {
      const seen = new Set<string>();
      const last = LEVELS[t].subs[LEVELS[t].subs.length - 1];
      for (let i = 0; i < 100; i++) {
        const qn = makeQuestion({ topic: t as never, variants: last.variants, target: 5, seed: i * 613 + 7, exclude: seen });
        seen.add(qSig(qn));
      }
      expect(seen.size, t).toBeGreaterThan(40);
    }
  });
});

describe('Kurikulum & progres', () => {
  it('30 level, sublevel pertama = Guide, terakhir = Challenge, varian dikenal', () => {
    expect(Object.keys(LEVELS)).toHaveLength(30);
    for (const l of Object.values(LEVELS)) {
      expect(l.subs[0].stage).toBe('guide');
      expect(l.subs[l.subs.length - 1].stage).toBe('challenge');
      for (const s of l.subs) for (const v of s.variants) expect(v === 'PZ' || v in WB_VARIANTS).toBe(true);
    }
  });
  it('setiap lantai (kecuali 30) punya sasaran; materi dibagi antar lantai bersama', () => {
    for (let n = 1; n < 30; n++) expect(floorGoals(n).length).toBeGreaterThan(0);
    expect(floorGoals(30)).toHaveLength(0);
  });
  it('anti-pengulangan: tidak ada soal ganda pada 200 pengundian', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const q = makeQuestion({ topic: 'A03', variants: LEVELS.A03.subs[10].variants, target: 5, seed: i * 977, exclude: seen });
      expect(seen.has(qSig(q))).toBe(false);
      seen.add(qSig(q));
    }
  });
});

describe('Boss Battle Engine', () => {
  it('HP, kekalahan mereset sesi, soal baru tiap pertarungan, tanpa duplikat dalam satu pertarungan', () => {
    save.reset();
    const def = GUARDIANS.devourer;
    let { s } = sessionFor('devourer');
    const q0 = bossQuestion(def, s);
    expect(qSig(bossQuestion(def, s))).toBe(qSig(q0)); // resume = soal sama
    const first: string[] = [];
    let ev = 'hit';
    for (let i = 0; i < BOSS_CFG.devourer.player; i++) {
      const q = bossQuestion(def, s);
      first.push(qSig(q));
      ev = resolve(s, q, false);
    }
    expect(ev).toBe('lose');
    expect(save.data.learn.bossSession).toBeNull();
    s = sessionFor('devourer').s;
    const second: string[] = [];
    while (ev !== 'win') {
      const q = bossQuestion(def, s);
      second.push(qSig(q));
      ev = resolve(s, q, true);
    }
    expect(new Set(second).size).toBe(second.length);
    expect(second.filter((x) => first.includes(x))).toHaveLength(0);
    expect(save.data.learn.boss.devourer.defeated).toBe(true);
  });
});
