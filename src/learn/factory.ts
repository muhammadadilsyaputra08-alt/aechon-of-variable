/** Question Factory terpadu: satu pintu untuk soal Workboard (ekspresi) dan puzzle visual Archivist, dengan anti-pengulangan. */
import { TopicCode } from '../data/topics';
import { Rng } from '../archivist/rng';
import { warehouse } from '../archivist/warehouse';
import { Candidate } from '../archivist/types';
import { WbQuestion, genWb, hasWb, variantsFor } from './wbgen';
import { PZ } from './curriculum';

export type Question = { type: 'wb'; q: WbQuestion } | { type: 'pz'; cand: Candidate };
export const qSig = (q: Question): string => (q.type === 'wb' ? q.q.signature : `pz|${q.cand.signature}`);
export const qTopic = (q: Question): TopicCode => (q.type === 'wb' ? q.q.topic : q.cand.topic);
export const qVariant = (q: Question): string => (q.type === 'wb' ? q.q.variant : `pz:${q.cand.kind}`);
export const qTitle = (q: Question): string => (q.type === 'wb' ? q.q.prompt.id : q.cand.prompt.id);

export interface MakeOpts {
  topic: TopicCode;
  /** daftar varian (boleh memuat PZ). Kosong = otomatis dari kesulitan. */
  variants?: string[];
  target: number;
  seed: number;
  exclude: Set<string>;
  /** paksa puzzle visual (Archive tanpa Workboard) */
  puzzleOnly?: boolean;
}

export function makeQuestion(o: MakeOpts): Question {
  let pool = o.variants?.length ? o.variants : hasWb(o.topic) ? variantsFor(o.topic, o.target) : [PZ];
  if (o.puzzleOnly || !hasWb(o.topic)) pool = [PZ];
  let last: Question | null = null;
  for (let k = 0; k < 80; k++) {
    const seed = (o.seed + k * 7919) >>> 0;
    const r = new Rng(seed ^ 0x9e3779b9);
    const v = r.pick(pool);
    let qn: Question;
    if (v === PZ) {
      // varian puzzle dicoba sekali per ~3 percobaan agar tidak terjebak pada duplikat
      qn = { type: 'pz', cand: warehouse.curated(o.topic, seed, o.target) };
    } else qn = { type: 'wb', q: genWb(v, seed, o.target) };
    last = qn;
    if (!o.exclude.has(qSig(qn))) return qn;
  }
  return last as Question;
}
