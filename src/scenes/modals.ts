/** Scene modal kecil: keypad angka, petunjuk X-Ray, jeda. */
import { C, Gfx, W, H } from '../engine/gfx';
import { app, Button, Scene, UI } from '../engine/core';
import { audio } from '../engine/audio';
import { Q, parseQ, fmtQ } from '../math/rational';
import { t } from '../engine/i18n';
import { drawPortrait, panel } from './common';
import { TopicCode } from '../data/topics';
import { nav } from '../engine/nav';

export class NumpadScene implements Scene {
  modal = true;
  private ui = new UI();
  private text: string;
  constructor(private title: string, initial: Q, private cb: (v: Q | null) => void) {
    this.text = fmtQ(initial) === '0' ? '' : fmtQ(initial);
    const keys: Array<[string, () => void]> = [];
    const add = (ch: string) => () => {
      if (this.text.length < 10) this.text += ch;
    };
    const rows = [['7', '8', '9', '⌫'], ['4', '5', '6', '±'], ['1', '2', '3', '/'], ['0', '.', 'X', 'OK']];
    const x0 = 160 - 80;
    rows.forEach((row, r) =>
      row.forEach((k, c) => {
        let fn: () => void;
        if (k === '⌫') fn = () => void (this.text = this.text.slice(0, -1));
        else if (k === '±') fn = () => void (this.text = this.text.startsWith('-') ? this.text.slice(1) : `-${this.text}`);
        else if (k === 'X') fn = () => this.done(null);
        else if (k === 'OK') fn = () => this.done(parseQ(this.text || '0'));
        else fn = add(k);
        keys.push([k, fn]);
        this.ui.add(new Button(x0 + c * 41, 78 + r * 22, 38, 20, k === 'X' ? '✕' : k === 'OK' ? t('ok') : k, fn, { size: 8 }));
      }),
    );
  }
  private done(v: Q | null): void {
    app.pop(false);
    this.cb(v);
  }
  draw(g: Gfx): void {
    g.rect(0, 0, W, H, C.void0, 0.6);
    panel(g, 70, 20, 180, 154);
    g.text(this.title, 160, 27, { size: 8, align: 'center', color: C.gold3 });
    g.nine('name_plate', 90, 42, 140, 24);
    g.text(this.text || '0', 160, 49, { size: 12, align: 'center', color: C.cyan3 });
    this.ui.draw(g);
  }
  down(x: number, y: number): void { this.ui.down(x, y); }
  move(x: number, y: number): void { this.ui.move(x, y); }
  up(x: number, y: number): void { this.ui.up(x, y); }
  update(dt: number): void { this.ui.update(dt); }
  back(): boolean { this.done(null); return true; }
}

/** X-Ray Steps: 5 tingkat bantuan yang dibuat dari jejak solver. */
export class HintScene implements Scene {
  modal = true;
  private ui = new UI();
  private btnNext: Button;
  private btnGuide: Button | null = null;
  constructor(private c: { hints: string[] }, private level: number, private onReveal: (lv: number) => void, private onGuide?: () => void) {
    this.ui.add(new Button(250, 24, 16, 16, 'x', () => app.pop(false), { icon: 'icon_close' }));
    this.btnNext = this.ui.add(new Button(180, 150, 100, 18, t('moreHint'), () => this.reveal(), { size: 8 }));
    if (onGuide) {
      this.btnGuide = this.ui.add(new Button(60, 150, 112, 18, 'Lakukan langkah ini', () => this.onGuide?.(), { size: 8 }));
    }
    this.sync();
  }
  private reveal(): void {
    if (this.level >= 5) return;
    this.level++;
    audio.sfx('hint');
    this.onReveal(this.level);
    this.sync();
  }
  private sync(): void {
    this.btnNext.enabled = this.level < 5;
    if (this.btnGuide) this.btnGuide.visible = this.level >= 5;
  }
  enter(): void {
    if (this.level === 0) this.reveal();
  }
  draw(g: Gfx): void {
    g.rect(0, 0, W, H, C.void0, 0.6);
    panel(g, 44, 20, 232, 154);
    drawPortrait(g, 'axiom', 'thinking', 50, 26, 0.75);
    g.text(`${t('hintLevel')}  ${this.level}/5`, 108, 28, { size: 8, color: C.gold3 });
    const labels = ['Konsep', 'Arah', 'Visual', 'Langkah', 'Solusi terbimbing'];
    for (let i = 0; i < 5; i++) g.rect(108 + i * 26, 40, 24, 3, i < this.level ? C.cyan2 : C.stone1);
    g.text(labels[Math.max(0, this.level - 1)] ?? '', 108, 47, { size: 6, color: C.blue3 });
    const txt = this.c.hints[Math.max(0, this.level - 1)] ?? '';
    const lines = g.wrap(txt, 160, 8);
    lines.slice(0, 9).forEach((l, i) => g.math(l, 108, 58 + i * 10, { size: 8, color: C.cream3 }));
    g.text('Petunjuk tidak mengurangi akses materi.', 160, 140, { size: 6, align: 'center', color: C.stone3, shadow: null });
    this.ui.draw(g);
  }
  down(x: number, y: number): void { this.ui.down(x, y); }
  move(x: number, y: number): void { this.ui.move(x, y); }
  up(x: number, y: number): void { this.ui.up(x, y); }
  update(dt: number): void { this.ui.update(dt); }
  back(): boolean { app.pop(false); return true; }
}

export class PauseScene implements Scene {
  modal = true;
  private ui = new UI();
  constructor(c: { topic: TopicCode } | null, onQuit: () => void) {
    const x = 110;
    this.ui.add(new Button(x, 52, 100, 20, t('resume'), () => app.pop(false)));
    if (c) this.ui.add(new Button(x, 76, 100, 20, t('codex'), () => app.push(nav.codex(c.topic), false)));
    this.ui.add(new Button(x, 100, 100, 20, t('settings'), () => app.push(nav.settings(), false)));
    this.ui.add(new Button(x, 124, 100, 20, t('quit'), onQuit));
  }
  draw(g: Gfx): void {
    g.rect(0, 0, W, H, C.void0, 0.6);
    panel(g, 90, 28, 140, 126);
    g.text(t('paused'), 160, 36, { size: 10, align: 'center', color: C.gold3 });
    this.ui.draw(g);
  }
  down(x: number, y: number): void { this.ui.down(x, y); }
  move(x: number, y: number): void { this.ui.move(x, y); }
  up(x: number, y: number): void { this.ui.up(x, y); }
  back(): boolean { app.pop(false); return true; }
}

export class ConfirmScene implements Scene {
  modal = true;
  private ui = new UI();
  constructor(private msg: string, onYes: () => void) {
    this.ui.add(new Button(100, 100, 56, 20, t('ok'), () => { app.pop(false); onYes(); }));
    this.ui.add(new Button(164, 100, 56, 20, t('cancel'), () => app.pop(false)));
  }
  draw(g: Gfx): void {
    g.rect(0, 0, W, H, C.void0, 0.6);
    panel(g, 70, 50, 180, 80);
    g.wrap(this.msg, 160, 8).forEach((l, i) => g.text(l, 160, 62 + i * 10, { size: 8, align: 'center' }));
    this.ui.draw(g);
  }
  down(x: number, y: number): void { this.ui.down(x, y); }
  move(x: number, y: number): void { this.ui.move(x, y); }
  up(x: number, y: number): void { this.ui.up(x, y); }
  back(): boolean { app.pop(false); return true; }
}
