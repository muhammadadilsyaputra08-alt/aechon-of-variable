/**
 * Kurikulum: Tier → Level (satu materi A01–A30) → Sublevel bertahap.
 * Prinsip: satu sublevel = satu fokus kompetensi. Sumber tunggal untuk Campaign, Guide, Mastery, dan Archive.
 */
import { Bi, bi, TopicCode, TOPICS, TOPIC_BY_CODE } from '../data/topics';
import { FLOORS } from '../data/floors';

export type Stage = 'guide' | 'basic' | 'inter' | 'adv' | 'mastery' | 'challenge';
export const STAGE_LABEL: Record<Stage, Bi> = {
  guide: bi('Panduan', 'Guide'),
  basic: bi('Dasar', 'Basic'),
  inter: bi('Menengah', 'Intermediate'),
  adv: bi('Lanjut', 'Advanced'),
  mastery: bi('Mastery', 'Mastery'),
  challenge: bi('Tantangan Level', 'Level Challenge'),
};
/** Token varian khusus: soal diambil dari puzzle visual Archivist (mekanik RPG asli). */
export const PZ = 'PZ';

export interface Sublevel {
  /** "A03.4" */
  id: string;
  topic: TopicCode;
  /** 1-based; 1 selalu Guide */
  index: number;
  stage: Stage;
  title: Bi;
  variants: string[];
  target: number;
  /** Jumlah soal yang harus diselesaikan */
  count: number;
}
export interface Level {
  topic: TopicCode;
  tier: 1 | 2 | 3 | 4;
  subs: Sublevel[];
  /** Akurasi percobaan-pertama minimum agar dinilai menguasai (Level Challenge). */
  passAccuracy: number;
}

type Spec = [Stage, string, string, string[], number, number];
const S = (stage: Stage, id: string, en: string, variants: string[], target: number, count: number): Spec => [stage, id, en, variants, target, count];
const G = S('guide', 'Panduan Level', 'Level Guide', [], 1, 0);

