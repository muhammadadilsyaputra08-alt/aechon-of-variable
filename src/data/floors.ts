/** Level berbasis data (bukan hardcode): 30 lantai, 4 tier, slot puzzle dikurasi oleh Archivist via seed tetap. */
import { Bi, bi, TopicCode } from './topics';

export type SlotRole = 'tutorial' | 'core' | 'advanced';
export interface Slot {
  role: SlotRole;
  topic: TopicCode;
  target: number;
  seed: number;
}
export interface GuardianDef {
  id: 'keeper' | 'twins' | 'devourer' | 'null';
  name: Bi;
  sprite: string; // nama sheet guardian
  frameW: number;
  frameH: number;
  phases: Array<{ topic: TopicCode; target: number; label: Bi }>;
}
export interface FloorDef {
  n: number;
  tier: 1 | 2 | 3 | 4;
  name: Bi;
  challenge: Bi;
  topics: TopicCode[];
  slots: Slot[];
  guardian?: GuardianDef['id'];
  rewards: { shard: number; kp: number };
}

export const TIERS: Array<{ tier: 1 | 2 | 3 | 4; name: Bi; from: number; to: number; bg: string; level: Bi }> = [
  { tier: 1, name: bi('The Foundation', 'The Foundation'), from: 1, to: 5, bg: 'bg_t1_foundation', level: bi('Dasar', 'Basic') },
  { tier: 2, name: bi('The Energy Network', 'The Energy Network'), from: 6, to: 12, bg: 'bg_t2_energy_network', level: bi('Menengah', 'Intermediate') },
  { tier: 3, name: bi('The Resonance Chambers', 'The Resonance Chambers'), from: 13, to: 20, bg: 'bg_t3_resonance_chambers', level: bi('Menengah-lanjut', 'Upper-intermediate') },
  { tier: 4, name: bi('The Dimensional Sanctum', 'The Dimensional Sanctum'), from: 21, to: 30, bg: 'bg_t4_dimensional_sanctum', level: bi('Advance', 'Advanced') },
];

export const GUARDIANS: Record<GuardianDef['id'], GuardianDef> = {
  keeper: {
    id: 'keeper', name: bi('The Keeper of Balance', 'The Keeper of Balance'), sprite: 'guardian_keeper_of_balance', frameW: 96, frameH: 112,
    phases: [
      { topic: 'A05', target: 3, label: bi('Beban pertama', 'First load') },
      { topic: 'A05', target: 4, label: bi('Beban bergeser', 'Shifting load') },
      { topic: 'A05', target: 5, label: bi('Keseimbangan akhir', 'Final balance') },
    ],
  },
  twins: {
    id: 'twins', name: bi('The Twin Sentinels', 'The Twin Sentinels'), sprite: 'guardian_twin_sentinels', frameW: 160, frameH: 112,
    phases: [
      { topic: 'A09', target: 3, label: bi('Gradien', 'Gradient') },
      { topic: 'A08', target: 4, label: bi('Fungsi linear', 'Linear function') },
      { topic: 'A10', target: 3, label: bi('SPLDV', 'Linear system') },
      { topic: 'A10', target: 5, label: bi('Integrasi: dua inti', 'Integration: twin cores') },
    ],
  },
  devourer: {
    id: 'devourer', name: bi('The Polynomial Devourer', 'The Polynomial Devourer'), sprite: 'guardian_polynomial_devourer', frameW: 128, frameH: 112,
    phases: [
      { topic: 'A14', target: 4, label: bi('Lapisan polinomial', 'Polynomial layer') },
      { topic: 'A16', target: 4, label: bi('Faktorisasi', 'Factoring') },
      { topic: 'A17', target: 3, label: bi('Temukan akar', 'Find the roots') },
      { topic: 'A18', target: 4, label: bi('Kurva dan titik akar', 'Curve and roots') },
    ],
  },
  null: {
    id: 'null', name: bi('The Null Architect', 'The Null Architect'), sprite: 'guardian_null_architect', frameW: 128, frameH: 128,
    phases: [
      { topic: 'A05', target: 5, label: bi('Fase 1: persamaan linear', 'Phase 1: linear equation') },
      { topic: 'A10', target: 4, label: bi('Fase 2: SPLDV', 'Phase 2: linear system') },
      { topic: 'A16', target: 4, label: bi('Fase 3: faktorisasi kuadrat', 'Phase 3: quadratic factoring') },
      { topic: 'A26', target: 4, label: bi('Fase 4: transformasi matriks', 'Phase 4: matrix transform') },
      { topic: 'A30', target: 5, label: bi('Fase 5: integrasi konsep', 'Phase 5: concept integration') },
    ],
  },
};

