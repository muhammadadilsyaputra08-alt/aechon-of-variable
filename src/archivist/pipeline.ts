/**
 * Archivist Engine pipeline: Solver First → Validasi → Ambiguity → Difficulty → Tagging → Hint → Admission.
 * Soal tanpa solusi tervalidasi TIDAK PERNAH sampai ke pemain.
 */
import { TOPIC_BY_CODE, TopicCode } from '../data/topics';
import { generateCandidate } from './generators';
import { solveCandidate, verifyAnswer } from './kinds';
import { Candidate, CheckKind } from './types';
import { cmp, toNumber } from '../math/rational';

const DIRECTION: Partial<Record<CheckKind, string>> = {
  balance: 'Hilangkan suku yang bisa dikurangi dari kedua sisi, lalu bagi.',
  classify: 'Pisahkan suku-sukunya, lalu lihat angka yang menempel pada x.',
  simplify: 'Jabarkan kurung dahulu, baru gabungkan suku sejenis.',
  ineq: 'Selesaikan seperti persamaan; perhatikan tanda koefisien x.',
  coord: 'Baca koordinat x lebih dulu (mendatar), lalu y (tegak).',
  line: 'Hitung kemiringan dari selisih y dan selisih x.',
  dual: 'Cari titik yang cocok untuk kedua persamaan sekaligus.',
  factor: 'Cari dua bilangan: jumlahnya = koefisien x, hasil kalinya = konstanta.',
  roots: 'Faktorkan persamaan, lalu setiap faktor = 0.',
  parabola: 'Substitusikan titik-titik ke y = ax² + bx + c.',
  exponent: 'Samakan basisnya, lalu pakai sifat pangkat.',
  radical: 'Cari faktor kuadrat sempurna di dalam akar.',
  log: 'Ubah ke bentuk pangkat: log_b N = k ⇔ b^k = N.',
  expand: 'Kalikan setiap suku dengan setiap suku lainnya.',
  domain: 'Cari nilai x yang membuat penyebut nol atau isi akar negatif.',
  system3: 'Eliminasi satu variabel dari dua pasang persamaan.',
  matbasic: 'Baris dulu, kolom kemudian.',
  matop: 'Hitung satu elemen hasil pada satu waktu.',
  det: 'Ingat rumus determinan 2×2: ad − bc.',
  inverse: 'Tukar a dan d, ubah tanda b dan c, bagi dengan determinan.',
  transform: 'Lihat ke mana (1,0) dan (0,1) berpindah.',
  vector: 'Kerjakan komponen x dan komponen y secara terpisah.',
  complex: 'Perlakukan i seperti variabel, lalu ganti i² dengan −1.',
  eigen: 'Cari arah yang tidak berubah setelah transformasi.',
};
const VISUAL: Partial<Record<CheckKind, string>> = {
  balance: 'Perhatikan kristal yang sama di kedua pan — itu yang bisa dihilangkan.',
  simplify: 'Perhatikan kristal berbentuk sama; itu suku sejenis.',
  coord: 'Lihat garis bantu sumbu: hitung langkah mendatar lalu tegak.',
  line: 'Perhatikan titik tujuan yang berpendar; jalur harus melewatinya.',
  dual: 'Cari tempat kedua garis saling bersilangan.',
  parabola: 'Perhatikan cincin energi; parabola harus melewati pusatnya.',
  domain: 'Perhatikan penghalang merah: itu nilai terlarang.',
  det: 'Perhatikan platform: determinan nol membuatnya goyah.',
  transform: 'Perhatikan bayangan transparan: itu posisi target.',
};