const SPECS: Partial<Record<TopicCode, Spec[]>> = {
  A01: [
    G,
    S('basic', 'x + b = c', 'x + b = c', ['os_add'], 1, 4),
    S('basic', 'x − b = c', 'x − b = c', ['os_sub'], 1, 4),
    S('inter', 'ax = c', 'ax = c', ['os_mul'], 2, 4),
    S('inter', 'Timbangan Misteri', 'Mystery Balance', [PZ], 2, 3),
    S('adv', 'x : a = c', 'x ÷ a = c', ['os_div', 'os_mul'], 3, 4),
    S('mastery', 'Semua Bentuk', 'All Forms', ['os_add', 'os_sub', 'os_mul', 'os_div'], 3, 5),
    S('challenge', 'Ujian Pengenalan', 'Intro Exam', ['os_add', 'os_sub', 'os_mul', 'os_div'], 4, 6),
  ],
  A02: [
    G,
    S('basic', 'Nilai ax + b', 'Value of ax + b', ['eval1'], 1, 4),
    S('inter', 'Nilai dengan negatif', 'Values with negatives', ['eval2'], 2, 4),
    S('inter', 'Pengelompokan Blok', 'Symbol Blocks', [PZ], 2, 3),
    S('adv', 'Nilai kuadrat', 'Quadratic values', ['eval3'], 3, 4),
    S('adv', 'Dua variabel', 'Two variables', ['eval4'], 4, 4),
    S('mastery', 'Campuran', 'Mixed', ['eval1', 'eval2', 'eval3', 'eval4'], 4, 5),
    S('challenge', 'Ujian Ekspresi', 'Expression Exam', ['eval2', 'eval3', 'eval4'], 4, 6),
  ],
  A03: [
    G,
    S('basic', 'Penjumlahan bentuk aljabar', 'Adding expressions', ['add'], 1, 4),
    S('basic', 'Pengurangan bentuk aljabar', 'Subtracting expressions', ['sub'], 2, 4),
    S('inter', 'Penjumlahan polinomial', 'Adding polynomials', ['poly_add'], 2, 4),
    S('inter', 'Pengurangan polinomial', 'Subtracting polynomials', ['poly_sub'], 3, 4),
    S('inter', 'Perkalian distributif', 'Distributive multiplication', ['distribute'], 2, 4),
    S('adv', 'Perkalian dua kurung', 'Two-bracket multiplication', ['binomial'], 3, 4),
    S('adv', 'Pembagian bentuk aljabar', 'Dividing expressions', ['divide'], 3, 4),
    S('adv', 'Operasi campuran', 'Mixed operations', ['mixed'], 4, 4),
    S('mastery', 'Mastery Operasi', 'Operations Mastery', ['add', 'sub', 'poly_sub', 'distribute', 'binomial', 'divide', 'mixed'], 4, 6),
    S('challenge', 'Tantangan Operasi Aljabar', 'Algebra Operations Challenge', ['poly_add', 'poly_sub', 'distribute', 'binomial', 'divide', 'mixed'], 5, 6),
  ],
  A04: [
    G,
    S('basic', 'Suku sejenis sederhana', 'Simple like terms', ['lt_1'], 1, 4),
    S('basic', 'Dengan konstanta', 'With constants', ['lt_2'], 1, 4),
    S('inter', 'Koefisien negatif', 'Negative coefficients', ['lt_3'], 2, 4),
    S('inter', 'Pengelompokan Kristal', 'Crystal grouping', [PZ], 2, 3),
    S('adv', 'Dua variabel', 'Two variables', ['lt_4'], 3, 4),
    S('adv', 'Pangkat berbeda', 'Different powers', ['lt_5'], 4, 4),
    S('mastery', 'Mastery Suku Sejenis', 'Like Terms Mastery', ['lt_3', 'lt_4', 'lt_5'], 4, 5),
    S('challenge', 'Ujian Suku Sejenis', 'Like Terms Exam', ['lt_3', 'lt_4', 'lt_5'], 5, 6),
  ],
  A05: [
    G,
    S('basic', 'ax + b = c', 'ax + b = c', ['lin_a'], 1, 4),
    S('inter', 'Variabel di dua ruas', 'Variables on both sides', ['lin_b'], 2, 4),
    S('inter', 'Timbangan Seimbang', 'Balance Scale', [PZ], 2, 3),
    S('inter', 'Dengan kurung', 'With brackets', ['lin_c'], 3, 4),
    S('adv', 'Kurung dan dua ruas', 'Brackets and both sides', ['lin_d'], 4, 4),
    S('mastery', 'Mastery Persamaan Linear', 'Linear Equations Mastery', ['lin_a', 'lin_b', 'lin_c', 'lin_d'], 4, 6),
    S('challenge', 'Ujian Persamaan Linear', 'Linear Equations Exam', ['lin_b', 'lin_c', 'lin_d'], 5, 6),
  ],
  A06: [
    G,
    S('basic', 'x + b < c', 'ax + b < c', ['ineq_1'], 1, 4),
    S('inter', 'ax + b ≤ c', 'ax + b ≤ c', ['ineq_1'], 2, 4),
    S('inter', 'Koefisien negatif: balik tanda', 'Negative coefficient: flip the sign', ['ineq_2'], 3, 4),
    S('inter', 'Wilayah Aman', 'Safe Ground', [PZ], 2, 3),
    S('adv', 'Variabel di dua ruas', 'Variables on both sides', ['ineq_3'], 4, 4),
    S('mastery', 'Mastery Pertidaksamaan', 'Inequalities Mastery', ['ineq_1', 'ineq_2', 'ineq_3'], 4, 6),
    S('challenge', 'Ujian Pertidaksamaan', 'Inequalities Exam', ['ineq_2', 'ineq_3'], 5, 6),
  ],
  A07: [
    G,
    S('basic', 'Kuadran titik', 'Quadrants', ['co_quad'], 1, 4),
    S('inter', 'Pencerminan', 'Reflection', ['co_reflect'], 2, 4),
    S('inter', 'Peta Koordinat', 'Coordinate Atlas', [PZ], 2, 3),
    S('inter', 'Translasi', 'Translation', ['co_trans'], 3, 4),
    S('adv', 'Cermin lalu geser', 'Reflect then translate', ['co_combo'], 4, 4),
    S('mastery', 'Mastery Koordinat', 'Coordinates Mastery', ['co_quad', 'co_reflect', 'co_trans', 'co_combo'], 4, 6),
    S('challenge', 'Ujian Koordinat', 'Coordinates Exam', ['co_reflect', 'co_trans', 'co_combo'], 5, 6),
  ],
  A08: [
    G,
    S('basic', 'Nilai f(x) positif', 'f(x) positive inputs', ['fn_val1'], 1, 4),
    S('inter', 'Nilai f(x) negatif', 'f(x) with negatives', ['fn_val2'], 2, 4),
    S('inter', 'Jalur Fungsi', 'Function Rail', [PZ], 3, 3),
    S('adv', 'Mencari x dari f(x)', 'Find x from f(x)', ['fn_find'], 4, 4),
    S('mastery', 'Mastery Fungsi Linear', 'Linear Functions Mastery', ['fn_val1', 'fn_val2', 'fn_find'], 4, 6),
    S('challenge', 'Ujian Fungsi Linear', 'Linear Functions Exam', ['fn_val2', 'fn_find'], 5, 6),
  ],
  A09: [
    G,
    S('basic', 'Gradien dari dua titik', 'Slope from two points', ['sl_pts'], 1, 4),
    S('inter', 'Intersep c', 'Intercept c', ['sl_int'], 2, 4),
    S('inter', 'Lereng Gradien', 'Slope Terrace', [PZ], 2, 3),
    S('adv', 'Gradien dari bentuk umum', 'Slope from standard form', ['sl_std'], 4, 4),
    S('mastery', 'Mastery Gradien', 'Slope Mastery', ['sl_pts', 'sl_int', 'sl_std'], 4, 6),
    S('challenge', 'Ujian Gradien', 'Slope Exam', ['sl_pts', 'sl_int', 'sl_std'], 5, 6),
  ],
  A10: [
    G,
    S('basic', 'Jumlah & selisih', 'Sum & difference', ['sys_1'], 1, 4),
    S('inter', 'Eliminasi sederhana', 'Simple elimination', ['sys_2'], 2, 4),
    S('inter', 'Persimpangan', 'The Crossing', [PZ], 2, 3),
    S('adv', 'Eliminasi umum', 'General elimination', ['sys_3'], 4, 4),
    S('mastery', 'Mastery SPLDV', 'Systems Mastery', ['sys_1', 'sys_2', 'sys_3'], 4, 6),
    S('challenge', 'Ujian SPLDV', 'Systems Exam', ['sys_2', 'sys_3'], 5, 6),
  ],
  A17: [
    G,
    S('basic', 'Selisih kuadrat', 'Difference of squares', ['quad_4'], 1, 4),
    S('basic', 'x² + bx + c = 0', 'x² + bx + c = 0', ['quad_1'], 2, 4),
    S('inter', 'Konstanta di ruas kanan', 'Constant on the right', ['quad_2'], 3, 4),
    S('inter', 'Lengkung Parabola', 'Parabola Arc', [PZ], 3, 3),
    S('adv', 'Koefisien utama ≠ 1', 'Leading coefficient ≠ 1', ['quad_3'], 4, 4),
    S('mastery', 'Mastery Persamaan Kuadrat', 'Quadratics Mastery', ['quad_1', 'quad_2', 'quad_3', 'quad_4'], 4, 6),
    S('challenge', 'Ujian Persamaan Kuadrat', 'Quadratics Exam', ['quad_2', 'quad_3'], 5, 6),
  ],
  A11: [
    G,
    S('basic', 'Perkalian pangkat', 'Multiplying powers', ['exp_mul'], 1, 4),
    S('inter', 'Dengan koefisien', 'With coefficients', ['exp_mulc'], 2, 4),
    S('inter', 'Pangkat dari pangkat', 'Power of a power', ['exp_pow'], 3, 4),
    S('adv', 'Koefisien berpangkat', 'Powered coefficients', ['exp_powc'], 4, 4),
    S('mastery', 'Mastery Eksponen', 'Exponents Mastery', ['exp_mul', 'exp_mulc', 'exp_pow', 'exp_powc'], 4, 6),
    S('challenge', 'Ujian Eksponen', 'Exponents Exam', ['exp_mulc', 'exp_pow', 'exp_powc'], 5, 6),
  ],
  A14: [
    G,
    S('basic', 'Penjumlahan polinomial', 'Adding polynomials', ['cubic_add'], 1, 4),
    S('inter', 'Pengurangan polinomial', 'Subtracting polynomials', ['cubic_sub'], 2, 4),
    S('inter', 'Perkalian dua kurung', 'Two-bracket product', ['binomial'], 3, 4),
    S('adv', 'Binomial × trinomial', 'Binomial × trinomial', ['poly_mul'], 4, 4),
    S('mastery', 'Mastery Polinomial', 'Polynomials Mastery', ['cubic_add', 'cubic_sub', 'binomial', 'poly_mul'], 4, 6),
    S('challenge', 'Ujian Polinomial', 'Polynomials Exam', ['cubic_sub', 'binomial', 'poly_mul'], 5, 6),
  ],
  A15: [
    G,
    S('basic', '(x + a)²', '(x + a)²', ['sq_sum'], 1, 4),
    S('basic', '(x − a)²', '(x − a)²', ['sq_diff'], 2, 4),
    S('inter', 'Selisih kuadrat', 'Difference of squares', ['diff_sq'], 3, 4),
    S('adv', '(ax + b)²', '(ax + b)²', ['sq_lin'], 4, 4),
    S('mastery', 'Mastery Identitas', 'Identities Mastery', ['sq_sum', 'sq_diff', 'diff_sq', 'sq_lin'], 4, 6),
    S('challenge', 'Ujian Identitas', 'Identities Exam', ['sq_diff', 'diff_sq', 'sq_lin'], 5, 6),
  ],
  A16: [
    G,
    S('basic', 'x² + bx + c (positif)', 'x² + bx + c (positive)', ['fac_1'], 1, 4),
    S('inter', 'Tanda berbeda', 'Mixed signs', ['fac_2'], 2, 4),
    S('inter', 'Mesin Faktor', 'Factor Machine', [PZ], 3, 3),
    S('adv', 'Selisih kuadrat', 'Difference of squares', ['fac_3'], 3, 4),
    S('adv', 'Koefisien utama ≠ 1', 'Leading coefficient ≠ 1', ['fac_4'], 4, 4),
    S('mastery', 'Mastery Faktorisasi', 'Factoring Mastery', ['fac_1', 'fac_2', 'fac_3', 'fac_4'], 4, 6),
    S('challenge', 'Ujian Faktorisasi', 'Factoring Exam', ['fac_2', 'fac_3', 'fac_4'], 5, 6),
  ],
  A12: [
    G,
    S('basic', 'Sederhanakan √n', 'Simplify √n', ['rad_1'], 1, 4),
    S('basic', 'Akar sejenis', 'Like radicals', ['rad_3'], 2, 4),
    S('inter', 'Reaktor Akar', 'Radical Reactor', [PZ], 2, 3),
    S('inter', 'Perkalian akar', 'Multiplying radicals', ['rad_2'], 3, 4),
    S('adv', 'Sederhanakan lalu gabung', 'Simplify then combine', ['rad_4'], 4, 4),
    S('adv', 'Koefisien × akar', 'Coefficient × radical', ['rad_5'], 4, 4),
    S('mastery', 'Mastery Bentuk Akar', 'Radicals Mastery', ['rad_1', 'rad_2', 'rad_3', 'rad_4', 'rad_5'], 4, 6),
    S('challenge', 'Ujian Bentuk Akar', 'Radicals Exam', ['rad_2', 'rad_4', 'rad_5'], 5, 6),
  ],
  A13: [
    G,
    S('basic', 'Nilai log dasar', 'Basic log values', ['lg_1'], 1, 4),
    S('basic', 'Nilai log khusus', 'Special log values', ['lg_2'], 2, 4),
    S('inter', 'Pencarian Pangkat', 'Power Hunt', [PZ], 2, 3),
    S('inter', 'log_b(x) = k', 'log_b(x) = k', ['lg_3'], 3, 4),
    S('adv', 'Sifat logaritma', 'Log laws', ['lg_4'], 4, 4),
    S('adv', 'Mencari basis', 'Finding the base', ['lg_5'], 4, 4),
    S('mastery', 'Mastery Logaritma', 'Logarithms Mastery', ['lg_1', 'lg_2', 'lg_3', 'lg_4', 'lg_5'], 4, 6),
    S('challenge', 'Ujian Logaritma', 'Logarithms Exam', ['lg_3', 'lg_4', 'lg_5'], 5, 6),
  ],
  A18: [
    G,
    S('basic', 'Bentuk puncak', 'Vertex form', ['qf_5'], 1, 4),
    S('inter', 'Sumbu simetri', 'Axis of symmetry', ['qf_1'], 2, 4),
    S('inter', 'Kurva Parabola', 'Parabola Curve', [PZ], 3, 3),
    S('inter', 'Titik puncak', 'The vertex', ['qf_2'], 3, 4),
    S('adv', 'Nilai maksimum/minimum', 'Maximum/minimum value', ['qf_3'], 4, 4),
    S('adv', 'Titik potong sumbu-x', 'x-intercepts', ['qf_4'], 4, 4),
    S('mastery', 'Mastery Fungsi Kuadrat', 'Quadratic Functions Mastery', ['qf_5', 'qf_1', 'qf_2', 'qf_3', 'qf_4'], 4, 6),
    S('challenge', 'Ujian Fungsi Kuadrat', 'Quadratic Functions Exam', ['qf_2', 'qf_3', 'qf_4'], 5, 6),
  ],
  A19: [
    G,
    S('basic', 'Nilai f(x) rasional', 'Evaluating f(x)', ['rf_1'], 1, 4),
    S('basic', 'Nilai terlarang', 'Excluded value', ['rf_2'], 2, 4),
    S('inter', 'Asimtot tegak', 'Vertical asymptote', ['rf_3'], 3, 4),
    S('inter', 'Grafik Asimtot', 'Asymptote Graph', [PZ], 3, 3),
    S('adv', 'Asimtot datar', 'Horizontal asymptote', ['rf_4'], 4, 4),
    S('adv', 'Titik potong sumbu-x', 'x-intercept', ['rf_5'], 4, 4),
    S('adv', 'Penyebut kuadrat', 'Quadratic denominator', ['rf_6'], 4, 4),
    S('mastery', 'Mastery Fungsi Rasional', 'Rational Functions Mastery', ['rf_1', 'rf_2', 'rf_3', 'rf_4', 'rf_5', 'rf_6'], 4, 6),
    S('challenge', 'Ujian Fungsi Rasional', 'Rational Functions Exam', ['rf_3', 'rf_4', 'rf_5', 'rf_6'], 5, 6),
  ],
  A20: [
    G,
    S('basic', 'Domain √(x + a)', 'Domain of √(x + a)', ['rd_1'], 1, 4),
    S('inter', 'Domain √(ax + b)', 'Domain of √(ax + b)', ['rd_2'], 2, 4),
    S('inter', 'Grafik Akar', 'Root Graph', [PZ], 3, 3),
    S('inter', 'Nilai f(x) akar', 'Evaluating √f(x)', ['rd_3'], 3, 4),
    S('adv', 'Persamaan akar', 'Radical equations', ['rd_4'], 4, 4),
    S('adv', 'Nilai minimum', 'Minimum value', ['rd_5'], 4, 4),
    S('mastery', 'Mastery Fungsi Radikal', 'Radical Functions Mastery', ['rd_1', 'rd_2', 'rd_3', 'rd_4', 'rd_5'], 4, 6),
    S('challenge', 'Ujian Fungsi Radikal', 'Radical Functions Exam', ['rd_2', 'rd_4', 'rd_5'], 5, 6),
  ],
  A22: [
    G,
    S('basic', 'Elemen matriks a_ij', 'Matrix elements a_ij', ['mx_1'], 1, 4),
    S('basic', 'Diagonal utama', 'Main diagonal', ['mx_2'], 2, 4),
    S('inter', 'Grid Transformasi', 'Transformation Grid', [PZ], 2, 3),
    S('inter', 'Jumlah & selisih matriks', 'Adding & subtracting matrices', ['mx_3'], 3, 4),
    S('inter', 'Perkalian skalar', 'Scalar multiplication', ['mx_4'], 3, 4),
    S('adv', 'Operasi dasar campuran', 'Mixed basic operations', ['mx_3', 'mx_4'], 4, 4),
    S('mastery', 'Mastery Matriks', 'Matrices Mastery', ['mx_1', 'mx_2', 'mx_3', 'mx_4'], 4, 6),
    S('challenge', 'Ujian Matriks', 'Matrices Exam', ['mx_3', 'mx_4'], 5, 6),
  ],
  A23: [
    G,
    S('basic', 'Transpose', 'Transpose', ['mo_1'], 1, 4),
    S('inter', 'Skalar ± matriks', 'Scalar ± matrix', ['mo_2'], 2, 4),
    S('inter', 'Grid Perkalian', 'Multiplication Grid', [PZ], 2, 3),
    S('inter', 'Satu elemen AB', 'One entry of AB', ['mo_3'], 3, 4),
    S('adv', 'Perkalian 2×2', '2×2 product', ['mo_4'], 4, 4),
    S('adv', 'Matriks × vektor kolom', 'Matrix × column vector', ['mo_5'], 4, 4),
    S('mastery', 'Mastery Operasi Matriks', 'Matrix Operations Mastery', ['mo_1', 'mo_2', 'mo_3', 'mo_4', 'mo_5'], 4, 6),
    S('challenge', 'Ujian Operasi Matriks', 'Matrix Operations Exam', ['mo_2', 'mo_4', 'mo_5'], 5, 6),
  ],
  A24: [
    G,
    S('basic', 'Determinan 2×2', '2×2 determinant', ['dt_1'], 1, 4),
    S('inter', 'Dengan bilangan negatif', 'With negatives', ['dt_2'], 2, 4),
    S('inter', 'Stabilitas Dimensi', 'Dimensional Stability', [PZ], 3, 3),
    S('inter', 'det = 0', 'det = 0', ['dt_3'], 3, 4),
    S('adv', 'Determinan 3×3', '3×3 determinant', ['dt_4'], 4, 4),
    S('mastery', 'Mastery Determinan', 'Determinants Mastery', ['dt_1', 'dt_2', 'dt_3', 'dt_4'], 4, 6),
    S('challenge', 'Ujian Determinan', 'Determinants Exam', ['dt_2', 'dt_3', 'dt_4'], 5, 6),
  ],
  A25: [
    G,
    S('basic', 'Invers (det = 1)', 'Inverse (det = 1)', ['iv_1'], 1, 4),
    S('inter', 'Invers berpecahan', 'Fractional inverse', ['iv_2'], 2, 4),
    S('inter', 'Grid Invers', 'Inverse Grid', [PZ], 3, 3),
    S('inter', 'Syarat punya invers', 'Invertibility condition', ['iv_3'], 3, 4),
    S('adv', 'Selesaikan dengan invers', 'Solve using the inverse', ['iv_4'], 4, 4),
    S('mastery', 'Mastery Invers', 'Inverse Mastery', ['iv_1', 'iv_2', 'iv_3', 'iv_4'], 4, 6),
    S('challenge', 'Ujian Invers', 'Inverse Exam', ['iv_2', 'iv_3', 'iv_4'], 5, 6),
  ],
};

