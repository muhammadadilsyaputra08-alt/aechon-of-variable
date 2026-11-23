/** Metadata 30 materi Algebra Codex (A01–A30). Sumber tunggal untuk Codex, Archivist, dan level. */
export type Bi = { id: string; en: string };
export const bi = (id: string, en: string): Bi => ({ id, en });

export type TopicCode =
  | 'A01' | 'A02' | 'A03' | 'A04' | 'A05' | 'A06' | 'A07' | 'A08' | 'A09' | 'A10'
  | 'A11' | 'A12' | 'A13' | 'A14' | 'A15' | 'A16' | 'A17' | 'A18' | 'A19' | 'A20'
  | 'A21' | 'A22' | 'A23' | 'A24' | 'A25' | 'A26' | 'A27' | 'A28' | 'A29' | 'A30';

export interface TopicMeta {
  code: TopicCode;
  tier: 1 | 2 | 3 | 4;
  title: Bi;
  sub: string;
  vis: string;
  prereq: TopicCode[];
  concept: string; // Hint level 1
}

const T = (code: TopicCode, tier: 1 | 2 | 3 | 4, id: string, en: string, sub: string, vis: string, prereq: TopicCode[], concept: string): TopicMeta => ({
  code, tier, title: bi(id, en), sub, vis, prereq, concept,
});

