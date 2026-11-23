/** Naskah visual novel (ID/EN). Pilihan dialog bersifat naratif dan tidak mengunci materi. */
import { Bi, bi } from './topics';

export type Who = 'axiom' | 'elyra' | 'null' | 'narrator' | 'player' | 'keeper' | 'twins' | 'devourer' | 'architect';
export type Emo = 'neutral' | 'happy' | 'surprised' | 'thinking';
export interface Line {
  id: string;
  who: Who;
  emo: Emo;
  text: Bi;
  choices?: Array<{ label: Bi; reply: Line[]; flag?: string }>;
}

export const NAMES: Record<Who, Bi> = {
  axiom: bi('Axiom', 'Axiom'), elyra: bi('Elyra', 'Elyra'), null: bi('The Null', 'The Null'), narrator: bi('', ''),
  player: bi('Arsitek', 'Architect'), keeper: bi('Keeper of Balance', 'Keeper of Balance'), twins: bi('Twin Sentinels', 'Twin Sentinels'),
  devourer: bi('Polynomial Devourer', 'Polynomial Devourer'), architect: bi('The Null Architect', 'The Null Architect'),
};

let uid = 0;
const L = (who: Who, emo: Emo, id: string, en: string, key?: string): Line => ({ id: key ?? `l${uid++}`, who, emo, text: bi(id, en) });
const P = (key: string, ...rows: Array<[Who, Emo, string, string]>): Line[] => rows.map((r, i) => L(r[0], r[1], r[2], r[3], `${key}.${i}`));

export const PROLOGUE: Line[] = [
  ...P('pro', 
    ['narrator', 'neutral', 'Dahulu, Vara-Loka adalah pusat peradaban yang dibangun dari matematika: setiap batu, kristal, dan cahaya hidup dari hukum keseimbangan.', 'Long ago, Vara-Loka was a civilization built from mathematics: every stone, crystal and light lived by the law of balance.'],
    ['narrator', 'neutral', 'Lalu datang The Great Collapse. Menara terpecah menjadi 30 lantai, kristal kehilangan resonansi, dan para Guardian berubah menjadi penguji.', 'Then came The Great Collapse. The tower shattered into 30 floors, the crystals lost their resonance, and the Guardians became examiners.'],
    ['axiom', 'surprised', 'Pindai selesai! The Architect’s Core merespons kamu. Kamu adalah Arsitek Menara yang kami tunggu!', 'Scan complete! The Architect’s Core responds to you. You are the Tower Architect we have been waiting for!'],
  ),
  {
    ...L('axiom', 'happy', 'Aku Axiom, pendampingmu. Aku akan menjelaskan mekanik dan memberi petunjuk. Ada yang ingin kamu tanyakan?', 'I am Axiom, your companion. I will explain the mechanics and give hints. Anything you want to ask?', 'pro.q'),
    choices: [
      { label: bi('Apa yang terjadi di sini?', 'What happened here?'), flag: 'asked_collapse', reply: P('pro.a1', ['axiom', 'thinking', 'Keseimbangan matematis dunia ini hilang. Tidak ada yang tahu penyebabnya, selain bisikan tentang entitas bernama The Null.', 'The world’s mathematical balance vanished. No one knows why, apart from whispers of an entity called The Null.']) },
      { label: bi('Aku siap. Ayo mulai!', 'I’m ready. Let’s begin!'), flag: 'eager', reply: P('pro.a2', ['axiom', 'happy', 'Semangat yang bagus! Setiap lantai yang kamu pulihkan membuat menara lebih kuat.', 'Great spirit! Every floor you restore makes the tower stronger.']) },
    ],
  },
  ...P('pro2',
    ['elyra', 'happy', 'Selamat datang, Arsitek. Aku Elyra, penjaga arsip. Semua ilmu aljabar tersimpan di Algebra Codex, dan Archivist Engine-ku menyiapkan soal yang sudah kuselesaikan lebih dulu: tak ada teka-teki tanpa jawaban.', 'Welcome, Architect. I am Elyra, keeper of the archive. All algebra lives in the Algebra Codex, and my Archivist Engine prepares puzzles that I have already solved: no puzzle without an answer.'],
    ['null', 'neutral', 'Variabel yang tak diketahui… tak akan pernah diketahui.', 'An unknown variable… will never be known.'],
    ['axiom', 'surprised', 'Itu… The Null! Lantai pertama menunggu. Ayo!', 'That… was The Null! The first floor awaits. Let’s go!'],
  ),
];

