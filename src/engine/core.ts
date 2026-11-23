/** Inti aplikasi: antarmuka Scene, tumpukan scene dengan transisi fade, dan widget UI sentuh. */
import { C, Gfx, W, H } from './gfx';
import { audio } from './audio';
import { save } from './save';

export interface Scene {
  enter?(): void;
  exit?(): void;
  update?(dt: number): void;
  draw(g: Gfx): void;
  down?(x: number, y: number): void;
  move?(x: number, y: number): void;
  up?(x: number, y: number): void;
  /** Sentuhan dibatalkan (pointer hilang): lepaskan semua tombol tanpa memicu aksi. */
  cancel?(): void;
  /** Tombol back Android / Esc. Kembalikan true bila sudah ditangani. */
  back?(): boolean;
  /** Bila true, scene di bawahnya tetap digambar (modal). */
  modal?: boolean;
}

export class App {
  stack: Scene[] = [];
  time = 0;
  private fade = { a: 0, dir: 0 as -1 | 0 | 1, then: null as null | (() => void) };
  private toasts: Array<{ msg: string; t: number }> = [];
  constructor(readonly g: Gfx) {}

  toast(msg: string): void {
    this.toasts.push({ msg, t: 3 });
  }

  get top(): Scene | undefined {
    return this.stack[this.stack.length - 1];
  }
  private swap(fn0: () => void, animate: boolean): void {
    const fn = (): void => {
      UI.cancelAll();
      fn0();
    };
    // Jalankan dulu aksi yang masih menunggu agar tidak hilang tertimpa (penyebab tombol "tidak merespon").
    this.flushFade();
    if (!animate || save.data.settings.reduceFx || this.stack.length === 0) {
      fn();
      return;
    }
    this.fade = { a: 0, dir: 1, then: fn };
  }
  private flushFade(): void {
    const f = this.fade;
    if (f.dir === 1 && f.then) {
      const fn = f.then;
      f.then = null;
      f.a = 0;
      f.dir = 0;
      fn();
    }
  }
  push(s: Scene, animate = true): void {
    this.swap(() => {
      this.stack.push(s);
      s.enter?.();
    }, animate && !s.modal);
  }
  pop(animate = true): void {
    this.swap(() => {
      const s = this.stack.pop();
      s?.exit?.();
    }, animate && !this.top?.modal);
  }
  replace(s: Scene): void {
    this.swap(() => {
      const old = this.stack.pop();
      old?.exit?.();
      this.stack.push(s);
      s.enter?.();
    }, true);
  }
  /** Ganti seluruh tumpukan (mis. kembali ke menu utama). */
  reset(s: Scene): void {
    this.swap(() => {
      while (this.stack.length) this.stack.pop()?.exit?.();
      this.stack.push(s);
      s.enter?.();
    }, true);
  }
  /** Pangkas tumpukan sampai kedalaman tertentu (kembali ke menu pemanggil). */
  popTo(depth: number): void {
    this.swap(() => {
      while (this.stack.length > Math.max(1, depth)) this.stack.pop()?.exit?.();
    }, true);
  }
  back(): boolean {
    const t = this.top;
    if (!t) return false;
    if (t.back?.()) return true;
    if (this.stack.length > 1) {
      this.pop();
      return true;
    }
    return false;
  }
  update(dt: number): void {
    this.time += dt;
    const f = this.fade;
    if (f.dir !== 0) {
      f.a += (f.dir * dt) / 0.12;
      if (f.dir === 1 && f.a >= 1) {
        f.a = 1;
        f.then?.();
        f.then = null;
        f.dir = -1;
      } else if (f.dir === -1 && f.a <= 0) {
        f.a = 0;
        f.dir = 0;
      }
    }
    this.toasts.forEach((x) => (x.t -= dt));
    this.toasts = this.toasts.filter((x) => x.t > 0);
    this.top?.update?.(dt);
  }
  draw(): void {
    const g = this.g;
    g.begin();
    g.rect(0, 0, W, H, C.ink);
    let start = this.stack.length - 1;
    while (start > 0 && this.stack[start].modal) start--;
    for (let i = Math.max(0, start); i < this.stack.length; i++) this.stack[i].draw(g);
    if (this.fade.a > 0) g.rect(0, 0, W, H, C.void0, this.fade.a);
    this.toasts.slice(0, 2).forEach((x, i) => {
      const w = Math.min(300, g.measure(x.msg, 8) + 16);
      g.nine('name_plate', 160 - w / 2, 2 + i * 18, w, 16);
      g.text(x.msg, 160, 5 + i * 18, { size: 8, align: 'center', color: C.gold3 });
    });
  }
  private blocked(): boolean {
    return this.fade.dir === 1;
  }
  down(x: number, y: number): void {
    audio.unlock();
    if (!this.blocked()) this.top?.down?.(x, y);
  }
  move(x: number, y: number): void {
    this.top?.move?.(x, y);
  }
  up(x: number, y: number): void {
    // Selalu teruskan 'up' agar tombol yang sedang ditekan dilepas (tidak macet saat transisi fade).
    this.top?.up?.(x, y);
  }
  /** Batalkan interaksi sentuh yang menggantung (pointer hilang, app ke latar belakang). */
  cancelInput(): void {
    UI.cancelAll();
    this.top?.cancel?.();
  }
}

