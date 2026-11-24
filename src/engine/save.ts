/** Penyimpanan lokal otomatis (localStorage). Tidak ada hukuman progres permanen. */
import { Lang, setLang } from './i18n';
import { LearnData, freshLearn } from '../learn/types';

export interface Settings {
  lang: Lang;
  textScale: 1 | 1.25;
  animSpeed: 0.6 | 1 | 1.6;
  typeSpeed: 0.6 | 1 | 2;
  reduceFx: boolean;
  music: number; // 0..1
  sfx: number;
}
export interface FloorRec {
  cleared: boolean;
  stars: number[]; // bintang terbaik per slot puzzle
}
export interface Stats {
  solved: number;
  hints: number;
  mistakes: number;
  noHint: number;
  byKind: Record<string, number>;
  mistakesByTopic: Record<string, number>;
  hintsByTopic: Record<string, number>;
  recent: boolean[]; // 10 hasil terakhir (true = benar tanpa salah)
}
export interface SaveData {
  v: 2;
  settings: Settings;
  floors: Record<number, FloorRec>;
  shards: number;
  kp: number;
  learned: string[];
  bookmarks: string[];
  achievements: Record<string, number>;
  stats: Stats;
  read: string[];
  flags: Record<string, number>;
  guardians: number[];
  tutorialDone: boolean;
  prologueDone: boolean;
  medals: Record<string, 'bronze' | 'silver' | 'gold'>;
  labs: Record<string, number[]>;
  /** v2: kurikulum level/sublevel, sesi boss, riwayat soal, statistik Archive */
  learn: LearnData;
}

const KEY = 'archon_of_variables_save_v1';
const fresh = (): SaveData => ({
  v: 2,
  settings: { lang: 'id', textScale: 1, animSpeed: 1, typeSpeed: 1, reduceFx: false, music: 0.5, sfx: 0.8 },
  floors: {},
  shards: 0,
  kp: 0,
  learned: [],
  bookmarks: [],
  achievements: {},
  stats: { solved: 0, hints: 0, mistakes: 0, noHint: 0, byKind: {}, mistakesByTopic: {}, hintsByTopic: {}, recent: [] },
  read: [],
  flags: {},
  guardians: [],
  tutorialDone: false,
  prologueDone: false,
  medals: {},
  labs: {},
  learn: freshLearn(),
});

class SaveStore {
  data: SaveData = fresh();
  /** Dipasang oleh learn/store untuk migrasi data lama (menghindari impor melingkar). */
  migrate: ((d: SaveData) => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  load(): void {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SaveData>;
        const base = fresh();
        this.data = { ...base, ...parsed, v: 2, settings: { ...base.settings, ...parsed.settings }, stats: { ...base.stats, ...parsed.stats }, learn: { ...base.learn, ...parsed.learn, arch: { ...base.learn.arch, ...parsed.learn?.arch } } };
        // Migrasi v1 → v2: lantai yang sudah selesai dianggap menuntaskan sublevel yang bersangkutan.
        if ((parsed as { v?: number }).v !== 2) this.migrate?.(this.data);
      }
    } catch {
      this.data = fresh();
    }
    setLang(this.data.settings.lang);
  }
  /** Simpan otomatis (ditunda sedikit agar hemat I/O). */
  commit(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, 250);
  }
  flush(): void {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* penyimpanan penuh/dinonaktifkan: permainan tetap berjalan */
    }
  }
  reset(): void {
    const s = this.data.settings;
    this.data = fresh();
    this.data.settings = s;
    this.flush();
  }
  floorRec(n: number): FloorRec {
    return this.data.floors[n] ?? { cleared: false, stars: [] };
  }
  /** Kondisi restorasi lantai: Ruined / Partially Restored / Fully Restored. */
  floorState(n: number): 'ruined' | 'partial' | 'full' {
    const r = this.floorRec(n);
    if (!r.cleared) return 'ruined';
    return r.stars.length > 0 && r.stars.every((s) => s >= 2) ? 'full' : 'partial';
  }
  highestUnlocked(): number {
    let n = 1;
    while (n < 30 && this.floorRec(n).cleared) n++;
    return n;
  }
}
export const save = new SaveStore();
