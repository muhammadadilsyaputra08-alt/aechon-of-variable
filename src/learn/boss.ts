/** Boss Battle Engine: HP pemain & boss, antrean soal acak (tidak pernah mengulang), reset bila kalah. */
import { GUARDIANS, GuardianDef } from '../data/floors';
import { save } from '../engine/save';
import { BossSession } from './types';
import { learn, persist } from './store';
import { Question, makeQuestion, qSig } from './factory';
import { variantsFor, hasWb } from './wbgen';
import { PZ } from './curriculum';

export const BOSS_CFG: Record<GuardianDef['id'], { player: number; boss: number }> = {
  keeper: { player: 5, boss: 5 },
  twins: { player: 5, boss: 6 },
  devourer: { player: 5, boss: 7 },
  null: { player: 6, boss: 9 },
};

export function newSession(id: GuardianDef['id']): BossSession {
  const c = BOSS_CFG[id];
  return {
    bossId: id, playerHp: c.player, playerMax: c.player, bossHp: c.boss, bossMax: c.boss,
    currentQuestion: 0, questionSeeds: [], sigs: [], mistakes: 0, combo: 0, active: true,
  };
}
/** Sesi aktif untuk boss ini (resume) atau sesi baru. */
export function sessionFor(id: GuardianDef['id']): { s: BossSession; resumed: boolean } {
  const cur = learn().bossSession;
  if (cur && cur.active && cur.bossId === id && cur.playerHp > 0 && cur.bossHp > 0) return { s: cur, resumed: cur.currentQuestion > 0 };
  const s = newSession(id);
  learn().bossSession = s;
  persist();
  return { s, resumed: false };
}
export const phaseIndex = (def: GuardianDef, s: BossSession): number =>
  Math.min(def.phases.length - 1, Math.floor(((s.bossMax - s.bossHp) / s.bossMax) * def.phases.length));

/** Soal baru untuk pertarungan ini. Seed disimpan agar resume setelah keluar menghasilkan soal yang sama. */
export function bossQuestion(def: GuardianDef, s: BossSession): Question {
  const ph = def.phases[phaseIndex(def, s)];
  if (s.questionSeeds[s.currentQuestion] === undefined) {
    s.questionSeeds[s.currentQuestion] = (Math.random() * 0xffffffff) >>> 0;
    persist();
  }
  const seed = s.questionSeeds[s.currentQuestion];
  const variants = hasWb(ph.topic) ? variantsFor(ph.topic, ph.target) : [PZ];
  const sigsBefore = new Set(s.sigs);
  const q = makeQuestion({ topic: ph.topic, variants, target: ph.target, seed, exclude: sigsBefore });
  return q;
}
export type BossEvent = 'hit' | 'miss' | 'win' | 'lose';
export function resolve(s: BossSession, q: Question, correct: boolean): BossEvent {
  s.sigs.push(qSig(q));
  s.currentQuestion++;
  if (correct) {
    s.bossHp = Math.max(0, s.bossHp - 1);
    s.combo++;
  } else {
    s.playerHp = Math.max(0, s.playerHp - 1);
    s.mistakes++;
    s.combo = 0;
  }
  let ev: BossEvent = correct ? 'hit' : 'miss';
  if (s.bossHp <= 0) {
    ev = 'win';
    s.active = false;
    const bp = (learn().boss[s.bossId] ??= { defeated: false, bestResult: 0, attempts: 0 });
    bp.defeated = true;
    bp.attempts++;
    bp.bestResult = Math.max(bp.bestResult, s.playerHp);
    const gi = { keeper: 1, twins: 2, devourer: 3, null: 4 }[s.bossId as GuardianDef['id']];
    if (!save.data.guardians.includes(gi)) save.data.guardians.push(gi);
    learn().bossSession = null;
  } else if (s.playerHp <= 0) {
    ev = 'lose';
    s.active = false;
    const bp = (learn().boss[s.bossId] ??= { defeated: false, bestResult: 0, attempts: 0 });
    bp.attempts++;
    learn().bossSession = null;
  }
  persist();
  return ev;
}
export const bossDef = (id: string): GuardianDef => GUARDIANS[id as GuardianDef['id']];
