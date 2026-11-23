/** Mode Tantangan, Review, dan Guardian Rematch (soal diambil dari gudang Archivist, kesulitan adaptif). */
import { C, Gfx } from '../engine/gfx';
import { app, Button, Scene, UI } from '../engine/core';
import { audio } from '../engine/audio';
import { save } from '../engine/save';
import { t, tb } from '../engine/i18n';
import { TOPICS, TOPIC_BY_CODE, TopicCode } from '../data/topics';
import { GUARDIANS } from '../data/floors';
import { warehouse } from '../archivist/warehouse';
import { PuzzleResult, adaptiveDifficulty } from '../engine/progress';
import { Rng } from '../archivist/rng';
import { PuzzleScene } from './puzzle';
import { GUARDIAN_INDEX, SceneSlot, Step, guardianSteps, runSteps } from './campaign';
import { drawBg, drawStars, panel, sparkle } from './common';
import { SceneRegistry } from './menu';

const CHALLENGES: Array<{ id: string; name: string; topics: TopicCode[]; n: number }> = [
  { id: 'eq5', name: 'Solve 5 Equations', topics: ['A01', 'A03', 'A05'], n: 5 },
  { id: 'inter', name: 'Find the Intersection', topics: ['A10'], n: 5 },
  { id: 'factor', name: 'Factor the Polynomial', topics: ['A16', 'A17'], n: 5 },
  { id: 'matrix', name: 'Matrix Transformation', topics: ['A23', 'A25', 'A26'], n: 5 },
  { id: 'vector', name: 'Vector Stability', topics: ['A27', 'A28', 'A30'], n: 5 },
];
const MEDAL_COLOR = { bronze: C.gold0, silver: C.stone3, gold: C.gold2 } as const;

function medalFor(solved: number, n: number, stars: number): 'bronze' | 'silver' | 'gold' | null {
  if (solved === n && stars >= 2 * n) return 'gold';
  if (solved >= n - 1 && solved > 0 && stars >= n) return 'silver';
  return solved > 0 ? 'bronze' : null;
}

export function runPuzzleSet(opts: { id: string; title: string; topics: TopicCode[]; n: number; timer: boolean; tier: number; redo: () => void }): void {
  const depth = app.stack.length;
  const slot = new SceneSlot();
  const rng = new Rng((Date.now() & 0xfffff) + 17);
  const used = new Set<string>();
  const results: PuzzleResult[] = [];
  const steps: Step[] = [];
  for (let i = 0; i < opts.n; i++) {
    steps.push((next) => {
      const cand = warehouse.pick({ topics: opts.topics, difficulty: adaptiveDifficulty(3), rng, exclude: used });
      used.add(cand.id);
      slot.go(new PuzzleScene({
        cand, tier: TOPIC_BY_CODE[cand.topic].tier, badge: 'Tantangan', progress: `${i + 1}/${opts.n}`, timer: opts.timer ? 90 : undefined,
        onDone: (r) => { results.push(r); next(); },
        onQuit: () => app.popTo(depth),
      }));
    });
  }
  runSteps(steps, depth, () => {
    const solved = results.filter((r) => r.success).length;
    const stars = results.reduce((a, r) => a + r.stars, 0);
    const medal = medalFor(solved, opts.n, stars);
    if (medal) {
      const order = { bronze: 1, silver: 2, gold: 3 };
      const old = save.data.medals[opts.id];
      if (!old || order[medal] > order[old]) save.data.medals[opts.id] = medal;
      save.commit();
    }
    slot.go(new ResultScene(opts.title, solved, opts.n, stars, medal, opts.redo, () => app.popTo(depth)));
  });
}

class ResultScene implements Scene {
  private ui = new UI();
  private tt = 0;
  constructor(private title: string, private solved: number, private n: number, private stars: number, private medal: 'bronze' | 'silver' | 'gold' | null, redo: () => void, back: () => void) {
    this.ui.add(new Button(70, 150, 80, 20, () => t('retry'), () => { back(); redo(); }));
    this.ui.add(new Button(170, 150, 80, 20, () => t('back'), back));
  }
  enter(): void { audio.setMood(2, 0); audio.sfx(this.medal ? 'restore' : 'bad'); }
  update(dt: number): void { this.tt += dt; this.ui.update(dt); }
  draw(g: Gfx): void {
    drawBg(g, 2, true, 0.55);
    panel(g, 50, 14, 220, 170);
    sparkle(g, this.tt, 20, 50, 14, 220, 130);
    g.text(`${t('results')}: ${this.title}`, 160, 22, { size: 8, align: 'center', color: C.gold3 });
    g.text(`${this.solved}/${this.n}`, 160, 44, { size: 16, align: 'center', color: C.cyan3 });
    drawStars(g, Math.min(3, Math.round(this.stars / this.n)), 160 - 27, 70, 3);
    g.text(`${t('stars')} ${this.stars}/${this.n * 3}`, 160, 92, { size: 6, align: 'center', color: C.cream3, shadow: null });
    if (this.medal) {
      g.disc(160, 116, 12, MEDAL_COLOR[this.medal]);
      g.ring(160, 116, 12, C.cream3, 1);
      g.text(this.medal.toUpperCase(), 160, 132, { size: 8, align: 'center', color: MEDAL_COLOR[this.medal] === C.gold0 ? C.gold1 : MEDAL_COLOR[this.medal] });
    } else g.text('Coba lagi; kesalahan adalah bagian dari belajar.', 160, 116, { size: 6, align: 'center', color: C.stone3, shadow: null });
    this.ui.draw(g);
  }
  down(x: number, y: number): void { this.ui.down(x, y); }
  move(x: number, y: number): void { this.ui.move(x, y); }
  up(x: number, y: number): void { this.ui.up(x, y); }
}

