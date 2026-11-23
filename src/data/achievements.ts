import { Bi, bi } from './topics';
import { SaveData } from '../engine/save';

export interface Achievement {
  id: string;
  name: Bi;
  desc: Bi;
  test: (s: SaveData) => boolean;
}
const cleared = (s: SaveData): number => Object.values(s.floors).filter((f) => f.cleared).length;
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_variable', name: bi('First Variable', 'First Variable'), desc: bi('Selesaikan lantai pertama', 'Clear the first floor'), test: (s) => !!s.floors[1]?.cleared },
  { id: 'balanced_mind', name: bi('Balanced Mind', 'Balanced Mind'), desc: bi('Selesaikan 10 puzzle keseimbangan', 'Solve 10 balance puzzles'), test: (s) => (s.stats.byKind.balance ?? 0) >= 10 },
  { id: 'line_architect', name: bi('Line Architect', 'Line Architect'), desc: bi('Kuasai puzzle fungsi linear (8 puzzle jalur/gerbang)', 'Master linear puzzles (8 rail/gate puzzles)'), test: (s) => (s.stats.byKind.line ?? 0) + (s.stats.byKind.dual ?? 0) >= 8 },
  { id: 'root_seeker', name: bi('Root Seeker', 'Root Seeker'), desc: bi('Selesaikan 8 puzzle akar & faktor', 'Solve 8 root & factor puzzles'), test: (s) => (s.stats.byKind.roots ?? 0) + (s.stats.byKind.factor ?? 0) + (s.stats.byKind.radical ?? 0) >= 8 },
  { id: 'matrix_master', name: bi('Matrix Master', 'Matrix Master'), desc: bi('Selesaikan 10 puzzle matriks', 'Solve 10 matrix puzzles'), test: (s) => ['matbasic', 'matop', 'det', 'inverse', 'transform'].reduce((a, k) => a + (s.stats.byKind[k] ?? 0), 0) >= 10 },
  { id: 'no_hints', name: bi('No Hints Needed', 'No Hints Needed'), desc: bi('Selesaikan 10 puzzle tanpa hint', 'Solve 10 puzzles without hints'), test: (s) => s.stats.noHint >= 10 },
  { id: 'restorer', name: bi('The Restorer', 'The Restorer'), desc: bi('Pulihkan 30 lantai', 'Restore all 30 floors'), test: (s) => cleared(s) >= 30 },
  { id: 'archon_ascendant', name: bi('Archon Ascendant', 'Archon Ascendant'), desc: bi('Selesaikan kampanye', 'Complete the campaign'), test: (s) => s.guardians.includes(4) },
];
