import { C, Gfx, W, H } from '../engine/gfx';
import { bgKey } from '../data/floors';
import { Who, Emo } from '../data/story';

export function drawBg(g: Gfx, tier: number, restored: boolean, dim = 0, a = 1): void {
  g.img(bgKey(tier, restored), 0, 0, { a });
  if (dim > 0) g.rect(0, 0, W, H, C.ind0, dim);
}
export function portraitFrame(who: Who, emo: Emo): string | null {
  const key = who === 'architect' || who === 'null' ? 'null' : who === 'axiom' || who === 'elyra' ? who : null;
  return key ? `${key}_${emo}` : null;
}
export function drawPortrait(g: Gfx, who: Who, emo: Emo, x: number, y: number, s = 1, a = 1): void {
  const f = portraitFrame(who, emo);
  if (f) g.spr('portraits', f, x, y, { s, a });
}
export function drawStars(g: Gfx, n: number, x: number, y: number, total = 3, gap = 18): void {
  for (let i = 0; i < total; i++) g.icon(i < n ? 'star_full' : 'star_empty', x + i * gap, y);
}
export function bar(g: Gfx, x: number, y: number, w: number, h: number, frac: number, color: string = C.moss2): void {
  g.nine('progress_frame', x, y, w, h);
  const iw = Math.max(0, Math.floor((w - 6) * Math.max(0, Math.min(1, frac))));
  if (iw > 0) g.rect(x + 3, y + 3, iw, h - 6, color);
}
/** Panel berbingkai perkamen dengan isi gelap agar teks krem tetap terbaca. */
export function panel(g: Gfx, x: number, y: number, w: number, h: number): void {
  g.nine('codex_panel', x, y, w, h);
  g.rect(x + 5, y + 5, w - 10, h - 10, C.ind0, 0.92);
}
export function sparkle(g: Gfx, t: number, n: number, x0: number, y0: number, w: number, h: number): void {
  for (let i = 0; i < n; i++) {
    const px = x0 + ((i * 53 + Math.floor(t * 20 + i * 7)) % w);
    const py = y0 + ((i * 37 + Math.floor(t * 12 + i * 11)) % h);
    g.rect(px, py, 1, 1, i % 3 === 0 ? C.gold3 : C.cyan3, 0.5 + 0.5 * Math.sin(t * 4 + i));
  }
}
