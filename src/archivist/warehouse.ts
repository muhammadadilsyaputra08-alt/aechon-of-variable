/** Question Warehouse: gudang soal tervalidasi + Duplicate Checker. */
import { TopicCode, TOPICS } from '../data/topics';
import { Rng } from './rng';
import { Candidate, Status } from './types';
import { foundryOne } from './pipeline';

export interface Recipe {
  topic: TopicCode;
  seed: number;
  target: number;
}

export class QuestionWarehouse {
  readonly items = new Map<string, Candidate>();
  private readonly sigs = new Set<string>();
  stats = { generated: 0, rejected: 0, duplicates: 0 };
  private cursor = 1000;

  /** Duplicate Checker + Warehouse Admission. Mengembalikan soal Active atau null. */
  admit(c: Candidate): Candidate | null {
    this.stats.generated++;
    if (c.status !== 'Active') {
      this.stats.rejected++;
      return null;
    }
    if (this.sigs.has(c.signature)) {
      this.stats.duplicates++;
      return null;
    }
    this.sigs.add(c.signature);
    this.items.set(c.id, c);
    return c;
  }

  /** Mesin cetak: buat soal baru sampai `n` soal Active tersedia untuk topik+target. */
  foundry(topic: TopicCode, target: number, n: number, seedBase?: number): Candidate[] {
    const out: Candidate[] = [];
    let tries = 0;
    let seed = seedBase ?? this.cursor++ * 7919;
    while (out.length < n && tries < n * 30) {
      tries++;
      const c = this.admit(foundryOne(topic, seed, target));
      seed = (seed + 104729) >>> 0;
      if (c) out.push(c);
    }
    return out;
  }

  /** Soal deterministik untuk level campaign (seed tetap). Dikembalikan walau duplikat di gudang. */
  curated(topic: TopicCode, seed: number, target: number): Candidate {
    let s = seed;
    for (let i = 0; i < 60; i++) {
      const c = foundryOne(topic, s, target);
      if (c.status === 'Active') {
        this.items.set(c.id, c);
        this.sigs.add(c.signature);
        return c;
      }
      s = (s + 7919) >>> 0;
    }
    throw new Error(`Archivist gagal menyiapkan soal untuk ${topic}`);
  }

  list(status?: Status, topic?: TopicCode): Candidate[] {
    return [...this.items.values()].filter((c) => (!status || c.status === status) && (!topic || c.topic === topic));
  }

  retire(id: string): void {
    const c = this.items.get(id);
    if (c) this.items.set(id, { ...c, status: 'Retired' });
  }

  /** Adaptive picker: pilih soal Active terdekat dengan kesulitan yang diminta. */
  pick(opts: { topics?: TopicCode[]; difficulty?: number; rng?: Rng; exclude?: Set<string> }): Candidate {
    const rng = opts.rng ?? new Rng(Date.now() & 0xffffff);
    const topics = opts.topics?.length ? opts.topics : TOPICS.map((t) => t.code);
    const topic = rng.pick(topics);
    const d = opts.difficulty ?? 3;
    let pool = this.list('Active', topic).filter((c) => !opts.exclude?.has(c.id) && Math.abs(c.difficulty - d) <= 1);
    if (pool.length < 2) {
      this.foundry(topic, d, 4);
      pool = this.list('Active', topic).filter((c) => !opts.exclude?.has(c.id) && Math.abs(c.difficulty - d) <= 1);
    }
    if (!pool.length) pool = this.list('Active', topic);
    return rng.pick(pool);
  }

  /** Resep ringan untuk disimpan (soal bisa direproduksi dari seed). */
  recipes(): Recipe[] {
    return this.list('Active').map((c) => ({ topic: c.topic, seed: c.seed, target: c.target }));
  }
}

export const warehouse = new QuestionWarehouse();
