/** Algebra Codex: ensiklopedia interaktif dengan pencarian, bookmark, formula sheet, glosarium, contoh dari Archivist. */
import { C, Gfx } from '../engine/gfx';
import { app, Button, Scene, UI, clamp } from '../engine/core';
import { audio } from '../engine/audio';
import { save } from '../engine/save';
import { t, tb } from '../engine/i18n';
import { TOPICS, TOPIC_BY_CODE, TopicCode } from '../data/topics';
import { CODEX } from '../data/codex';
import { foundryOne } from '../archivist/pipeline';
import { warehouse } from '../archivist/warehouse';
import { markLearned } from '../engine/progress';
import { drawBg, panel } from './common';
import { PuzzleScene } from './puzzle';

const GLOSSARY: Array<[string, string]> = [
  ['Variabel', 'Simbol untuk bilangan yang belum diketahui, mis. x.'],
  ['Konstanta', 'Bilangan tetap yang nilainya tidak berubah.'],
  ['Koefisien', 'Bilangan yang mengalikan variabel pada suatu suku.'],
  ['Suku', 'Bagian ekspresi yang dipisahkan tanda + atau −.'],
  ['Suku sejenis', 'Suku dengan variabel dan pangkat yang sama.'],
  ['Persamaan', 'Pernyataan bahwa dua ruas bernilai sama (=).'],
  ['Pertidaksamaan', 'Perbandingan dua ruas dengan <, >, ≤, atau ≥.'],
  ['Gradien', 'Kemiringan garis: perubahan y dibagi perubahan x.'],
  ['Intersep', 'Titik potong garis dengan sumbu (mis. nilai y saat x = 0).'],
  ['Domain', 'Himpunan semua input yang boleh dipakai suatu fungsi.'],
  ['Akar', 'Nilai x yang membuat persamaan/fungsi bernilai nol.'],
  ['Diskriminan', 'D = b² − 4ac; menentukan banyak akar real persamaan kuadrat.'],
  ['Eksponen', 'Pangkat: perkalian berulang basis yang sama.'],
  ['Logaritma', 'Pangkat yang diperlukan basis untuk menghasilkan suatu bilangan.'],
  ['Polinomial', 'Jumlah suku berpangkat bulat tak negatif.'],
  ['Matriks', 'Susunan bilangan dalam baris dan kolom.'],
  ['Determinan', 'Bilangan yang merangkum faktor skala sebuah transformasi.'],
  ['Invers', 'Kebalikan: A·A⁻¹ = I.'],
  ['Vektor', 'Besaran dengan arah dan panjang.'],
  ['Eigenvector', 'Vektor yang arahnya tidak berubah oleh transformasi.'],
];

interface L { text: string; size: number; color: string; math?: boolean; gap?: number }
type Mode = 'list' | 'detail' | 'formula' | 'glossary';

export class CodexScene implements Scene {
  private ui = new UI();
  private mode: Mode = 'list';
  private topic: TopicCode = 'A01';
  private filter: 'all' | 1 | 2 | 3 | 4 | 'bm' = 'all';
  private page = 0;
  private query = '';
  private lines: L[] = [];
  private scroll = 0;
  private maxScroll = 0;
  private dragY: number | null = null;
  private dragMoved = false;
  private itemRects: Array<{ x: number; y: number; code: TopicCode }> = [];
  private dyn: Button[] = [];
  private tabBtns: Button[] = [];

