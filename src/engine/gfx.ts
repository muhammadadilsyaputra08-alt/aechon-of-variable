/** Renderer 2D pixel-perfect: kanvas internal 320×180 × skala bulat, atlas dari manifest aset. */
export const W = 320;
export const H = 180;

export const C = {
  ink: '#1b1530', void0: '#08060f', void1: '#1a0f2a', ind0: '#14123a', ind1: '#2c2c7c', ind2: '#5c5cc8', ind3: '#a4acf6',
  blue0: '#1f2a5a', blue1: '#2f4fa0', blue2: '#4f86dc', blue3: '#9cc8f8',
  gold0: '#7a3e12', gold1: '#c8821a', gold2: '#f4c038', gold3: '#fff0a0',
  red1: '#a21e42', red2: '#e8485a', red3: '#ffa8a0',
  vio1: '#5a2c92', vio2: '#9a54d2', vio3: '#dca4f4',
  cyan0: '#0b3550', cyan1: '#127c9e', cyan2: '#30c8dc', cyan3: '#b0f6f2',
  mag1: '#b02a8c', mag2: '#f062bc',
  stone0: '#2a2542', stone1: '#4a4268', stone2: '#7a7298', stone3: '#b8b2d0',
  cream2: '#e6d4ac', cream3: '#fbf0d2', moss1: '#3a7a52', moss2: '#6cb070', moss3: '#b8e090',
  snow2: '#eef6ff', snow3: '#ffffff',
};

interface Frame { x: number; y: number; w: number; h: number; pivot?: [number, number] }
interface Manifest {
  sheets: Record<string, { file: string; frames: Record<string, Frame> }>;
  images: Record<string, { file: string; size: [number, number] }>;
  nine_slice: Record<string, { border: number }>;
}

export interface TextOpts {
  size?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
  shadow?: string | null;
  alpha?: number;
  bold?: boolean;
}