type Row = [number, string, string, string, string, TopicCode[], [number, number, number], GuardianDef['id'] | null];
// [lantai, nama ID, nama EN, tantangan ID, tantangan EN, topik, kesulitan slot, guardian]
const R: Row[] = [
  [1, 'Peti Misteri', 'The Mystery Chest', 'Membuka peti misteri', 'Open the mystery chest', ['A01'], [1, 2, 3], null],
  [2, 'Ruang Ekspresi', 'Expression Hall', 'Mengelompokkan kristal', 'Group the crystals', ['A02'], [1, 2, 3], null],
  [3, 'Tungku Penggabung', 'The Merging Forge', 'Menggabungkan kristal', 'Merge the crystals', ['A04'], [1, 2, 3], null],
  [4, 'Aula Operasi', 'Hall of Operations', 'Menyeimbangkan timbangan', 'Balance the scale', ['A03'], [1, 2, 3], null],
  [5, 'Foundation Core', 'Foundation Core', 'Memulihkan Foundation Core', 'Restore the Foundation Core', ['A05'], [2, 3, 4], 'keeper'],
  [6, 'Wilayah Aman', 'The Safe Ground', 'Membuka wilayah aman', 'Open the safe region', ['A06'], [1, 2, 3], null],
  [7, 'Garis Batas', 'The Boundary Line', 'Menentukan batas solusi', 'Define the solution boundary', ['A06'], [2, 3, 4], null],
  [8, 'Peta Koordinat', 'Coordinate Atlas', 'Menempatkan energi', 'Place the energy', ['A07'], [1, 2, 3], null],
  [9, 'Lereng Gradien', 'Slope Terrace', 'Mengatur kemiringan', 'Adjust the slope', ['A09'], [1, 2, 3], null],
  [10, 'Jalur Fungsi', 'Function Rail', 'Mengatur jalur energi', 'Route the energy', ['A08'], [2, 3, 4], null],
  [11, 'Persimpangan', 'The Crossing', 'Menemukan titik perpotongan', 'Find the intersection', ['A10'], [1, 2, 3], null],
  [12, 'Dual Gate', 'The Dual Gate', 'Mengaktifkan Dual Gate', 'Activate the Dual Gate', ['A10', 'A09', 'A08'], [3, 4, 5], 'twins'],
  [13, 'Reaktor Pangkat', 'Exponent Reactor', 'Mengaktifkan reactor', 'Activate the reactor', ['A11'], [1, 2, 3], null],
  [14, 'Ruang Akar', 'The Radical Vault', 'Menstabilkan energi', 'Stabilize the energy', ['A12'], [1, 2, 3], null],
  [15, 'Arsip Logaritma', 'Logarithmic Archive', 'Membuka arsip', 'Unlock the archive', ['A13'], [1, 2, 3], null],
  [16, 'Blok Polinomial', 'Polynomial Blocks', 'Menggabungkan blok', 'Combine the blocks', ['A14'], [1, 2, 3], null],
  [17, 'Kamar Identitas', 'Chamber of Identities', 'Mengaktifkan kombinasi', 'Activate the combination', ['A15'], [1, 2, 3], null],
  [18, 'Mesin Faktor', 'The Factor Machine', 'Memecahkan Factor Machine', 'Crack the Factor Machine', ['A16'], [1, 2, 3], null],
  [19, 'Lengkung Parabola', 'Parabola Arc', 'Mengatur parabola', 'Shape the parabola', ['A17', 'A18'], [2, 3, 4], null],
  [20, 'Resonance Core', 'Resonance Core', 'Memulihkan Resonance Core', 'Restore the Resonance Core', ['A19', 'A20'], [2, 3, 4], 'devourer'],
  [21, 'Timbangan Banyak', 'The Many Scales', 'Menyeimbangkan banyak variabel', 'Balance many variables', ['A21'], [1, 2, 3], null],
  [22, 'Grid Matriks', 'The Matrix Grid', 'Menyusun grid', 'Arrange the grid', ['A22'], [1, 2, 3], null],
  [23, 'Penyatu Struktur', 'Structure Weaver', 'Menggabungkan struktur', 'Weave the structures', ['A23'], [1, 2, 3], null],
  [24, 'Penjaga Dimensi', 'Dimension Keeper', 'Menjaga dimensi', 'Keep the dimensions', ['A24'], [1, 2, 3], null],
  [25, 'Cermin Terbalik', 'The Inverse Mirror', 'Membalik transformasi', 'Reverse the transformation', ['A25'], [1, 2, 3], null],
  [26, 'Ruang Transformasi', 'Transformation Hall', 'Memindahkan artefak', 'Move the artifacts', ['A26'], [1, 2, 3], null],
  [27, 'Aula Arah', 'Hall of Directions', 'Menyusun arah', 'Align the directions', ['A27', 'A28'], [1, 2, 3], null],
  [28, 'Bidang Kompleks', 'The Complex Plane', 'Menstabilkan resonansi', 'Stabilize the resonance', ['A29'], [1, 3, 4], null],
  [29, 'Arah Stabil', 'The Steady Direction', 'Menemukan arah stabil', 'Find the stable direction', ['A30'], [1, 3, 5], null],
  [30, 'Archon Core', 'The Archon Core', 'Mengaktifkan Archon Core', 'Activate the Archon Core', ['A05', 'A10', 'A16', 'A26', 'A30'], [4, 5, 5], 'null'],
];

const tierOf = (n: number): 1 | 2 | 3 | 4 => (n <= 5 ? 1 : n <= 12 ? 2 : n <= 20 ? 3 : 4);
const ROLES: SlotRole[] = ['tutorial', 'core', 'advanced'];

export const FLOORS: FloorDef[] = R.map(([n, nid, nen, cid, cen, topics, ds, guardian]) => ({
  n,
  tier: tierOf(n),
  name: bi(nid, nen),
  challenge: bi(cid, cen),
  topics,
  guardian: guardian ?? undefined,
  rewards: { shard: 20 + n * 2 + (guardian ? 40 : 0), kp: 5 + Math.floor(n / 3) },
  slots: ROLES.map((role, i) => ({ role, topic: topics[i % topics.length], target: ds[i], seed: n * 1009 + i * 37 + 11 })),
}));

export const floorByN = (n: number): FloorDef => FLOORS[n - 1];
export const tierInfo = (tier: number): (typeof TIERS)[number] => TIERS[tier - 1];
export const bgKey = (tier: number, restored: boolean): string => `${TIERS[tier - 1].bg}_${restored ? 'restored' : 'ruined'}`;