  constructor(topic?: TopicCode) {
    const tabs: Array<[string, () => void]> = [
      ['codex', () => this.setMode('list')],
      ['formulaSheet', () => this.setMode('formula')],
      ['Istilah', () => this.setMode('glossary')],
    ];
    tabs.forEach(([k, fn], i) => this.tabBtns.push(this.ui.add(new Button(4 + i * 62, 3, 60, 16, () => t(k), fn, { size: 8 }))));
    this.ui.add(new Button(194, 3, 60, 16, () => t('search'), () => this.doSearch(), { size: 8 }));
    this.ui.add(new Button(258, 3, 58, 16, () => t('back'), () => app.pop(), { size: 8 }));
    if (topic) this.open(topic);
  }
  private doSearch(): void {
    const q = typeof window !== 'undefined' && typeof window.prompt === 'function' ? window.prompt(`${t('search')} (nama / rumus)`, this.query) : null;
    if (q !== null) {
      this.query = q.trim().toLowerCase();
      this.mode = 'list';
      this.page = 0;
      this.rebuild();
    }
  }
  private setMode(m: Mode): void {
    this.mode = m;
    this.scroll = 0;
    this.rebuild();
  }
  enter(): void { this.rebuild(); }
  open(topic: TopicCode): void {
    this.topic = topic;
    this.mode = 'detail';
    this.scroll = 0;
    if (markLearned(topic)) app.toast(`+3 ${t('kp')}`);
    this.rebuild();
  }
  private matches(code: TopicCode): boolean {
    const m = TOPIC_BY_CODE[code];
    const cx = CODEX[code];
    if (this.filter === 'bm' && !save.data.bookmarks.includes(code)) return false;
    if (typeof this.filter === 'number' && m.tier !== this.filter) return false;
    if (!this.query) return true;
    const hay = `${code} ${m.title.id} ${m.title.en} ${m.sub} ${cx.formulas.join(' ')} ${cx.notation}`.toLowerCase();
    return hay.includes(this.query);
  }
  private wrapInto(g: Gfx | null, out: L[], text: string, size: number, color: string, math = false, gap = 1): void {
    const scale = save.data.settings.textScale;
    const sz = Math.round(size * (size >= 8 ? scale : 1));
    const rows = g ? g.wrap(text, 288, sz) : [text];
    rows.forEach((r, i) => out.push({ text: r, size: sz, color, math, gap: i === rows.length - 1 ? gap : 0 }));
  }
  private build(g: Gfx): void {
    const out: L[] = [];
    const W_ = (s: string, size: number, color: string, math = false, gap = 2): void => this.wrapInto(g, out, s, size, color, math, gap);
    if (this.mode === 'detail') {
      const m = TOPIC_BY_CODE[this.topic];
      const cx = CODEX[this.topic];
      W_(`${m.code}  ${tb(m.title)}`, 10, C.gold3);
      W_(m.sub, 6, C.stone3, false, 4);
      W_('Tujuan belajar', 6, C.cyan3, false, 0); W_(cx.goal, 8, C.cream3, false, 4);
      W_('Deskripsi', 6, C.cyan3, false, 0); W_(cx.def, 8, C.cream3, false, 4);
      W_('Simbol & notasi', 6, C.cyan3, false, 0); W_(cx.notation, 8, C.snow2, true, 4);
      W_('Rumus penting', 6, C.cyan3, false, 0);
      cx.formulas.forEach((f) => W_(f, 8, C.gold2, true, 1));
      W_(`Visualisasi: ${m.vis}`, 6, C.blue3, false, 4);
      // Contoh langkah demi langkah dari Archivist Engine (selalu tervalidasi solver)
      let ex = foundryOne(this.topic, 4242 + this.topic.charCodeAt(2) * 17, 2);
      for (let s = 0; ex.status !== 'Active' && s < 20; s++) ex = foundryOne(this.topic, 4300 + s, 2);
      if (ex.status === 'Active') {
        W_('Contoh dari gudang Archivist (terverifikasi)', 6, C.cyan3, false, 0);
        W_(tb(ex.prompt), 8, C.cream3, false, 1);
        ex.display.forEach((d) => W_(d, 8, C.snow2, true, 1));
        ex.trace.forEach((s, i) => W_(`${i + 1}. ${s}`, 8, C.moss3, true, 1));
        out.push({ text: '', size: 4, color: C.cream3, gap: 4 });
      }
      W_('Kesalahan yang sering terjadi', 6, C.red3, false, 0);
      cx.mistakes.forEach((s) => W_(`• ${s}`, 8, C.cream3, false, 1));
      W_('Tips & strategi', 6, C.cyan3, false, 0); W_(cx.tip, 8, C.cream3, false, 4);
      W_('Ringkasan', 6, C.cyan3, false, 0); W_(cx.summary, 8, C.gold3, false, 4);
      W_(`Dipakai pada puzzle: ${m.vis}`, 6, C.blue3, false, 8);
    } else if (this.mode === 'formula') {
      W_(t('formulaSheet'), 10, C.gold3, false, 4);
      for (const m of TOPICS) {
        W_(`${m.code} ${tb(m.title)}`, 6, C.cyan3, false, 0);
        CODEX[m.code].formulas.forEach((f) => W_(f, 8, C.gold2, true, 1));
        out.push({ text: '', size: 4, color: C.cream3, gap: 3 });
      }
    } else if (this.mode === 'glossary') {
      W_('Glosarium', 10, C.gold3, false, 4);
      for (const [k, v] of GLOSSARY) {
        W_(k, 8, C.cyan3, false, 0);
        W_(v, 8, C.cream3, true, 3);
      }
    }
    this.lines = out;
    const total = out.reduce((a, l) => a + l.size + 2 + (l.gap ?? 0), 0);
    this.maxScroll = Math.max(0, total - 128);
    this.scroll = clamp(this.scroll, 0, this.maxScroll);
  }
  private pending = true;
  private rebuild(): void {
    this.pending = true;
    this.dyn.forEach((b) => (b.visible = false));
    this.ui.items = this.ui.items.filter((b) => !this.dyn.includes(b));
    this.dyn = [];
    const add = (b: Button): void => void this.dyn.push(this.ui.add(b));
    if (this.mode === 'list') {
      const chips: Array<['all' | 1 | 2 | 3 | 4 | 'bm', string]> = [['all', 'Semua'], [1, 'I'], [2, 'II'], [3, 'III'], [4, 'IV'], ['bm', '★']];
      chips.forEach(([f, lab], i) => add(new Button(4 + i * 36, 22, 34, 14, lab, () => ((this.filter = f), (this.page = 0), this.rebuild()), { size: 6 })));
      const list = TOPICS.filter((m) => this.matches(m.code));
      const per = 10;
      const pages = Math.max(1, Math.ceil(list.length / per));
      this.page = clamp(this.page, 0, pages - 1);
      add(new Button(222, 22, 44, 14, '<', () => ((this.page = Math.max(0, this.page - 1)), this.rebuild()), { size: 8 }));
      add(new Button(272, 22, 44, 14, '>', () => ((this.page = Math.min(pages - 1, this.page + 1)), this.rebuild()), { size: 8 }));
      this.itemRects = list.slice(this.page * per, this.page * per + per).map((m, i) => ({ x: 4 + (i % 2) * 158, y: 40 + Math.floor(i / 2) * 24, code: m.code }));
    } else if (this.mode === 'detail') {
      const m = TOPIC_BY_CODE[this.topic];
      add(new Button(4, 160, 58, 18, () => (save.data.bookmarks.includes(this.topic) ? '★ ' : '☆ ') + t('bookmark'), () => this.toggleBookmark(), { size: 6 }));
      add(new Button(66, 160, 58, 18, () => t('practice'), () => this.practice(), { size: 8 }));
      m.prereq.slice(0, 3).forEach((p, i) => add(new Button(130 + i * 62, 160, 60, 18, `← ${p}`, () => this.open(p), { size: 8 })));
    }
  }
  private toggleBookmark(): void {
    const b = save.data.bookmarks;
    const i = b.indexOf(this.topic);
    if (i >= 0) b.splice(i, 1);
    else b.push(this.topic);
    save.commit();
  }
  private practice(): void {
    const cand = warehouse.pick({ topics: [this.topic], difficulty: 2 });
    // Kedalaman tumpukan sebelum puzzle dibuka: 'Keluar' dari Jeda harus menutup puzzle (bukan hanya modal Jeda).
    const depth = app.stack.length;
    app.push(new PuzzleScene({ cand, tier: TOPIC_BY_CODE[this.topic].tier, badge: this.topic, practice: true, onDone: () => app.popTo(depth), onQuit: () => app.popTo(depth) }), true);
  }
  update(dt: number): void { this.ui.update(dt); }
  draw(g: Gfx): void {
    if (this.pending) {
      this.build(g);
      this.pending = false;
    }
    drawBg(g, 1, true, 0.62);
    panel(g, 0, 0, 320, 21);
    this.tabBtns.forEach((b, i) => {
      const active = (i === 0 && (this.mode === 'list' || this.mode === 'detail')) || (i === 1 && this.mode === 'formula') || (i === 2 && this.mode === 'glossary');
      if (active) g.frame(b.x - 1, b.y - 1, b.w + 2, b.h + 2, C.gold2);
    });
    if (this.mode === 'list') this.drawList(g);
    else {
      panel(g, 2, 22, 316, 136);
      g.ctx.save();
      g.ctx.beginPath();
      g.ctx.rect(6, 26, 308, 128);
      g.ctx.clip();
      let y = 28 - this.scroll;
      for (const l of this.lines) {
        if (y > 24 && y < 158 && l.text) {
          if (l.math) g.math(l.text, 10, y, { size: l.size, color: l.color });
          else g.text(l.text, 10, y, { size: l.size, color: l.color });
        }
        y += l.size + 2 + (l.gap ?? 0);
      }
      g.ctx.restore();
      if (this.maxScroll > 0) {
        g.rect(314, 28 + (this.scroll / this.maxScroll) * 110, 2, 14, C.gold2);
      }
      if (this.mode !== 'detail') this.hint(g);
    }
    this.ui.draw(g);
  }
  private hint(g: Gfx): void {
    g.text('Geser untuk menggulir', 160, 162, { size: 6, align: 'center', color: C.stone3, shadow: null });
  }
  private drawList(g: Gfx): void {
    if (this.query) g.text(`"${this.query}"`, 162, 26, { size: 6, align: 'center', color: C.gold3, shadow: null });
    for (const r of this.itemRects) {
      const m = TOPIC_BY_CODE[r.code];
      panel(g, r.x, r.y, 154, 22);
      const learned = save.data.learned.includes(r.code);
      g.text(r.code, r.x + 8, r.y + 3, { size: 8, color: C.gold2 });
      g.text(g.wrap(tb(m.title), 100, 8)[0], r.x + 36, r.y + 3, { size: 8, color: C.cream3 });
      g.text(m.sub.length > 34 ? `${m.sub.slice(0, 33)}…` : m.sub, r.x + 8, r.y + 12, { size: 6, color: C.stone3, shadow: null });
      if (learned) g.icon('icon_check', r.x + 136, r.y + 2, 0.9);
      if (save.data.bookmarks.includes(r.code)) g.text('★', r.x + 146, r.y + 14, { size: 6, color: C.gold2 });
    }
    if (!this.itemRects.length) g.text('Tidak ada materi yang cocok.', 160, 90, { size: 8, align: 'center', color: C.stone3 });
  }
  down(x: number, y: number): void {
    if (this.ui.down(x, y)) return;
    this.dragY = y;
    this.dragMoved = false;
    if (this.mode === 'list') {
      for (const r of this.itemRects) {
        if (x >= r.x && x < r.x + 154 && y >= r.y && y < r.y + 22) {
          audio.sfx('tap');
          this.open(r.code);
          return;
        }
      }
    }
  }
  move(x: number, y: number): void {
    this.ui.move(x, y);
    if (this.dragY !== null && this.mode !== 'list') {
      const dy = this.dragY - y;
      if (Math.abs(dy) > 0) {
        this.scroll = clamp(this.scroll + dy, 0, this.maxScroll);
        this.dragY = y;
        this.dragMoved = true;
      }
    }
  }
  up(x: number, y: number): void {
    this.dragY = null;
    this.ui.up(x, y);
    void this.dragMoved;
  }
  back(): boolean {
    if (this.mode === 'detail') {
      this.setMode('list');
      return true;
    }
    return false;
  }
}
