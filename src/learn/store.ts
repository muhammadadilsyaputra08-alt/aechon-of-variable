/** Campaign Progress (permanen), riwayat soal (anti-pengulangan), dan penilaian penguasaan. */
import { TopicCode, TOPICS } from '../data/topics';
import { FLOORS } from '../data/floors';
import { save, SaveData } from '../engine/save';
import { LEVELS, floorGoals, level } from './curriculum';
import { LearnData, LevelProg } from './types';

export const learn = (): LearnData => save.data.learn;
export const persist = (): void => save.flush();

export function lp(topic: TopicCode): LevelProg {
  const L = learn().levels;
  return (L[topic] ??= { done: [], qDone: 0, seeds: [], acc: {} });
}
export const isDone = (topic: TopicCode, idx: number): boolean => lp(topic).done.includes(idx);
export const doneCount = (topic: TopicCode): number => lp(topic).done.length;

/** Sublevel berikutnya yang belum selesai, dibatasi sasaran `goal` (jumlah sublevel pertama). */
export function nextIndex(topic: TopicCode, goal: number): number | null {
  for (let i = 1; i <= Math.min(goal, level(topic).subs.length); i++) if (!isDone(topic, i)) return i;
  return null;
}
/** Sublevel aktif = yang akan dilanjutkan (resume). */
export function activeIndex(topic: TopicCode): number {
  return nextIndex(topic, level(topic).subs.length) ?? level(topic).subs.length;
}

export function accuracy(topic: TopicCode): number | null {
  let ok = 0;
  let tot = 0;
  for (const [i, [a, b]] of Object.entries(lp(topic).acc)) {
    if (!isDone(topic, Number(i))) continue;
    ok += a;
    tot += b;
  }
  return tot ? ok / tot : null;
}
export type Mastery = 'learning' | 'proficient' | 'mastered';
export function mastery(topic: TopicCode): Mastery {
  const L = level(topic);
  const n = doneCount(topic);
  const acc = accuracy(topic) ?? 0;
  if (n >= L.subs.length && acc >= L.passAccuracy) return 'mastered';
  if (n >= Math.ceil(L.subs.length / 2) && acc >= 0.6) return 'proficient';
  return 'learning';
}
export function levelProgressText(topic: TopicCode): string {
  return `${doneCount(topic)}/${level(topic).subs.length}`;
}

/* ---------- Riwayat soal ---------- */
const HIST_MAX = 3000;
let histCache: Set<string> | null = null;
let histSrc: string[] | null = null;
export function histSet(): Set<string> {
  const h = learn().hist;
  if (!histCache || histSrc !== h) {
    histCache = new Set(h);
    histSrc = h;
  }
  return histCache;
}
export function addHist(sig: string): void {
  const h = learn().hist;
  if (histSet().has(sig)) return;
  h.push(sig);
  histCache?.add(sig);
  if (h.length > HIST_MAX) {
    h.splice(0, h.length - HIST_MAX);
    histCache = null;
  }
}

/* ---------- Hasil ---------- */
export function recordAnswer(topic: TopicCode, idx: number, firstTry: boolean): void {
  const p = lp(topic);
  const cur = (p.acc[idx] ??= [0, 0]);
  cur[1]++;
  if (firstTry) cur[0]++;
}
/** Menandai sublevel selesai dan memajukan state. Mengembalikan akurasinya. */
export function completeSub(topic: TopicCode, idx: number): number {
  const p = lp(topic);
  if (!p.done.includes(idx)) p.done.push(idx);
  p.qDone = 0;
  p.seeds = [];
  const [a, b] = p.acc[idx] ?? [0, 0];
  persist();
  return b ? a / b : 1;
}
export function failChallenge(topic: TopicCode, idx: number): void {
  const p = lp(topic);
  delete p.acc[idx];
  p.qDone = 0;
  p.seeds = [];
  persist();
}
export function resetLevel(topic: TopicCode): void {
  delete learn().levels[topic];
  persist();
}

/** Bintang lantai (1–3) dari akurasi materi pada sasaran lantai tersebut. */
export function floorStars(n: number): number {
  const accs = floorGoals(n).map((g) => accuracy(g.topic)).filter((a): a is number => a !== null);
  if (!accs.length) return 2;
  const m = accs.reduce((a, b) => a + b, 0) / accs.length;
  return m >= 0.9 ? 3 : m >= 0.7 ? 2 : 1;
}
export function floorGoalsMet(n: number): boolean {
  return floorGoals(n).every((g) => nextIndex(g.topic, g.count) === null);
}

/* ---------- Migrasi save v1 → v2 ---------- */
export function migrateSave(d: SaveData): void {
  for (const f of FLOORS) {
    if (!d.floors[f.n]?.cleared) continue;
    for (const g of floorGoals(f.n)) {
      const p = (d.learn.levels[g.topic] ??= { done: [], qDone: 0, seeds: [], acc: {} });
      for (let i = 1; i <= g.count; i++) if (!p.done.includes(i)) p.done.push(i);
    }
  }
}
save.migrate = migrateSave;

export const allTopics = (): TopicCode[] => TOPICS.map((t) => t.code);
export { LEVELS };