export class Gfx {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  scale = 1;
  textScale = 1;
  private sheets = new Map<string, HTMLImageElement>();
  private images = new Map<string, HTMLImageElement>();
  manifest!: Manifest;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D tidak tersedia');
    this.ctx = ctx;
  }

  resize(viewW: number, viewH: number, dpr: number): void {
    const s = Math.max(1, Math.floor(Math.min((viewW * dpr) / W, (viewH * dpr) / H)));
    this.scale = s;
    this.canvas.width = W * s;
    this.canvas.height = H * s;
    const cssScale = Math.min(viewW / W, viewH / H);
    this.canvas.style.width = `${Math.floor(W * cssScale)}px`;
    this.canvas.style.height = `${Math.floor(H * cssScale)}px`;
  }

  begin(): void {
    const c = this.ctx;
    c.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    c.imageSmoothingEnabled = false;
    c.globalAlpha = 1;
    c.textBaseline = 'top';
  }

  private load(src: string): Promise<HTMLImageElement> {
    return new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error(`Gagal memuat ${src}`));
      im.src = src;
    });
  }

  async loadAll(base: string, onProgress?: (p: number) => void): Promise<void> {
    this.manifest = (await (await fetch(`${base}assets/manifest.json`)).json()) as Manifest;
    const jobs: Array<() => Promise<void>> = [];
    for (const [k, s] of Object.entries(this.manifest.sheets)) jobs.push(async () => void this.sheets.set(k, await this.load(`${base}assets/${s.file}`)));
    for (const [k, s] of Object.entries(this.manifest.images)) jobs.push(async () => void this.images.set(k, await this.load(`${base}assets/${s.file}`)));
    const fonts = [
      new FontFace('Pixelify', `url(${base}fonts/pixelify-sans-latin-400-normal.woff2)`, { weight: '400' }),
      new FontFace('Pixelify', `url(${base}fonts/pixelify-sans-latin-700-normal.woff2)`, { weight: '700' }),
      new FontFace('Silkscreen', `url(${base}fonts/silkscreen-latin-400-normal.woff2)`, { weight: '400' }),
      new FontFace('Silkscreen', `url(${base}fonts/silkscreen-latin-700-normal.woff2)`, { weight: '700' }),
    ];
    for (const f of fonts) jobs.push(async () => void document.fonts.add(await f.load()));
    let done = 0;
    await Promise.all(jobs.map((j) => j().then(() => onProgress?.(++done / jobs.length))));
  }

  /** Gambar frame dari sprite sheet. (x,y) = pojok kiri-atas, atau titik pivot bila opts.pivot. */
  spr(sheet: string, frame: string, x: number, y: number, o: { a?: number; fx?: boolean; s?: number; pivot?: boolean } = {}): void {
    const im = this.sheets.get(sheet);
    const f = this.manifest?.sheets[sheet]?.frames[frame];
    if (!im || !f) return;
    const s = o.s ?? 1;
    const dx = o.pivot ? x - (f.pivot?.[0] ?? f.w / 2) * s : x;
    const dy = o.pivot ? y - (f.pivot?.[1] ?? f.h / 2) * s : y;
    const c = this.ctx;
    const prev = c.globalAlpha;
    if (o.a !== undefined) c.globalAlpha = prev * o.a;
    if (o.fx) {
      c.save();
      c.translate(dx + f.w * s, dy);
      c.scale(-1, 1);
      c.drawImage(im, f.x, f.y, f.w, f.h, 0, 0, f.w * s, f.h * s);
      c.restore();
    } else c.drawImage(im, f.x, f.y, f.w, f.h, Math.round(dx), Math.round(dy), f.w * s, f.h * s);
    c.globalAlpha = prev;
  }
  frameSize(sheet: string, frame: string): [number, number] {
    const f = this.manifest?.sheets[sheet]?.frames[frame];
    return f ? [f.w, f.h] : [0, 0];
  }
  img(key: string, x: number, y: number, o: { a?: number; s?: number } = {}): void {
    const im = this.images.get(key);
    if (!im) return;
    const c = this.ctx;
    const prev = c.globalAlpha;
    if (o.a !== undefined) c.globalAlpha = prev * o.a;
    c.drawImage(im, Math.round(x), Math.round(y), im.width * (o.s ?? 1), im.height * (o.s ?? 1));
    c.globalAlpha = prev;
  }
  nine(key: string, x: number, y: number, w: number, h: number): void {
    const im = this.images.get(key);
    const b = this.manifest?.nine_slice[key]?.border ?? 6;
    if (!im) return;
    const c = this.ctx;
    const sw = im.width;
    const sh = im.height;
    const mw = sw - 2 * b;
    const mh = sh - 2 * b;
    x = Math.round(x); y = Math.round(y);
    c.drawImage(im, 0, 0, b, b, x, y, b, b);
    c.drawImage(im, sw - b, 0, b, b, x + w - b, y, b, b);
    c.drawImage(im, 0, sh - b, b, b, x, y + h - b, b, b);
    c.drawImage(im, sw - b, sh - b, b, b, x + w - b, y + h - b, b, b);
    c.drawImage(im, b, 0, mw, b, x + b, y, w - 2 * b, b);
    c.drawImage(im, b, sh - b, mw, b, x + b, y + h - b, w - 2 * b, b);
    c.drawImage(im, 0, b, b, mh, x, y + b, b, h - 2 * b);
    c.drawImage(im, sw - b, b, b, mh, x + w - b, y + b, b, h - 2 * b);
    c.drawImage(im, b, b, mw, mh, x + b, y + b, w - 2 * b, h - 2 * b);
  }
  icon(name: string, x: number, y: number, a = 1): void {
    this.spr('ui_icons', name, x, y, { a });
  }

  rect(x: number, y: number, w: number, h: number, color: string, a = 1): void {
    const c = this.ctx;
    const prev = c.globalAlpha;
    c.globalAlpha = prev * a;
    c.fillStyle = color;
    c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    c.globalAlpha = prev;
  }
  frame(x: number, y: number, w: number, h: number, color: string, a = 1): void {
    this.rect(x, y, w, 1, color, a);
    this.rect(x, y + h - 1, w, 1, color, a);
    this.rect(x, y, 1, h, color, a);
    this.rect(x + w - 1, y, 1, h, color, a);
  }
  line(x1: number, y1: number, x2: number, y2: number, color: string, w = 1, a = 1): void {
    const c = this.ctx;
    const prev = c.globalAlpha;
    c.globalAlpha = prev * a;
    c.strokeStyle = color;
    c.lineWidth = w;
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
    c.globalAlpha = prev;
  }
  dashed(x1: number, y1: number, x2: number, y2: number, color: string): void {
    this.ctx.setLineDash([2, 2]);
    this.line(x1, y1, x2, y2, color);
    this.ctx.setLineDash([]);
  }
  disc(x: number, y: number, r: number, color: string, a = 1): void {
    const c = this.ctx;
    const prev = c.globalAlpha;
    c.globalAlpha = prev * a;
    c.fillStyle = color;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = prev;
  }
  ring(x: number, y: number, r: number, color: string, w = 1): void {
    const c = this.ctx;
    c.strokeStyle = color;
    c.lineWidth = w;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.stroke();
  }
  poly(pts: number[][], fill: string | null, stroke: string | null, a = 1): void {
    const c = this.ctx;
    const prev = c.globalAlpha;
    c.globalAlpha = prev * a;
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; c.stroke(); }
    c.globalAlpha = prev;
  }

  /* ---------- Teks ---------- */
  private setFont(size: number, bold: boolean): void {
    this.ctx.font = `${bold ? '700 ' : ''}${size}px Pixelify, Silkscreen, "Noto Sans", sans-serif`;
  }
  measure(s: string, size = 8, bold = false): number {
    this.setFont(size, bold);
    return this.ctx.measureText(s).width;
  }
  /** Teks piksel. Ukuran dalam piksel logis (8 ≈ 48px pada layar 1080p). */
  text(s: string, x: number, y: number, o: TextOpts = {}): void {
    const size = o.size ?? 8;
    const c = this.ctx;
    this.setFont(size, !!o.bold);
    const w = c.measureText(s).width;
    const dx = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
    const prev = c.globalAlpha;
    if (o.alpha !== undefined) c.globalAlpha = prev * o.alpha;
    if (o.shadow !== null) {
      c.fillStyle = o.shadow ?? C.ink;
      c.fillText(s, Math.round(dx) + 1, Math.round(y) + 1);
    }
    c.fillStyle = o.color ?? C.cream3;
    c.fillText(s, Math.round(dx), Math.round(y));
    c.globalAlpha = prev;
  }
  wrap(s: string, maxW: number, size = 8): string[] {
    const out: string[] = [];
    for (const para of s.split('\n')) {
      let line = '';
      for (const word of para.split(' ')) {
        const t = line ? `${line} ${word}` : word;
        if (this.measure(t, size) > maxW && line) {
          out.push(line);
          line = word;
        } else line = t;
      }
      out.push(line);
    }
    return out;
  }
  /** Teks dengan superskrip (^) dan subskrip (_) bergaya matematika. */
  private mathTokens(s: string): Array<{ t: string; k: 'n' | 'u' | 'd' }> {
    const out: Array<{ t: string; k: 'n' | 'u' | 'd' }> = [];
    let i = 0;
    let buf = '';
    const flush = (): void => {
      if (buf) out.push({ t: buf, k: 'n' });
      buf = '';
    };
    while (i < s.length) {
      const ch = s[i];
      if (ch === '^' || ch === '_') {
        flush();
        i++;
        let tok = '';
        if (s[i] === '{') {
          const j = s.indexOf('}', i);
          tok = s.slice(i + 1, j < 0 ? s.length : j);
          i = j < 0 ? s.length : j + 1;
        } else if (/[0-9]/.test(s[i] ?? '')) {
          while (/[0-9]/.test(s[i] ?? '')) tok += s[i++];
        } else if (s[i] === '-' && /[0-9]/.test(s[i + 1] ?? '')) {
          tok = `−${s[i + 1]}`;
          i += 2;
        } else if (i < s.length) tok = s[i++];
        out.push({ t: tok, k: ch === '^' ? 'u' : 'd' });
      } else {
        buf += ch;
        i++;
      }
    }
    flush();
    return out;
  }
  mathWidth(s: string, size = 8): number {
    return this.mathTokens(s).reduce((w, t) => w + this.measure(t.t, t.k === 'n' ? size : Math.round(size * 0.7)), 0);
  }
  math(s: string, x: number, y: number, o: TextOpts = {}): void {
    const size = o.size ?? 8;
    const total = this.mathWidth(s, size);
    let cx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
    for (const t of this.mathTokens(s)) {
      const sz = t.k === 'n' ? size : Math.max(5, Math.round(size * 0.7));
      const dy = t.k === 'u' ? -size * 0.3 : t.k === 'd' ? size * 0.25 : 0;
      this.text(t.t, cx, y + dy, { ...o, size: sz, align: 'left' });
      cx += this.measure(t.t, sz);
    }
  }
}
