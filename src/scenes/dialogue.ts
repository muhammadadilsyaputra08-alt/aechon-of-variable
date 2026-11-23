/** Layar dialog visual novel: latar pixel art, potret, kotak teks mesin tik, auto/skip, riwayat, pilihan naratif. */
import { C, Gfx, W, H } from '../engine/gfx';
import { app, Button, Scene, UI } from '../engine/core';
import { audio } from '../engine/audio';
import { save } from '../engine/save';
import { t, tb, getLang } from '../engine/i18n';
import { Line, NAMES } from '../data/story';
import { GUARDIANS } from '../data/floors';
import { drawBg, drawPortrait, panel } from './common';

export interface DialogueOpts {
  tier: number;
  restored?: boolean;
  onDone: () => void;
}

export class DialogueScene implements Scene {
  private ui = new UI();
  private queue: Line[];
  private idx = 0;
  private chars = 0;
  private autoT = 0;
  private auto = false;
  private skip = false;
  private history: Line[] = [];
  private showHist = false;
  private choiceBtns: Button[] = [];
  private finished = false;

  constructor(lines: Line[], private o: DialogueOpts) {
    this.queue = [...lines];
    const mk = (icon: string, x: number, fn: () => void): Button => this.ui.add(new Button(x, 2, 17, 17, '', fn, { icon }));
    mk('icon_history', 262, () => (this.showHist = !this.showHist));
    mk('icon_auto', 281, () => (this.auto = !this.auto));
    mk('icon_skip', 300, () => (this.skip = !this.skip));
  }
  private get line(): Line | undefined {
    return this.queue[this.idx];
  }
  private get size(): number {
    return Math.round(8 * save.data.settings.textScale);
  }
  private get text(): string {
    return this.line ? tb(this.line.text) : '';
  }
  private typed(): boolean {
    return this.chars >= this.text.length;
  }
  enter(): void {
    audio.setMood(this.o.tier, 0);
    this.beginLine();
  }
  private beginLine(): void {
    this.chars = 0;
    this.autoT = 0;
    this.choiceBtns = [];
  }
  private markRead(): void {
    const l = this.line;
    if (l && !save.data.read.includes(l.id)) {
      save.data.read.push(l.id);
      save.commit();
    }
  }
  private advance(): void {
    const l = this.line;
    if (!l) return;
    if (!this.typed()) {
      this.chars = this.text.length;
      return;
    }
    if (l.choices && this.choiceBtns.length) return; // menunggu pilihan
    this.markRead();
    this.history.push(l);
    this.idx++;
    if (this.idx >= this.queue.length) {
      if (!this.finished) {
        this.finished = true;
        this.o.onDone();
      }
      return;
    }
    this.beginLine();
  }
  private offerChoices(): void {
    const l = this.line;
    if (!l?.choices || this.choiceBtns.length) return;
    this.skip = false;
    this.auto = false;
    this.choiceBtns = l.choices.map((ch, i) => {
      const b = new Button(40, 62 + i * 24, 240, 20, tb(ch.label), () => {
        if (ch.flag) save.data.flags[ch.flag] = 1;
        this.queue.splice(this.idx + 1, 0, ...ch.reply);
        this.choiceBtns = [];
        this.markRead();
        this.history.push(l);
        this.idx++;
        this.beginLine();
      });
      return b;
    });
  }
  update(dt: number): void {
    this.ui.update(dt);
    const l = this.line;
    if (!l || this.finished) return;
    const speed = 42 * save.data.settings.typeSpeed * (this.skip ? 20 : 1);
    if (!this.typed()) {
      const before = Math.floor(this.chars);
      this.chars = Math.min(this.text.length, this.chars + dt * speed);
      if (Math.floor(this.chars) > before && Math.floor(this.chars) % 3 === 0 && !this.skip) audio.sfx('blip');
    } else {
      this.offerChoices();
      if (l.choices) return;
      this.autoT += dt;
      const wantSkip = this.skip && save.data.read.includes(l.id);
      if (this.skip && !wantSkip) this.skip = false;
      if (wantSkip || (this.auto && this.autoT > 1.2 + this.text.length / 60)) this.advance();
    }
  }
  draw(g: Gfx): void {
    drawBg(g, this.o.tier, !!this.o.restored, 0.15);
    const l = this.line;
    if (!l) return;
    if (l.who === 'keeper' || l.who === 'twins' || l.who === 'devourer' || l.who === 'architect') {
      const gd = GUARDIANS[l.who === 'architect' ? 'null' : l.who];
      if (l.who !== 'architect') g.spr(gd.sprite, Math.floor(app.time * 2) % 2 ? 'idle_1' : 'idle_0', 230, 118 - gd.frameH + 2, { pivot: false });
      else g.spr(gd.sprite, Math.floor(app.time * 2) % 2 ? 'idle_1' : 'idle_0', 200, 118 - gd.frameH + 2);
    } else drawPortrait(g, l.who, l.emo, 12, 54);
    // kotak dialog
    g.nine('dialogue_box', 6, 114, 308, 64);
    const name = tb(NAMES[l.who]);
    if (name) {
      const w = g.measure(name, 8) + 16;
      g.nine('name_plate', 14, 106, w, 16);
      g.text(name, 14 + w / 2, 109, { size: 8, align: 'center', color: C.gold3 });
    }
    const size = this.size;
    const shown = this.text.slice(0, Math.floor(this.chars));
    const lines = g.wrap(this.text, 284, size).slice(0, 4);
    let used = 0;
    lines.forEach((ln, i) => {
      const part = shown.slice(used, used + ln.length + 1).trimEnd();
      used += ln.length + 1;
      if (i * (size + 3) < 50) g.text(part.slice(0, ln.length), 18, 126 + i * (size + 3), { size, color: C.cream3 });
    });
    if (this.typed() && !l.choices && Math.floor(app.time * 2) % 2 === 0) g.text('▼', 300, 166, { size: 8, color: C.gold2 });
    this.ui.items.forEach((b, i) => {
      if (i === 1 && this.auto) g.frame(b.x - 1, b.y - 1, b.w + 2, b.h + 2, C.gold2);
      if (i === 2 && this.skip) g.frame(b.x - 1, b.y - 1, b.w + 2, b.h + 2, C.gold2);
    });
    this.ui.draw(g);
    if (this.choiceBtns.length) {
      g.rect(0, 0, W, 114, C.void0, 0.45);
      this.choiceBtns.forEach((b) => b.draw(g));
    }
    if (this.showHist) this.drawHistory(g);
    void H;
    void getLang;
  }
  private drawHistory(g: Gfx): void {
    g.rect(0, 0, W, H, C.void0, 0.7);
    panel(g, 20, 14, 280, 152);
    g.text(t('history'), 160, 20, { size: 8, align: 'center', color: C.gold3 });
    let y = 34;
    const recent = this.history.slice(-5);
    for (const ln of recent) {
      const nm = tb(NAMES[ln.who]);
      g.text(nm ? `${nm}:` : '', 30, y, { size: 6, color: C.cyan3, shadow: null });
      for (const row of g.wrap(tb(ln.text), 240, 6).slice(0, 3)) {
        g.text(row, 30, y + 7, { size: 6, color: C.cream3, shadow: null });
        y += 7;
      }
      y += 11;
    }
  }
  down(x: number, y: number): void {
    if (this.showHist) {
      this.showHist = false;
      return;
    }
    if (this.ui.down(x, y)) return;
    for (const b of this.choiceBtns) if (b.hit(x, y)) return void (b.pressed = true);
    if (!this.choiceBtns.length) this.advance();
  }
  move(x: number, y: number): void {
    this.ui.move(x, y);
  }
  up(x: number, y: number): void {
    this.ui.up(x, y);
    for (const b of this.choiceBtns) if (b.pressed && b.hit(x, y)) {
      b.pressed = false;
      audio.sfx('tap');
      b.onTap();
      return;
    }
    this.choiceBtns.forEach((b) => (b.pressed = false));
  }
  back(): boolean {
    if (this.showHist) {
      this.showHist = false;
      return true;
    }
    return false;
  }
}