export function estimateDifficulty(c: Candidate): number {
  const tier = TOPIC_BY_CODE[c.topic].tier;
  const nums = JSON.stringify(c.data).match(/-?\d+(\.\d+)?/g) ?? [];
  const mag = nums.reduce((m, s) => Math.max(m, Math.abs(Number(s))), 0);
  const neg = nums.some((s) => s.startsWith('-')) ? 1 : 0;
  // Kompleksitas intrinsik (langkah, bilangan negatif, besar angka, tier) dipadukan dengan target kurikulum.
  const raw = 1 + 0.5 * (c.steps - 1) + 0.6 * neg + 0.04 * Math.min(mag, 40) + 0.35 * (tier - 1);
  return Math.max(1, Math.min(5, Math.round(0.5 * c.target + 0.5 * raw)));
}

export function buildHints(c: Candidate): string[] {
  const trace = c.trace;
  return [
    TOPIC_BY_CODE[c.topic].concept,
    DIRECTION[c.kind] ?? 'Mulailah dari informasi yang sudah diketahui.',
    VISUAL[c.kind] ?? 'Perhatikan objek yang berpendar di area puzzle.',
    trace[0] ?? 'Kerjakan satu langkah dahulu.',
    trace.join('  →  '),
  ];
}

/** Menjalankan seluruh pipeline pada satu kandidat. Mengubah status sesuai hasil. */
export function validateCandidate(c: Candidate): Candidate {
  const reject = (reason: string): Candidate => ({ ...c, status: 'Rejected', rejectReason: reason });

  // 0. Soal timbangan tidak boleh sudah berbentuk sederhana (mis. 'x = 2'): tidak ada yang perlu diseimbangkan.
  if (c.kind === 'balance' && /^\s*x\s*=\s*-?\d+\s*$/.test(String((c.data as { eq?: string }).eq ?? ''))) return reject('Soal sudah berbentuk sederhana');

  // 1. Internal solving (dari struktur yang ditampilkan)
  const s = solveCandidate(c);
  if (!s) return reject('Solver tidak menemukan solusi tervalidasi');

  // 2. Validasi matematis: solusi kanonik harus lolos verifier, dan niat generator harus sah
  if (!verifyAnswer(c, s.solution).ok) return reject('Solusi solver gagal verifikasi');
  if (c.intended && !verifyAnswer(c, c.intended).ok) return reject('Niat generator bertentangan dengan solver');
  for (const alt of s.alternatives ?? []) if (!verifyAnswer(c, alt).ok) return reject('Solusi alternatif tidak sah');

  // 3. Ambiguity check
  if (!s.unique && !c.multiSolution) return reject('Jawaban ganda tidak disengaja');
  if (s.unique && c.multiSolution) return reject('Ditandai multi-solusi padahal solusi tunggal');

  // 4. Kejangkauan: solusi harus bisa dimasukkan lewat kontrol puzzle
  for (const k of c.knobs) {
    const v = s.solution[k.id];
    if (!v) continue;
    const n = toNumber(v);
    if (n < k.min || n > k.max) return reject(`Solusi ${k.id} di luar jangkauan kontrol`);
    if (!k.choices && Math.abs((n - k.init) / k.step - Math.round((n - k.init) / k.step)) > 1e-9) return reject(`Solusi ${k.id} tidak terjangkau stepper`);
  }
  if (Object.keys(s.solution).some((k) => !c.knobs.some((kn) => kn.id === k))) return reject('Solusi memuat variabel tanpa kontrol');

  // 5. Difficulty estimation + pedagogical tagging + hints dari jejak solver
  const done: Candidate = { ...c, solution: s.solution, alternatives: s.alternatives, trace: s.trace, steps: s.steps, status: 'Verified' };
  done.difficulty = estimateDifficulty(done);
  done.hints = buildHints(done);
  done.prerequisites = TOPIC_BY_CODE[c.topic].prereq;
  if (Math.abs(done.difficulty - c.target) <= 2 && done.hints.length === 5) done.status = 'Approved';
  return done;
}

/** Kandidat → validasi → status Active bila Approved (siap dipakai). */
export function foundryOne(topic: TopicCode, seed: number, target: number): Candidate {
  const v = validateCandidate(generateCandidate(topic, seed, target));
  return v.status === 'Approved' ? { ...v, status: 'Active' } : v;
}

export { cmp };