export const TUTORIAL: Line[] = P('tut',
  ['axiom', 'happy', 'Di lantai-lantai awal, kamu bekerja dengan Balance Scale. Kristal emas bernilai x, kristal biru bernilai 1.', 'On the early floors you work with the Balance Scale. Gold crystals are x, blue crystals are 1.'],
  ['axiom', 'thinking', 'Aturan emasnya: lakukan hal yang SAMA pada kedua sisi, dan timbangan tetap seimbang. Pilih operasi, atur angkanya, lalu tekan Terapkan.', 'The golden rule: do the SAME thing to both sides and the scale stays balanced. Pick an operation, set the number, then press Apply.'],
  ['axiom', 'happy', 'Tombol Urungkan dan Ulang selalu tersedia. Bantuan X-Ray Steps bertingkat dari konsep sampai langkah penuh, dan kamu tidak akan dihukum karena memakainya.', 'Undo and Reset are always there. X-Ray Steps hints go from concept to full steps, and you are never punished for using them.'],
  ['axiom', 'surprised', 'Coba ketuk satu kristal saja. Lihat apa yang terjadi pada timbangan!', 'Try tapping a single crystal. See what happens to the scale!'],
);

export const TIER_INTRO: Record<number, Line[]> = {
  1: P('t1', ['narrator', 'neutral', 'The Foundation. Cahaya biru dan krem meredup di antara pilar-pilar retak.', 'The Foundation. Blue and cream light dims between the cracked pillars.'], ['elyra', 'neutral', 'Semua bangunan berdiri di atas dasar yang sama: variabel, ekspresi, dan persamaan.', 'Every structure stands on the same base: variables, expressions and equations.']),
  2: P('t2', ['narrator', 'neutral', 'The Energy Network. Garis-garis cyan terputus, menunggu seseorang menyambungkannya.', 'The Energy Network. Cyan lines hang severed, waiting for someone to reconnect them.'], ['axiom', 'happy', 'Di sini kita memakai koordinat dan garis. Energi mengalir mengikuti persamaan!', 'Here we use coordinates and lines. Energy flows along equations!']),
  3: P('t3', ['narrator', 'neutral', 'The Resonance Chambers. Ungu dan emas bergema, melengkung seperti parabola.', 'The Resonance Chambers. Violet and gold echo, curving like parabolas.'], ['elyra', 'thinking', 'Pangkat, akar, polinomial, dan kurva. Ruangan ini menguji apakah kamu mengerti struktur di balik rumus.', 'Powers, roots, polynomials and curves. These chambers test whether you understand the structure behind formulas.']),
  4: P('t4', ['narrator', 'neutral', 'The Dimensional Sanctum. Indigo dan putih membentang tanpa dasar, ruang itu sendiri bisa dilipat.', 'The Dimensional Sanctum. Indigo and white stretch without floor; space itself can be folded.'], ['null', 'thinking', 'Kamu sudah sejauh ini. Tapi apa yang terjadi bila ruang itu sendiri kehilangan strukturnya?', 'You came this far. But what happens when space itself loses its structure?']),
};

