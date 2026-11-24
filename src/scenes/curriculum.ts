/** Peta Kurikulum: Tier → Level → Sublevel, status penguasaan (Learning/Proficient/Mastered), lanjut/ulang. */
import { C, Gfx } from '../engine/gfx';
import { app, Button, Scene, UI } from '../engine/core';
import { save } from '../engine/save';
import { tb } from '../engine/i18n';
import { nav } from '../engine/nav';
import { FLOORS, TIERS } from '../data/floors';
import { TOPICS, TopicCode } from '../data/topics';
import { STAGE_LABEL, floorGoals, level } from '../learn/curriculum';
import { accuracy, activeIndex, isDone, levelProgressText, mastery, nextIndex, resetLevel } from '../learn/store';
import { drawBg, panel } from './common';
import { ConfirmScene } from './modals';
import { startFloor } from './campaign';
import { ArchiveMenuScene } from './archive';

const MCOLOR = { learning: C.stone3, proficient: C.cyan3, mastered: C.gold2 } as const;
const MNAME = { learning: 'Learning', proficient: 'Proficient', mastered: 'Mastered' } as const;

/** Lantai yang memuat sasaran materi ini dan belum selesai (atau yang terakhir). */
export function floorForTopic(topic: TopicCode): number {
  const fl = FLOORS.filter((f) => f.n !== 30 && floorGoals(f.n).some((g) => g.topic === topic));
  const open = fl.find((f) => floorGoals(f.n).some((g) => g.topic === topic && nextIndex(topic, g.count) !== null));
  return (open ?? fl[fl.length - 1] ?? FLOORS[0]).n;
}

export class CurriculumScene implements Scene {
  private ui = new UI();
  private tier: 1 | 2 | 3 | 4 = 1;
  private sel: TopicCode = 'A01';
  private rowBtns: Button[] = [];
  private dyn: Button[] = [];
  constructor() {
    this.tier = FLOORS[save.highestUnlocked() - 1].tier;
    TIERS.forEach((ti, i) => this.ui.add(new Button(4 + i * 78, 3, 74, 16, `Tier ${['I', 'II', 'III', 'IV'][i]}`, () => this.setTier(ti.tier), { size: 8 })));
    this.ui.add(new Button(296, 3, 20, 16, '', () => app.pop(), { icon: 'icon_close' }));
    this.setTier(this.tier);
  }
  private topics(): TopicCode[] {
    return TOPICS.filter((m) => m.tier === this.tier).map((m) => m.code);
  }
  private setTier(tier: 1 | 2 | 3 | 4): void {
    this.tier = tier;
    this.sel = this.topics()[0];
    this.rebuild();
  }
  private rebuild(): void {
    this.ui.items = this.ui.items.filter((b) => !this.rowBtns.includes(b) && !this.dyn.includes(b));
    this.rowBtns = this.topics().map((c, i) => this.ui.add(new Button(4, 24 + i * 15, 150, 14, '', () => ((this.sel = c), this.rebuild()), { plain: true })));
    const unlocked = FLOORS[floorForTopic(this.sel) - 1].n <= save.highestUnlocked();
    this.dyn = [
      this.ui.add(new Button(160, 156, 74, 20, 'Lanjutkan', () => startFloor(floorForTopic(this.sel)), { size: 8 })),
      this.ui.add(new Button(238, 156, 38, 20, '∞', () => app.push(new ArchiveMenuScene(this.sel)), { size: 8 })),
      this.ui.add(new Button(280, 156, 36, 20, 'Ulang', () => app.push(new ConfirmScene('Ulangi level ini dari awal? Bintang lantai tetap aman.', () => { resetLevel(this.sel); this.rebuild(); }), false), { size: 6, color: C.red3 })),
    ];
    this.dyn[0].enabled = unlocked;
  }
  enter(): void { this.rebuild(); }
  update(dt: number): void { this.ui.update(dt); }
  draw(g: Gfx): void {
    drawBg(g, this.tier, false, 0.6);
    this.ui.items.slice(0, 4).forEach((b, i) => i + 1 === this.tier && g.frame(b.x - 1, b.y - 1, b.w + 2, b.h + 2, C.gold2));
    this.topics().forEach((c, i) => {
      const y = 24 + i * 15;
      const m = TOPICS.find((x) => x.code === c)!;
      const st = mastery(c);
      g.rect(4, y, 150, 14, c === this.sel ? C.ind2 : C.ind0, c === this.sel ? 0.8 : 0.7);
      g.frame(4, y, 150, 14, st === 'mastered' ? C.gold2 : C.ind2, 0.6);
      g.text(`${c} ${tb(m.title).slice(0, 17)}`, 8, y + 4, { size: 6, color: C.cream3, shadow: null });
      g.text(levelProgressText(c), 150, y + 4, { size: 6, align: 'right', color: MCOLOR[st], shadow: null });
    });
    panel(g, 158, 22, 160, 130);
    const m = TOPICS.find((x) => x.code === this.sel)!;
    const L = level(this.sel);
    const st = mastery(this.sel);
    const acc = accuracy(this.sel);
    g.text(`${m.code} · ${tb(m.title)}`, 164, 28, { size: 8, color: C.gold3 });
    g.text(`${MNAME[st]}${acc !== null ? `  ·  akurasi ${Math.round(acc * 100)}%` : ''}`, 164, 39, { size: 6, color: MCOLOR[st], shadow: null });
    L.subs.forEach((s, i) => {
      const x = 164 + (i % 7) * 21;
      const y = 50 + Math.floor(i / 7) * 16;
      const done = isDone(s.topic, s.index);
      const cur = s.index === activeIndex(this.sel) && !done;
      g.rect(x, y, 19, 14, done ? C.moss1 : C.stone0, 0.95);
      g.frame(x, y, 19, 14, cur ? C.gold2 : s.stage === 'challenge' ? C.red2 : C.ind2, cur ? 1 : 0.7);
      g.text(String(s.index), x + 9, y + 4, { size: 6, align: 'center', color: done ? C.moss3 : C.cream3, shadow: null });
    });
    const a = L.subs[activeIndex(this.sel) - 1];
    g.text(`Berikutnya: ${a.id} ${tb(a.title).slice(0, 26)}`, 164, 118, { size: 6, color: C.cyan3, shadow: null });
    g.text(`${tb(STAGE_LABEL[a.stage])} · ${a.count} soal · lulus ≥ ${Math.round(L.passAccuracy * 100)}%`, 164, 128, { size: 6, color: C.stone3, shadow: null });
    g.text('Tiap level = satu kompetensi', 164, 140, { size: 6, color: C.stone2, shadow: null });
    this.ui.draw(g);
  }
  down(x: number, y: number): void { this.ui.down(x, y); }
  move(x: number, y: number): void { this.ui.move(x, y); }
  up(x: number, y: number): void { this.ui.up(x, y); }
}
nav.curriculum = () => new CurriculumScene();
