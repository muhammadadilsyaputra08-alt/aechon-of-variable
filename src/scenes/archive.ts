/** The Infinite Archive: latihan tanpa batas (Free / Adaptive / Mixed / Weakness) + laporan sesi. */
import { C, Gfx } from '../engine/gfx';
import { app, Button, Scene, UI } from '../engine/core';
import { t, tb } from '../engine/i18n';
import { nav } from '../engine/nav';
import { TOPICS, TOPIC_BY_CODE, TopicCode } from '../data/topics';
import { ArchiveCfg, ArchiveMode, ArchiveSession } from '../learn/archive';
import { hasWb, WB_VARIANTS, wbLabel } from '../learn/wbgen';
import { learn } from '../learn/store';
import { qTopic } from '../learn/factory';
import { drawBg, bar, panel } from './common';
import { SceneSlot, questionScene } from './learn';

const MODES: Array<[ArchiveMode, string, string]> = [
  ['free', 'Free Practice', 'Satu materi, tanpa batas.'],
  ['adaptive', 'Adaptive', 'Kesulitan naik/turun dari 5 soal terakhir.'],
  ['mixed', 'Mixed', 'Acak dari materi yang sudah dipelajari.'],
  ['weakness', 'Weakness Training', 'Fokus pada kesalahanmu sebelumnya.'],
];
const DIFFS: Array<[string, number]> = [['Basic', 2], ['Inter', 3], ['Advanced', 4], ['Expert', 5]];

export class ArchiveMenuScene implements Scene {
  private ui = new UI();
  private cfg: ArchiveCfg;
  constructor(topic?: TopicCode) {
    this.cfg = { mode: 'free', topic: topic ?? 'A03', difficulty: 3, workboard: true };
    MODES.forEach(([m], i) => this.ui.add(new Button(4 + i * 78, 24, 76, 16, MODES[i][1].split(' ')[0], () => (this.cfg.mode = m), { size: 6 })));
    const step = (d: number): void => {
      const i = TOPICS.findIndex((x) => x.code === this.cfg.topic);
      this.cfg.topic = TOPICS[(i + d + TOPICS.length) % TOPICS.length].code;
    };
    this.ui.add(new Button(4, 66, 20, 18, '<', () => step(-1), { repeat: true }));
    this.ui.add(new Button(296, 66, 20, 18, '>', () => step(1), { repeat: true }));
    DIFFS.forEach(([n, d], i) => this.ui.add(new Button(4 + i * 78, 104, 76, 16, n, () => (this.cfg.difficulty = d), { size: 6 })));
    this.ui.add(new Button(4, 126, 150, 18, () => `Workboard: ${this.cfg.workboard ? t('on') : t('off')}`, () => (this.cfg.workboard = !this.cfg.workboard), { size: 8 }));
    this.ui.add(new Button(4, 156, 80, 20, () => t('back'), () => app.pop()));
    this.ui.add(new Button(180, 150, 136, 26, 'MULAI', () => startArchive({ ...this.cfg }), { size: 10 }));
  }
  update(dt: number): void { this.ui.update(dt); }
  draw(g: Gfx): void {
    drawBg(g, 3, true, 0.62);
    g.spr('ui_learn', 'icon_infinity', 4, 3);
    g.text('THE INFINITE ARCHIVE', 160, 6, { size: 10, align: 'center', color: C.gold2 });
    this.ui.items.slice(0, 4).forEach((b, i) => MODES[i][0] === this.cfg.mode && g.frame(b.x - 1, b.y - 1, b.w + 2, b.h + 2, C.gold2));
    g.text(MODES.find((m) => m[0] === this.cfg.mode)![2], 160, 43, { size: 6, align: 'center', color: C.cyan3, shadow: null });
    const free = this.cfg.mode === 'free' || this.cfg.mode === 'adaptive';
    panel(g, 28, 58, 264, 34);
    if (free) {
      const m = TOPIC_BY_CODE[this.cfg.topic];
      g.text(`${m.code} · ${tb(m.title)}`, 160, 64, { size: 8, align: 'center', color: C.gold3 });
      g.text(`${m.sub}${hasWb(m.code) ? '  ·  Workboard ✓' : '  ·  puzzle visual'}`, 160, 77, { size: 6, align: 'center', color: C.stone3, shadow: null });
    } else g.text(this.cfg.mode === 'mixed' ? 'Materi acak dari yang sudah kamu pelajari' : 'Materi dipilih dari riwayat kesalahanmu', 160, 70, { size: 8, align: 'center', color: C.gold3 });
    this.ui.items.slice(6, 10).forEach((b, i) => DIFFS[i][1] === this.cfg.difficulty && g.frame(b.x - 1, b.y - 1, b.w + 2, b.h + 2, C.gold2));
    g.text('Kesulitan awal', 4, 95, { size: 6, color: C.blue3, shadow: null });
    g.text(`Sesi lalu: ${learn().arch.sessions}   ·   Semua materi terbuka sejak awal`, 4, 148, { size: 6, color: C.stone3, shadow: null });
    this.ui.draw(g);
  }
  down(x: number, y: number): void { this.ui.down(x, y); }
  move(x: number, y: number): void { this.ui.move(x, y); }
  up(x: number, y: number): void { this.ui.up(x, y); }
}