type Row = [Who, Emo, string, string];
const IN: Row[] = [
  ['axiom', 'happy', 'Peti ini terkunci oleh sebuah variabel. Mari kita cari nilainya!', 'This chest is locked by a variable. Let’s find its value!'],
  ['elyra', 'neutral', 'Ekspresi aljabar tersusun dari suku-suku. Kenali dulu, baru olah.', 'An algebraic expression is built from terms. Recognize them first, then work.'],
  ['axiom', 'thinking', 'Kristal sejenis boleh digabung. Yang berbeda bentuk, jangan dipaksa.', 'Like crystals may merge. Do not force unlike ones together.'],
  ['elyra', 'happy', 'Buka kurung, jabarkan, sederhanakan. Tiga langkah yang rapi.', 'Open the brackets, distribute, simplify. Three tidy steps.'],
  ['axiom', 'surprised', 'Foundation Core di depan! Penjaganya sudah bangun!', 'The Foundation Core ahead! Its keeper is awake!'],
  ['elyra', 'thinking', 'Wilayah aman ditandai oleh pertidaksamaan. Cari batasnya.', 'Safe ground is marked by inequalities. Find the boundary.'],
  ['axiom', 'thinking', 'Awas: bagi dengan bilangan negatif, tandanya berbalik!', 'Careful: divide by a negative and the sign flips!'],
  ['elyra', 'happy', 'Setiap titik punya alamat: (x, y). Tempatkan energi dengan tepat.', 'Every point has an address: (x, y). Place the energy exactly.'],
  ['axiom', 'happy', 'Gradien adalah kemiringan. Semakin besar m, semakin curam jalurnya!', 'Gradient is steepness. The larger m, the steeper the rail!'],
  ['elyra', 'neutral', 'Fungsi linear: satu input, satu output, dan garis lurus di antaranya.', 'A linear function: one input, one output, and a straight line between.'],
  ['axiom', 'surprised', 'Dua jalur harus bertemu! Titik perpotongan adalah kuncinya.', 'Two rails must meet! The intersection is the key.'],
  ['elyra', 'thinking', 'Dual Gate menuntut semua yang sudah kamu pelajari di tier ini.', 'The Dual Gate demands everything you have learned in this tier.'],
  ['axiom', 'happy', 'Eksponen: kalikan basis yang sama, jumlahkan pangkatnya!', 'Exponents: multiply equal bases, add the powers!'],
  ['elyra', 'neutral', 'Akar bisa disederhanakan bila ada kuadrat sempurna di dalamnya.', 'A radical simplifies when a perfect square hides inside.'],
  ['axiom', 'thinking', 'Logaritma hanya bertanya: pangkat berapa yang kita butuhkan?', 'A logarithm just asks: which power do we need?'],
  ['elyra', 'happy', 'Polinomial adalah blok bangunan. Kalikan setiap suku dengan setiap suku.', 'Polynomials are building blocks. Multiply every term by every term.'],
  ['axiom', 'happy', 'Identitas aljabar adalah jalan pintas yang sudah teruji. Pakai dengan bijak!', 'Algebraic identities are proven shortcuts. Use them wisely!'],
  ['elyra', 'thinking', 'Factor Machine memecah polinomial. Cari dua bilangan yang cocok.', 'The Factor Machine splits polynomials. Find the two matching numbers.'],
  ['axiom', 'surprised', 'Parabola melengkung menembus cincin energi. Atur a, b, dan c!', 'A parabola arcs through the energy rings. Set a, b and c!'],
  ['elyra', 'thinking', 'Jembatan rasional tak boleh melewati titik terlarang. Resonance Core menunggu.', 'The rational bridge must avoid forbidden points. The Resonance Core awaits.'],
  ['axiom', 'surprised', 'Tiga variabel sekaligus! Eliminasi satu per satu.', 'Three variables at once! Eliminate one at a time.'],
  ['elyra', 'neutral', 'Matriks: grid angka dengan baris dan kolom. Hitung ordonya.', 'A matrix: a grid of numbers with rows and columns. Count its order.'],
  ['axiom', 'happy', 'Baris kali kolom, lalu jumlahkan. Pelan-pelan saja.', 'Row times column, then add. Take it slow.'],
  ['elyra', 'thinking', 'Determinan nol berarti dimensi runtuh. Jaga kestabilan platform.', 'A zero determinant means a collapsing dimension. Keep the platforms stable.'],
  ['axiom', 'thinking', 'Invers membalik transformasi. A dikali A⁻¹ harus identitas.', 'The inverse reverses a transformation. A times A⁻¹ must be identity.'],
  ['elyra', 'happy', 'Kolom matriks adalah bayangan vektor basis. Itu rahasia transformasi.', 'Matrix columns are the images of basis vectors. That is the secret of transformations.'],
  ['axiom', 'happy', 'Vektor adalah panah. Jumlahkan, skalakan, dan gabungkan.', 'Vectors are arrows. Add them, scale them, combine them.'],
  ['elyra', 'surprised', 'Bilangan kompleks! Ingat selalu bahwa i² = −1.', 'Complex numbers! Always remember i² = −1.'],
  ['axiom', 'thinking', 'Beberapa arah tidak berubah setelah transformasi. Itulah eigenvector.', 'Some directions do not change after a transformation. Those are eigenvectors.'],
  ['elyra', 'surprised', 'Archon Core. Semua yang kamu pelajari dipertaruhkan sekarang.', 'The Archon Core. Everything you learned is at stake now.'],
];
const OUT: Row[] = [
  ['axiom', 'happy', 'Peti terbuka! Satu variabel sudah kamu taklukkan.', 'The chest opens! You have tamed your first variable.'],
  ['elyra', 'happy', 'Rapi sekali. Arsip untuk ekspresi kini menyala.', 'Very tidy. The expression archive glows again.'],
  ['axiom', 'happy', 'Kristal bergabung sempurna. Tungku menyala lagi!', 'The crystals merged perfectly. The forge burns again!'],
  ['elyra', 'neutral', 'Operasi aljabar sudah kamu kuasai. Kita siap untuk persamaan.', 'You have mastered algebraic operations. We are ready for equations.'],
  ['axiom', 'surprised', 'Foundation Core pulih! Tier pertama selesai, dan menara mulai bernapas.', 'The Foundation Core is restored! Tier one is done and the tower begins to breathe.'],
  ['elyra', 'happy', 'Wilayah aman terbuka. Kamu membedakan titik kosong dan penuh dengan baik.', 'The safe ground opens. You tell open from filled points well.'],
  ['axiom', 'happy', 'Batas solusi tertata. Kamu ingat membalik tanda, bagus!', 'The boundary is set. You remembered to flip the sign. Nice!'],
  ['elyra', 'neutral', 'Energi tertempatkan tepat di koordinatnya.', 'The energy sits exactly on its coordinate.'],
  ['axiom', 'happy', 'Kemiringan pas! Jalur energi mengalir mulus.', 'The slope is perfect! The energy rail flows smoothly.'],
  ['elyra', 'happy', 'Fungsi linear terpasang. Jaringan makin terang.', 'The linear function is in place. The network grows brighter.'],
  ['axiom', 'happy', 'Perpotongan ditemukan! Dua jalur bersatu.', 'Intersection found! Two rails become one.'],
  ['elyra', 'surprised', 'Dual Gate menyala. Tier kedua selesai!', 'The Dual Gate blazes. Tier two is complete!'],
  ['axiom', 'happy', 'Reaktor menderu. Pangkat-pangkat itu sudah patuh padamu.', 'The reactor hums. The powers obey you now.'],
  ['elyra', 'neutral', 'Energi akar stabil. Tak ada lagi kuadrat tersembunyi.', 'The radical energy is stable. No more hidden squares.'],
  ['axiom', 'surprised', 'Arsip logaritma terbuka! Banyak catatan kuno di dalamnya.', 'The logarithm archive opens! So many ancient notes inside.'],
  ['elyra', 'happy', 'Blok-blok polinomial menyatu dengan rapi.', 'The polynomial blocks join neatly.'],
  ['axiom', 'happy', 'Identitas aktif! Jalan pintas yang elegan.', 'Identities active! Elegant shortcuts.'],
  ['elyra', 'neutral', 'Factor Machine terpecahkan. Kamu melihat struktur di balik polinomial.', 'The Factor Machine is cracked. You see the structure behind the polynomial.'],
  ['axiom', 'happy', 'Parabola menembus semua cincin! Indah sekali.', 'The parabola passes every ring! Beautiful.'],
  ['elyra', 'happy', 'Resonance Core pulih. Tier ketiga selesai, ruangan bergema lagi.', 'The Resonance Core is restored. Tier three is done and the chambers echo again.'],
  ['axiom', 'happy', 'Tiga variabel seimbang. Kamu hebat dalam eliminasi!', 'Three variables balanced. You are great at elimination!'],
  ['elyra', 'neutral', 'Grid tersusun. Kini ruang punya struktur.', 'The grid is arranged. Space has structure again.'],
  ['axiom', 'happy', 'Struktur tergabung. Operasi matriks beres!', 'Structures woven. Matrix operations done!'],
  ['elyra', 'happy', 'Dimensi terjaga. Kamu tahu kapan platform runtuh dan kapan tidak.', 'Dimensions kept. You know when a platform collapses and when it doesn’t.'],
  ['axiom', 'surprised', 'Transformasi terbalik! Seperti memutar waktu.', 'The transformation reversed! Like turning back time.'],
  ['elyra', 'happy', 'Artefak berpindah tempat dengan tepat. Transformasi linear sudah kamu pahami.', 'The artifacts moved exactly where they belong. You understand linear transformations.'],
  ['axiom', 'happy', 'Semua arah tertata. Panah-panah itu mengikuti perintahmu.', 'All directions aligned. The arrows follow your command.'],
  ['elyra', 'happy', 'Resonansi stabil. Bilangan kompleks pun tunduk padamu.', 'The resonance is stable. Even complex numbers bow to you.'],
  ['axiom', 'surprised', 'Arah stabil ditemukan! Tinggal satu lantai lagi: Archon Core.', 'The steady direction found! One floor left: the Archon Core.'],
  ['axiom', 'surprised', 'Archon Core menyala! Kamu memulihkan seluruh menara!', 'The Archon Core blazes! You restored the entire tower!'],
];
export const FLOOR_INTRO: Line[] = IN.map((r, i) => L(r[0], r[1], r[2], r[3], `fi.${i + 1}`));
export const FLOOR_OUTRO: Line[] = OUT.map((r, i) => L(r[0], r[1], r[2], r[3], `fo.${i + 1}`));

