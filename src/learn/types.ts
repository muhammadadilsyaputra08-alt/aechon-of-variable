/** Tipe data pembelajaran yang disimpan di save (dipisah agar engine/save tidak bergantung ke scene). */
export interface LevelProg {
  /** indeks sublevel (1-based) yang sudah selesai */
  done: number[];
  /** soal yang sudah diselesaikan pada sublevel aktif */
  qDone: number;
  /** seed soal per indeks pada sublevel aktif (agar resume menghasilkan soal yang sama) */
  seeds: number[];
  /** akurasi percobaan-pertama per sublevel: [benar, total] */
  acc: Record<string, [number, number]>;
}
export interface BossProg {
  defeated: boolean;
  /** HP pemain tersisa terbaik saat menang */
  bestResult: number;
  attempts: number;
}
export interface BossSession {
  bossId: string;
  playerHp: number;
  playerMax: number;
  bossHp: number;
  bossMax: number;
  currentQuestion: number;
  questionSeeds: number[];
  sigs: string[];
  mistakes: number;
  combo: number;
  active: boolean;
}
export interface ArchiveStats {
  topics: Record<string, [number, number]>;
  weakVariant: Record<string, number>;
  triedVariant: Record<string, number>;
  weakTag: Record<string, number>;
  sessions: number;
  recent: string[];
}
export interface LearnData {
  levels: Record<string, LevelProg>;
  boss: Record<string, BossProg>;
  bossSession: BossSession | null;
  hist: string[];
  arch: ArchiveStats;
}
export const freshLearn = (): LearnData => ({
  levels: {},
  boss: {},
  bossSession: null,
  hist: [],
  arch: { topics: {}, weakVariant: {}, triedVariant: {}, weakTag: {}, sessions: 0, recent: [] },
});