/** Tangga generik untuk materi yang memakai puzzle visual Archivist (mekanik RPG asli). */
function ladder(topic: TopicCode): Spec[] {
  const tier = TOPIC_BY_CODE[topic].tier;
  const g: Spec[] = [
    G,
    S('basic', 'Dasar I', 'Basics I', [PZ], 1, 3),
    S('basic', 'Dasar II', 'Basics II', [PZ], 2, 3),
    S('inter', 'Menengah I', 'Intermediate I', [PZ], 2, 4),
    S('inter', 'Menengah II', 'Intermediate II', [PZ], 3, 4),
    S('adv', 'Lanjut I', 'Advanced I', [PZ], 4, 4),
  ];
  if (tier >= 3) g.push(S('adv', 'Lanjut II', 'Advanced II', [PZ], 4, 4));
  g.push(S('mastery', 'Mastery', 'Mastery', [PZ], 4, 5), S('challenge', 'Ujian Level', 'Level Exam', [PZ], 5, 6));
  return g;
}

export const LEVELS: Record<string, Level> = {};
for (const m of TOPICS) {
  const spec = SPECS[m.code] ?? ladder(m.code);
  LEVELS[m.code] = {
    topic: m.code,
    tier: m.tier,
    passAccuracy: 0.8,
    subs: spec.map(([stage, id, en, variants, target, count], i) => ({
      id: `${m.code}.${i + 1}`, topic: m.code, index: i + 1, stage, title: bi(id, en), variants, target, count,
    })),
  };
}
export const level = (t: TopicCode): Level => LEVELS[t];
export const subOf = (t: TopicCode, idx: number): Sublevel => LEVELS[t].subs[idx - 1];
export const totalSublevels = (): number => Object.values(LEVELS).reduce((s, l) => s + l.subs.length, 0);

/** Sasaran per lantai: berapa sublevel tiap materi yang harus selesai. Lantai 30 hanya ujian akhir (boss). */
export function floorGoals(n: number): Array<{ topic: TopicCode; count: number }> {
  const f = FLOORS[n - 1];
  if (n === 30) return [];
  return f.topics.map((topic) => {
    const occ = FLOORS.filter((x) => x.n !== 30 && x.topics.includes(topic)).map((x) => x.n);
    const j = occ.indexOf(n);
    const L = LEVELS[topic].subs.length;
    return { topic, count: Math.min(L, Math.ceil((L * (j + 1)) / occ.length)) };
  });
}