export const GUARDIAN_PRE: Record<string, Line[]> = {
  keeper: P('gk', ['keeper', 'neutral', 'Aku Keeper of Balance. Siapa pun yang naik harus menjaga kesetaraan, bahkan saat bebanku berpindah.', 'I am the Keeper of Balance. Whoever climbs must keep equality, even as my loads shift.'], ['axiom', 'thinking', 'Tak ada tekanan waktu. Pikirkan dan lakukan hal yang sama di kedua sisi.', 'No time pressure. Think, and do the same to both sides.']),
  twins: P('gt', ['twins', 'neutral', 'Dua jalur, dua inti. Temukan di mana kami bertemu sebelum energi kami habis.', 'Two rails, two cores. Find where we meet before our energy runs out.'], ['elyra', 'thinking', 'Gradien, fungsi, lalu perpotongan. Satu per satu, Arsitek.', 'Gradient, function, then intersection. One by one, Architect.']),
  devourer: P('gd', ['devourer', 'neutral', 'Aku melahap semua polinomial. Berlapis-lapis pertahananku.', 'I devour every polynomial. My defenses come in layers.'], ['axiom', 'surprised', 'Operasi, faktor, akar, kurva. Kita hadapi lapisan demi lapisan!', 'Operations, factors, roots, curves. We face it layer by layer!']),
  null: P('gn', ['architect', 'neutral', 'Aku Null Architect. Aku mematahkan keseimbangan agar dunia berhenti menuntut jawaban.', 'I am the Null Architect. I broke the balance so the world would stop demanding answers.'], ['elyra', 'thinking', 'Lima fase, lima ilmu. Gunakan seluruh perjalananmu.', 'Five phases, five disciplines. Use your whole journey.']),
};
export const GUARDIAN_POST: Record<string, Line[]> = {
  keeper: P('gk2', ['keeper', 'happy', 'Timbangan tetap seimbang di tanganmu. Lanjutkanlah.', 'The scale stays balanced in your hands. Go on.']),
  twins: P('gt2', ['twins', 'happy', 'Dua jalur kini menjadi satu titik. Kamu lulus.', 'Two rails become a single point. You pass.']),
  devourer: P('gd2', ['devourer', 'surprised', 'Setiap lapisanku kau pecahkan. Resonansi dipulihkan.', 'You broke each of my layers. Resonance is restored.']),
  null: P('gn2', ['architect', 'surprised', 'Setiap fase… kau jawab dengan pemahaman, bukan tebakan.', 'Every phase… you answered with understanding, not guessing.']),
};
export const EPILOGUE: Line[] = P('epi',
  ['null', 'surprised', 'Variabel yang tak diketahui… ternyata bisa diketahui. Bila ada yang sabar mencarinya.', 'An unknown variable… can be known after all, if someone is patient enough to look.'],
  ['elyra', 'happy', 'Vara-Loka kembali bernapas. Terima kasih, Arsitek Menara.', 'Vara-Loka breathes again. Thank you, Tower Architect.'],
  ['axiom', 'happy', 'Kamu bukan hanya menyelesaikan soal. Kamu memahaminya. Itu bedanya Archon sejati!', 'You didn’t just solve problems. You understood them. That is a true Archon!'],
  ['narrator', 'neutral', 'ARCHON OF VARIABLES. Menara dipulihkan. Yang tak diketahui, kini dikuasai.', 'ARCHON OF VARIABLES. The tower is restored. The unknown is now mastered.'],
);