export let app: App;
export const setApp = (a: App): void => void (app = a);

/* ================= Widget ================= */
export class Button {
  enabled = true;
  visible = true;
  pressed = false;
  holdT = 0;
  fired = 0;
  constructor(
    public x: number,
    public y: number,
    public w: number,
    public h: number,
    public label: string | (() => string),
    public onTap: () => void,
    public opts: { icon?: string; repeat?: boolean; size?: number; color?: string; plain?: boolean } = {},
  ) {}
  hit(px: number, py: number): boolean {
    return this.visible && this.enabled && px >= this.x && px < this.x + this.w && py >= this.y && py < this.y + this.h;
  }
  draw(g: Gfx): void {
    if (!this.visible) return;
    const key = !this.enabled ? 'button_disabled' : this.pressed ? 'button_pressed' : 'button_normal';
    g.nine(key, this.x, this.y, this.w, this.h);
    const oy = this.pressed ? 1 : 0;
    if (this.opts.icon) g.icon(this.opts.icon, this.x + (this.w - 16) / 2, this.y + (this.h - 16) / 2 + oy, this.enabled ? 1 : 0.4);
    const lab = typeof this.label === 'function' ? this.label() : this.label;
    if (lab) {
      const size = this.opts.size ?? 8;
      g.text(lab, this.x + this.w / 2, this.y + (this.h - size) / 2 - 1 + oy, { size, align: 'center', color: this.enabled ? (this.opts.color ?? C.cream3) : C.stone2 });
    }
  }
}

/** Kumpulan tombol dengan penanganan sentuh, tahan-ulang (repeat), dan umpan balik suara. */
export class UI {
  /** UI yang terakhir memegang tombol aktif, agar bisa dibatalkan dari luar (mis. pointer hilang). */
  static holder: UI | null = null;
  static cancelAll(): void {
    UI.holder?.cancel();
    UI.holder = null;
  }
  items: Button[] = [];
  private active: Button | null = null;
  add<T extends Button>(b: T): T {
    this.items.push(b);
    return b;
  }
  clear(): void {
    this.items = [];
    this.active = null;
  }
  down(x: number, y: number): boolean {
    this.cancel();
    for (let i = this.items.length - 1; i >= 0; i--) {
      const b = this.items[i];
      if (b.hit(x, y)) {
        this.active = b;
        UI.holder = this;
        b.pressed = true;
        b.holdT = 0;
        b.fired = 0;
        audio.sfx('tap');
        return true;
      }
    }
    return false;
  }
  move(x: number, y: number): void {
    if (this.active) this.active.pressed = this.active.hit(x, y);
  }
  up(x: number, y: number): boolean {
    const b = this.active;
    this.active = null;
    if (!b) return false;
    b.pressed = false;
    if (b.hit(x, y) && !(b.opts.repeat && b.fired > 0)) b.onTap();
    return true;
  }
  cancel(): void {
    if (this.active) this.active.pressed = false;
    this.active = null;
  }
  update(dt: number): void {
    const b = this.active;
    if (b && (!b.visible || !b.enabled)) {
      this.cancel();
      return;
    }
    if (b?.pressed && b.opts.repeat) {
      b.holdT += dt;
      if (b.holdT > 0.4 + b.fired * 0.1) {
        b.fired++;
        b.onTap();
      }
    }
  }
  draw(g: Gfx): void {
    for (const b of this.items) b.draw(g);
  }
}

export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
export const ease = (t: number): number => 1 - (1 - clamp(t, 0, 1)) ** 3;
