import { Q, parseQ, q } from '../math/rational';
import { Bi, TopicCode } from '../data/topics';

export type Answer = Record<string, Q>;
export type Status = 'Candidate' | 'Verified' | 'Approved' | 'Active' | 'Retired' | 'Rejected';

export type CheckKind =
  | 'balance' | 'classify' | 'simplify' | 'ineq' | 'coord' | 'line' | 'dual' | 'factor' | 'roots' | 'parabola'
  | 'exponent' | 'radical' | 'log' | 'expand' | 'domain' | 'system3' | 'matbasic' | 'matop' | 'det' | 'inverse'
  | 'transform' | 'vector' | 'complex' | 'eigen';

export interface Knob {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  init: number;
  /** Bila ada, knob adalah pilihan (nilai 0..n-1). */
  choices?: string[];
}

export interface Candidate {
  id: string;
  topic: TopicCode;
  kind: CheckKind;
  mechanic: string;
  seed: number;
  target: number; // tingkat kesulitan yang diminta
  difficulty: number; // 1..5 (diperbarui oleh Difficulty Estimator)
  title: Bi;
  prompt: Bi;
  data: Record<string, unknown>;
  display: string[];
  knobs: Knob[];
  intended: Answer | null; // jawaban yang dimaksud generator (hanya untuk uji konsistensi)
  multiSolution: boolean; // desain eksplisit multi-solusi
  solution?: Answer;
  alternatives?: Answer[];
  trace: string[];
  steps: number;
  hints: string[];
  misconceptions: string[];
  prerequisites: TopicCode[];
  status: Status;
  signature: string;
  rejectReason?: string;
}

export interface SolveResult {
  solution: Answer;
  trace: string[];
  steps: number;
  unique: boolean;
  alternatives?: Answer[];
}
export interface VerifyResult {
  ok: boolean;
  msg?: string;
}

export const nq = (x: number): Q => {
  if (Number.isInteger(x)) return q(x);
  return parseQ(String(x)) ?? q(0);
};
export const A = (o: Record<string, number>): Answer => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, nq(v)]));

export const knob = (id: string, label: string, min: number, max: number, step = 1, init = 0, choices?: string[]): Knob => ({
  id, label, min, max, step, init, choices,
});

export function getData<T>(c: Candidate): T {
  return c.data as unknown as T;
}