export class ChallengeScene implements Scene {
  private ui = new UI();
  private tab: 'challenge' | 'review' | 'rematch' = 'challenge';
  private timer = false;
  private page = 0;
  private dyn: Button[] = [];
  private tabBtns: Button[] = [];
  constructor() {
    (['challenge', 'review', 'rematch'] as const).forEach((k, i) => this.tabBtns.push(this.ui.add(new Button(4 + i * 98, 3, 96, 16, () => t(k), () => ((this.tab = k), (this.page = 0), this.rebuild()), { size: 8 }))));
    this.ui.add(new Button(300, 3, 16, 16, '', () => app.pop(), { icon: 'icon_close' }));
    this.rebuild();
  }
  private rebuild(): void {
    this.ui.items = this.ui.items.filter((b) => !this.dyn.includes(b));
    this.dyn = [];
    const add = (b: Button): void => void this.dyn.push(this.ui.add(b));
    if (this.tab === 'challenge') {
      CHALLENGES.forEach((c, i) => add(new Button(8 + (i % 2) * 156, 26 + Math.floor(i / 2) * 36, 148, 32, c.name, () => this.startChallenge(c), { size: 8 })));
      add(new Button(8 + 156, 26 + 2 * 36, 148, 32, () => `${t('timer')}: ${this.timer ? t('on') : t('off')}`, () => (this.timer = !this.timer), { size: 8 }));
    } else if (this.tab === 'review') {
      const learned = TOPICS.filter((m) => save.data.learned.includes(m.code));
      const per = 9;
      learned.slice(this.page * per, this.page * per + per).forEach((m, i) => add(new Button(8 + (i % 3) * 104, 26 + Math.floor(i / 3) * 34, 100, 30, `${m.code} ${tb(m.title).slice(0, 14)}`, () => this.startReview(m.code), { size: 6 })));
      if (learned.length > per) {
        add(new Button(200, 148, 50, 18, '<', () => ((this.page = Math.max(0, this.page - 1)), this.rebuild()), { size: 8 }));
        add(new Button(256, 148, 50, 18, '>', () => ((this.page = Math.min(Math.floor((learned.length - 1) / per), this.page + 1)), this.rebuild()), { size: 8 }));
      }
    } else {
      (['keeper', 'twins', 'devourer', 'null'] as const).forEach((id, i) => {
        const b = new Button(8 + (i % 2) * 156, 26 + Math.floor(i / 2) * 40, 148, 36, tb(GUARDIANS[id].name), () => this.startRematch(id), { size: 8 });
        b.enabled = save.data.guardians.includes(GUARDIAN_INDEX[id]);
        add(b);
      });
    }
  }
  private startChallenge(c: (typeof CHALLENGES)[number]): void {
    const go = (): void => runPuzzleSet({ id: c.id, title: c.name, topics: c.topics, n: c.n, timer: this.timer, tier: 3, redo: go });
    go();
  }
  private startReview(code: TopicCode): void {
    const go = (): void => runPuzzleSet({ id: `review_${code}`, title: `${t('review')} ${code}`, topics: [code], n: 5, timer: false, tier: TOPIC_BY_CODE[code].tier, redo: go });
    go();
  }
  private startRematch(id: 'keeper' | 'twins' | 'devourer' | 'null'): void {
    const def = GUARDIANS[id];
    const depth = app.stack.length;
    const slot = new SceneSlot();
    const tier = id === 'keeper' ? 1 : id === 'twins' ? 2 : id === 'devourer' ? 3 : 4;
    runSteps(guardianSteps(def, tier, slot, depth, false, (Date.now() & 0xffff) + 99), depth, () => app.popTo(depth));
  }
  enter(): void { audio.setMood(3, 0); }
  update(dt: number): void { this.ui.update(dt); }
  draw(g: Gfx): void {
    drawBg(g, 3, true, 0.6);
    this.tabBtns.forEach((b, i) => {
      if (['challenge', 'review', 'rematch'][i] === this.tab) g.frame(b.x - 1, b.y - 1, b.w + 2, b.h + 2, C.gold2);
    });
    if (this.tab === 'challenge') {
      CHALLENGES.forEach((c, i) => {
        const m = save.data.medals[c.id];
        if (m) g.disc(8 + (i % 2) * 156 + 138, 26 + Math.floor(i / 2) * 36 + 22, 5, MEDAL_COLOR[m]);
      });
      g.text('Soal dari gudang Archivist; kesulitan menyesuaikan performa.', 160, 150, { size: 6, align: 'center', color: C.stone3, shadow: null });
    } else if (this.tab === 'review') {
      if (!save.data.learned.length) g.text('Pelajari materi di kampanye atau Codex dahulu.', 160, 80, { size: 8, align: 'center', color: C.stone3 });
    } else g.text('Guardian yang sudah dikalahkan dapat dimainkan ulang.', 160, 130, { size: 6, align: 'center', color: C.stone3, shadow: null });
    this.ui.draw(g);
  }
  down(x: number, y: number): void { this.ui.down(x, y); }
  move(x: number, y: number): void { this.ui.move(x, y); }
  up(x: number, y: number): void { this.ui.up(x, y); }
}
SceneRegistry.challenge = ChallengeScene;