export function startArchive(cfg: ArchiveCfg): void {
  const depth = app.stack.length;
  const slot = new SceneSlot();
  const session = new ArchiveSession(cfg);
  const report = (): void => {
    app.popTo(depth);
    app.push(new ReportScene(session, () => app.pop()));
  };
  const loop = (): void => {
    const q = session.next();
    slot.go(
      questionScene(q, {
        tier: TOPIC_BY_CODE[qTopic(q)].tier, badge: '∞', progress: `#${session.asked + 1}  ·  ${session.asked ? Math.round(session.accuracy * 100) : 0}%`, practice: true,
        onQuit: report,
        onDone: (r) => {
          session.record(q, r.firstTry, r.success, r.tags[0]);
          loop();
        },
      }),
    );
  };
  loop();
}

export class ReportScene implements Scene {
  private ui = new UI();
  constructor(private s: ArchiveSession, back: () => void) {
    this.ui.add(new Button(14, 156, 90, 20, () => t('back'), back));
    const f = s.focus();
    const topic = f ? (f.startsWith('pz:') ? null : WB_VARIANTS[f]) : null;
    const b = this.ui.add(new Button(116, 156, 190, 20, 'Latihan fokus berikutnya', () => {
      app.popTo(Math.max(1, app.stack.length - 1));
      startArchive({ mode: 'weakness', topic: topic ?? 'A03', difficulty: 3, workboard: true });
    }, { size: 8 }));
    b.enabled = s.asked >= 8 && !!topic;
  }
  update(dt: number): void { this.ui.update(dt); }
  draw(g: Gfx): void {
    const s = this.s;
    drawBg(g, 2, true, 0.65);
    panel(g, 6, 4, 308, 148);
    g.text('PRACTICE SESSION REPORT', 160, 10, { size: 10, align: 'center', color: C.gold2 });
    const stat = (x: number, v: string, l: string): void => {
      g.text(v, x, 26, { size: 12, align: 'center', color: C.cyan3 });
      g.text(l, x, 41, { size: 6, align: 'center', color: C.stone3, shadow: null });
    };
    stat(50, String(s.asked), 'Soal dijawab');
    stat(130, String(s.correct), 'Berhasil');
    stat(210, s.asked ? `${Math.round((s.accuracy) * 100)}%` : '–', 'Akurasi');
    stat(280, String(s.asked - s.correct), 'Gagal');
    g.text('Analisis kompetensi (percobaan pertama)', 14, 54, { size: 6, color: C.blue3, shadow: null });
    if (s.asked < 8) g.text('Butuh minimal 8 soal untuk analisis yang adil.', 160, 90, { size: 8, align: 'center', color: C.stone3 });
    else {
      const rows = Object.entries(s.byVariant).filter(([, [, n]]) => n >= 2).sort((a, b) => a[1][0] / a[1][1] - b[1][0] / b[1][1]).slice(0, 6);
      rows.forEach(([v, [ok, n]], i) => {
        const y = 64 + i * 14;
        g.text(v.startsWith('pz:') ? `Puzzle ${v.slice(3)}` : wbLabel(v).slice(0, 28), 14, y + 1, { size: 6, color: C.cream3, shadow: null });
        bar(g, 170, y - 1, 100, 9, ok / n, ok / n >= 0.8 ? C.moss2 : ok / n >= 0.5 ? C.gold2 : C.red2);
        g.text(`${Math.round((ok / n) * 100)}%`, 276, y + 1, { size: 6, color: C.cream3, shadow: null });
      });
      const f = s.focus();
      g.text(f ? `Perlu latihan tambahan: ${f.startsWith('pz:') ? f : wbLabel(f)}` : 'Bagus! Tidak ada kelemahan yang jelas.', 160, 142, { size: 6, align: 'center', color: f ? C.gold3 : C.moss3, shadow: null });
    }
    this.ui.draw(g);
  }
  down(x: number, y: number): void { this.ui.down(x, y); }
  move(x: number, y: number): void { this.ui.move(x, y); }
  up(x: number, y: number): void { this.ui.up(x, y); }
}
nav.archive = () => new ArchiveMenuScene();
