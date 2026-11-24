/** The Infinite Archive: sesi latihan tanpa batas — Free, Adaptive, Mixed, Weakness Training. */
import { TOPICS, TopicCode } from '../data/topics';
import { save } from '../engine/save';
import { Rng } from '../archivist/rng';
import { Question, makeQuestion, qSig, qTopic, qVariant } from './factory';
import { WB_VARIANTS, hasWb, variantsFor } from './wbgen';
import { learn, persist } from './store';

export type ArchiveMode = 'free' | 'adaptive' | 'mixed' | 'weakness';
export interface ArchiveCfg {
  mode: ArchiveMode;
  topic: TopicCode;
  difficulty: number; // 1..5
  workboard: boolean;
}
export interface AnswerRec {
  topic: TopicCode;
  variant: string;
  ok: boolean;
  firstTry: boolean;
  tag?: string;
}

export class ArchiveSession {
  asked = 0;
  correct = 0;
  difficulty: number;
  readonly sigs = new Set<string>();
  readonly byTopic: Record<string, [number, number]> = {};
  readonly byVariant: Record<string, [number, number]> = {};
  private window: boolean[] = [];
  private rng = new Rng((Date.now() & 0x7fffffff) ^ 0x5a17);
  constructor(readonly cfg: ArchiveCfg) {
    this.difficulty = cfg.difficulty;
    learn().arch.sessions++;
    persist();
  }

  private pickTopic(): { topic: TopicCode; variant?: string } {
    const a = learn().arch;
    const { cfg } = this;
    if (cfg.mode === 'free' || cfg.mode === 'adaptive') return { topic: cfg.topic };
    if (cfg.mode === 'mixed') {
      const learned = TOPICS.map((t) => t.code).filter((c) => save.data.learned.includes(c));
      const pool = learned.length >= 2 ? learned : TOPICS.map((t) => t.code);
      return { topic: this.rng.pick(pool) };
    }
    // weakness: varian yang paling sering salah (butuh cukup data), lainnya materi dengan akurasi terendah
    const weak = Object.entries(a.weakVariant).filter(([v, n]) => n >= 2 && WB_VARIANTS[v]).sort((x, y) => y[1] / Math.max(1, a.triedVariant[y[0]] ?? 1) - x[1] / Math.max(1, a.triedVariant[x[0]] ?? 1));
    if (weak.length && this.rng.chance(0.75)) {
      const [v] = this.rng.pick(weak.slice(0, 3));
      return { topic: WB_VARIANTS[v], variant: v };
    }
    const accs = Object.entries(a.topics).filter(([, [, n]]) => n >= 3).sort((x, y) => x[1][0] / x[1][1] - y[1][0] / y[1][1]);
    if (accs.length) return { topic: accs[0][0] as TopicCode };
    return { topic: this.rng.pick(TOPICS.map((t) => t.code)) };
  }

  next(): Question {
    const { topic, variant } = this.pickTopic();
    const exclude = new Set<string>([...this.sigs, ...learn().arch.recent]);
    const wb = this.cfg.workboard && hasWb(topic);
    const q = makeQuestion({
      topic, target: this.difficulty, seed: (this.rng.next() * 0xffffffff) >>> 0, exclude,
      variants: wb ? (variant ? [variant] : variantsFor(topic, this.difficulty)) : undefined, puzzleOnly: !wb,
    });
    this.sigs.add(qSig(q));
    return q;
  }

  record(q: Question, firstTry: boolean, ok: boolean, tag?: string): AnswerRec {
    const topic = qTopic(q);
    const variant = qVariant(q);
    const a = learn().arch;
    this.asked++;
    if (ok) this.correct++;
    (this.byTopic[topic] ??= [0, 0])[1]++;
    (this.byVariant[variant] ??= [0, 0])[1]++;
    if (ok && firstTry) {
      this.byTopic[topic][0]++;
      this.byVariant[variant][0]++;
    }
    (a.topics[topic] ??= [0, 0])[1]++;
    if (ok && firstTry) a.topics[topic][0]++;
    a.triedVariant[variant] = (a.triedVariant[variant] ?? 0) + 1;
    if (!(ok && firstTry)) {
      a.weakVariant[variant] = (a.weakVariant[variant] ?? 0) + 1;
      if (tag) a.weakTag[tag] = (a.weakTag[tag] ?? 0) + 1;
    } else if ((a.weakVariant[variant] ?? 0) > 0 && this.rng.chance(0.34)) {
      a.weakVariant[variant]--; // keberhasilan beruntun mengurangi bobot kelemahan
    }
    a.recent.push(qSig(q));
    if (a.recent.length > 600) a.recent.splice(0, a.recent.length - 600);
    // adaptasi: butuh jendela 5 soal, bukan satu jawaban
    this.window.push(ok && firstTry);
    if (this.cfg.mode === 'adaptive' && this.window.length >= 5) {
      const n = this.window.filter(Boolean).length;
      if (n >= 4) this.difficulty = Math.min(5, this.difficulty + 1);
      else if (n <= 1) this.difficulty = Math.max(1, this.difficulty - 1);
      this.window = [];
    } else if (this.window.length > 5) this.window.shift();
    persist();
    return { topic, variant, ok, firstTry, tag };
  }

  get accuracy(): number {
    return this.asked ? this.correct / this.asked : 0;
  }
  /** Fokus latihan berikutnya: varian dengan penguasaan terendah (minimal 3 soal). */
  focus(): string | null {
    const e = Object.entries(this.byVariant).filter(([, [, n]]) => n >= 2).sort((x, y) => x[1][0] / x[1][1] - y[1][0] / y[1][1]);
    return e.length && e[0][1][0] / e[0][1][1] < 0.8 ? e[0][0] : null;
  }
}