export const TOPICS: TopicMeta[] = [
  T('A01', 1, 'Pengenalan Aljabar', 'Introduction to Algebra', 'Variabel, konstanta, koefisien, simbol', 'Kotak misteri', [], 'Variabel adalah simbol untuk bilangan yang belum diketahui. Kedua ruas persamaan harus tetap seimbang.'),
  T('A02', 1, 'Ekspresi Aljabar', 'Algebraic Expressions', 'Suku, faktor, bentuk aljabar', 'Blok simbol', ['A01'], 'Suku dipisahkan tanda + atau −. Koefisien adalah angka yang menempel pada variabel.'),
  T('A03', 1, 'Operasi Aljabar', 'Algebraic Operations', 'Penjumlahan, pengurangan, perkalian, pembagian', 'Blok simbol', ['A02'], 'Sifat distributif: a(b + c) = ab + ac. Jabarkan dulu, lalu gabungkan.'),
  T('A04', 1, 'Suku Sejenis', 'Like Terms', 'Pengelompokan dan penyederhanaan', 'Pengelompokan kristal', ['A02'], 'Hanya suku dengan variabel dan pangkat yang sama yang boleh digabung.'),
  T('A05', 1, 'Persamaan Linear', 'Linear Equations', 'Persamaan satu variabel', 'Timbangan', ['A01', 'A04'], 'Lakukan operasi yang sama pada kedua ruas agar timbangan tetap seimbang.'),
  T('A06', 2, 'Pertidaksamaan', 'Inequalities', 'Simbol dan himpunan penyelesaian', 'Wilayah aman', ['A05'], 'Selesaikan seperti persamaan, tetapi balik tanda jika dikali atau dibagi bilangan negatif.'),
  T('A07', 2, 'Sistem Koordinat', 'Coordinate System', 'Sumbu, kuadran, titik koordinat', 'Garis koordinat', ['A01'], 'Titik ditulis (x, y): x mendatar, y tegak. Kuadran I (+,+), II (−,+), III (−,−), IV (+,−).'),
  T('A08', 2, 'Fungsi Linear', 'Linear Functions', 'Domain, kodomain, range', 'Garis koordinat', ['A07', 'A05'], 'Fungsi linear f(x) = mx + c menghasilkan satu output untuk setiap input.'),
  T('A09', 2, 'Gradien dan Garis', 'Slope and Lines', 'Kemiringan, intersep, persamaan garis', 'Kemiringan jalur', ['A08'], 'Gradien m = (y₂ − y₁) / (x₂ − x₁). Intersep c adalah nilai y saat x = 0.'),
  T('A10', 2, 'SPLDV', 'Linear Systems (2 vars)', 'Eliminasi, substitusi, grafik', 'Dua garis berpotongan', ['A09', 'A05'], 'Solusi SPLDV adalah titik yang memenuhi kedua persamaan sekaligus.'),
  T('A11', 3, 'Eksponen', 'Exponents', 'Sifat dan operasi pangkat', 'Reaktor energi', ['A03'], 'Basis sama: kali → pangkat dijumlah, bagi → pangkat dikurang, pangkat-dari-pangkat → pangkat dikali.'),
  T('A12', 3, 'Bentuk Akar', 'Radicals', 'Penyederhanaan dan operasi akar', 'Reaktor energi', ['A11'], 'Cari faktor kuadrat sempurna terbesar di dalam akar: √(a²·b) = a√b.'),
  T('A13', 3, 'Logaritma', 'Logarithms', 'Definisi dan sifat logaritma', 'Pencarian pangkat', ['A11'], 'log_b N = k artinya b^k = N. Logaritma mencari pangkatnya.'),
  T('A14', 3, 'Polinomial', 'Polynomials', 'Derajat, suku, operasi', 'Blok aljabar', ['A03', 'A04'], 'Derajat polinomial adalah pangkat tertinggi. Kalikan setiap suku dengan setiap suku lain.'),
  T('A15', 3, 'Identitas Aljabar', 'Algebraic Identities', 'Kuadrat jumlah, selisih kuadrat', 'Blok aljabar', ['A14'], '(a+b)² = a²+2ab+b²; (a−b)² = a²−2ab+b²; (a+b)(a−b) = a²−b².'),
  T('A16', 3, 'Faktorisasi', 'Factoring', 'Faktor linear dan polinomial', 'Mesin pemisah', ['A14', 'A15'], 'Cari dua bilangan yang jumlahnya = koefisien x dan hasil kalinya = konstanta.'),
  T('A17', 3, 'Persamaan Kuadrat', 'Quadratic Equations', 'Akar, diskriminan, rumus kuadrat', 'Mesin pemisah', ['A16'], 'Faktorkan lalu setiap faktor = 0. Diskriminan D = b² − 4ac menentukan jenis akar.'),
  T('A18', 3, 'Fungsi Kuadrat', 'Quadratic Functions', 'Parabola, puncak, sumbu simetri', 'Kurva parabola', ['A17', 'A08'], 'y = ax² + bx + c membentuk parabola; a menentukan arah buka dan lebar.'),
  T('A19', 3, 'Fungsi Rasional', 'Rational Functions', 'Domain, asimtot, grafik', 'Grafik dengan asimtot', ['A08', 'A05'], 'Penyebut tidak boleh nol. Nilai x yang membuat penyebut nol dikeluarkan dari domain.'),
  T('A20', 3, 'Fungsi Radikal', 'Radical Functions', 'Domain dan grafik akar', 'Grafik akar', ['A19', 'A06'], 'Isi akar harus ≥ 0. Selesaikan pertidaksamaan isi akar untuk domain.'),
  T('A21', 4, 'Sistem Multivariabel', 'Multivariable Systems', 'Tiga variabel dan sistem linear', 'Timbangan banyak variabel', ['A10'], 'Eliminasi satu variabel untuk mengubah 3 persamaan menjadi 2 persamaan.'),
  T('A22', 4, 'Matriks', 'Matrices', 'Ordo, elemen, jenis matriks', 'Grid transformasi', ['A21'], 'Ordo m×n berarti m baris dan n kolom. Elemen a_ij ada di baris i, kolom j.'),
  T('A23', 4, 'Operasi Matriks', 'Matrix Operations', 'Penjumlahan, perkalian, transpose', 'Grid transformasi', ['A22'], 'Perkalian: baris A dikali kolom B lalu dijumlahkan. Penjumlahan dilakukan elemen demi elemen.'),
  T('A24', 4, 'Determinan', 'Determinants', 'Determinan 2×2 dan 3×3', 'Stabilitas dimensi', ['A23'], 'det [[a,b],[c,d]] = ad − bc. Determinan nol berarti transformasi kehilangan dimensi.'),
  T('A25', 4, 'Invers Matriks', 'Matrix Inverse', 'Matriks invers dan aplikasinya', 'Grid transformasi', ['A24'], 'A⁻¹ = (1/det) · [[d,−b],[−c,a]]. Hasil A·A⁻¹ harus matriks identitas.'),
  T('A26', 4, 'Transformasi Linear', 'Linear Transformations', 'Rotasi, skala, refleksi', 'Grid transformasi', ['A23'], 'Kolom matriks adalah bayangan vektor basis (1,0) dan (0,1).'),
  T('A27', 4, 'Vektor', 'Vectors', 'Operasi dan representasi vektor', 'Panah arah', ['A07'], 'Vektor dijumlah komponen demi komponen. Panjang |v| = √(x² + y²).'),
  T('A28', 4, 'Ruang Vektor', 'Vector Spaces', 'Kombinasi linear, basis, dimensi', 'Panah arah', ['A27', 'A21'], 'Kombinasi linear: w = a·u + b·v. Cari a dan b yang cocok dengan kedua komponen.'),
  T('A29', 4, 'Bilangan Kompleks', 'Complex Numbers', 'Bagian real, imajiner, operasi', 'Bidang kompleks', ['A27', 'A15'], 'z = a + bi dengan i² = −1. Kalikan seperti polinomial lalu ganti i² dengan −1.'),
  T('A30', 4, 'Eigenvalue dan Eigenvector', 'Eigenvalues & Eigenvectors', 'Nilai dan vektor eigen', 'Arah stabil', ['A24', 'A26'], 'Av = λv: arah v tidak berubah setelah transformasi, hanya panjangnya yang dikali λ.'),
];

export const TOPIC_BY_CODE: Record<string, TopicMeta> = Object.fromEntries(TOPICS.map((t) => [t.code, t]));
