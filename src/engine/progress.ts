/** Pencatatan hasil puzzle: statistik, hadiah, pencapaian, dan adaptasi kesulitan yang transparan. */
import { Candidate } from '../archivist/types';
import { save } from './save';
import { ACHIEVEMENTS } from '../data/achievements';
import { app } from './core';
import { tb } from './i18n';

export interface PuzzleResult {
  stars: number;
  attempts: number;
  hints: number;
  steps: number;
  seconds: number;
  success: boolean;
}

export function starsFor(c: Candidate, attempts: number, hints: number, steps: number): number {
  if (c.kind === 'balance') {
    const optimal = Math.max(1, c.steps);
    const efficient = steps <= optimal + 1;
    return 1 + (efficient ? 1 : 0) + (steps <= optimal && hints === 0 ? 1 : 0);
  }
  const efficient = attempts <= 2;
  return 1 + (efficient ? 1 : 0) + (attempts === 1 && hints === 0 ? 1 : 0);
}

export function recordMistake(c: { topic: string }): void {
  const s = save.data.stats;
  s.mistakes++;
  s.mistakesByTopic[c.topic] = (s.mistakesByTopic[c.topic] ?? 0) + 1;
  save.commit();
}
export function recordHint(c: { topic: string }): void {
  const s = save.data.stats;
  s.hints++;
  s.hintsByTopic[c.topic] = (s.hintsByTopic[c.topic] ?? 0) + 1;
  save.commit();
}
export function markLearned(topic: string): boolean {
  if (save.data.learned.includes(topic)) return false;
  save.data.learned.push(topic);
  save.data.kp += 3;
  save.commit();
  return true;
}

/** Dipanggil saat puzzle berhasil. Mengembalikan jumlah shard yang didapat. */
export function recordSuccess(c: { topic: string; kind: string }, res: PuzzleResult, practice: boolean): number {
  const s = save.data.stats;
  s.solved++;
  s.byKind[c.kind] = (s.byKind[c.kind] ?? 0) + 1;
  if (res.hints === 0) s.noHint++;
  s.recent = [...s.recent.slice(-9), res.attempts === 1 && res.hints === 0];
  markLearned(c.topic);
  const shards = practice ? 1 : 2 + res.stars * 2;
  save.data.shards += shards;
  checkAchievements();
  save.commit();
  return shards;
}

export function checkAchievements(): void {
  for (const a of ACHIEVEMENTS) {
    if (!save.data.achievements[a.id] && a.test(save.data)) {
      save.data.achievements[a.id] = Date.now();
      app?.toast(`★ ${tb(a.name)}`);
    }
  }
}

/** Kesulitan adaptif: dipakai Challenge/Review untuk memilih soal dari gudang. */
export function adaptiveDifficulty(base = 3): number {
  const r = save.data.stats.recent;
  if (r.length < 3) return base;
  const rate = r.filter(Boolean).length / r.length;
  if (rate >= 0.8) return Math.min(5, base + 1);
  if (rate <= 0.3) return Math.max(1, base - 1);
  return base;
}
