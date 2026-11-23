/** Sandbox / Algebra Laboratory: 10 laboratorium eksperimen real-time tanpa tekanan level. */
import { C, Gfx } from '../engine/gfx';
import { app, Button, Scene, UI } from '../engine/core';
import { audio } from '../engine/audio';
import { save } from '../engine/save';
import { t } from '../engine/i18n';
import { Q, q, add, cmp, fmtQ, toNumber, parseQ } from '../math/rational';
import { pMul, pAdd, pConst, pVar, pFormat } from '../math/poly';
import { solveQuadratic, det, mat, inverse, eigen2, cMul, cAdd, fmtC } from '../math/solve';
import { drawBg, panel } from './common';
import { NumpadScene } from './modals';
import { Plot, autoScale } from './views';
import { SceneRegistry } from './menu';

interface LabKnob { id: string; label: string; min: number; max: number; step: number; init: number }
interface Lab {
  id: string;
  name: string;
  desc: string;
  knobs: LabKnob[];
  presets: number[][];
  draw(g: Gfx, v: Record<string, number>, vq: Record<string, Q>, guided: boolean): string[];
}
const K = (id: string, label: string, min: number, max: number, step = 1, init = 0): LabKnob => ({ id, label, min, max, step, init });
const nq = (x: number): Q => (Number.isInteger(x) ? q(x) : (parseQ(String(x)) ?? q(0)));
const plot = (ext = 8): Plot => new Plot(196, 66, autoScale(ext, 46), 176, 96);
const f2 = (x: number): string => String(Math.round(x * 100) / 100);

const LABS: Lab[] = [
  {
    id: 'equation', name: 'Equation Lab', desc: 'a·x + b = c: ubah nilai dan lihat x.',
    knobs: [K('a', 'a', -9, 9, 1, 2), K('b', 'b', -20, 20, 1, 3), K('c', 'c', -40, 40, 1, 11)],
    presets: [[2, 3, 11], [3, -4, 8], [-1, 5, 2]],
    draw(g, v, _vq, guided) {
      const p = new Plot(190, 66, 8, 200, 60);
      p.grid(g, false);
      p.fn(g, (x) => v.a * x + v.b, C.cyan2, 2);
      p.fn(g, () => v.c, C.gold2, 1);
      const out = [`${v.a}x + ${v.b} = ${v.c}`];
      if (v.a !== 0) {
        const x = (v.c - v.b) / v.a;
        p.dot(g, x, v.c, C.moss3, 3);
        out.push(`x = (${v.c} − ${v.b}) / ${v.a} = ${f2(x)}`);
        if (guided) out.push('Titik hijau: perpotongan garis ruas kiri dan ruas kanan.');
      } else out.push(v.b === v.c ? 'Semua x memenuhi' : 'Tidak ada solusi');
      return out;
    },
  },
  {
    id: 'balance', name: 'Balance Lab', desc: 'Uji kesetaraan ax+b = cx+d pada nilai x tertentu.',
    knobs: [K('a', 'a', -6, 6, 1, 2), K('b', 'b', -12, 12, 1, 1), K('c', 'c', -6, 6, 1, 1), K('d', 'd', -12, 12, 1, 5), K('x', 'x uji', -12, 12, 1, 0)],
    presets: [[2, 1, 1, 5, 4], [3, 0, 1, 8, 4], [1, 2, 1, 2, 0]],
    draw(g, v, _vq, guided) {
      const L = v.a * v.x + v.b;
      const R = v.c * v.x + v.d;
      const frame = L === R ? 'balanced' : L > R ? 'left_heavy' : 'right_heavy';
      g.spr('balance_scale', frame, 100, 22);
      g.math(`${L} ${L === R ? '=' : L > R ? '>' : '<'} ${R}`, 148, 90, { size: 12, align: 'center', color: L === R ? C.moss3 : C.red3 });
      return [`${v.a}x + ${v.b} = ${v.c}x + ${v.d}`, `x = ${v.x}: kiri ${L}, kanan ${R}`, guided ? (L === R ? 'Seimbang: x ini adalah solusi.' : 'Belum seimbang: coba ubah x.') : ''];
    },
  },
  {
    id: 'graph', name: 'Graph Lab', desc: 'y = mx + c: gradien dan intersep.',
    knobs: [K('m', 'm', -4, 4, 0.5, 1), K('c', 'c', -6, 6, 1, 0)],
    presets: [[1, 0], [2, -1], [-0.5, 3]],
    draw(g, v, _vq, guided) {
      const p = plot(6);
      p.grid(g);
      p.fn(g, (x) => v.m * x + v.c, C.cyan2, 2);
      p.dot(g, 0, v.c, C.gold2, 3);
      const out = [`y = ${v.m}x + ${v.c}`, `memotong sumbu-y di (0, ${v.c})`];
      if (v.m !== 0) out.push(`memotong sumbu-x di (${f2(-v.c / v.m)}, 0)`);
      if (guided) out.push('Gradien besar → curam; negatif → turun ke kanan.');
      return out;
    },
  },
  {
    id: 'function', name: 'Function Lab', desc: 'f(x) = mx + c: ubah input, lihat output.',
    knobs: [K('m', 'm', -4, 4, 1, 2), K('c', 'c', -6, 6, 1, 1), K('x', 'input x', -8, 8, 1, 3)],
    presets: [[2, 1, 3], [-1, 4, 2], [3, 0, -2]],
    draw(g, v, _vq, guided) {
      const p = plot(8);
      p.grid(g);
      p.fn(g, (x) => v.m * x + v.c, C.cyan2, 2);
      const y = v.m * v.x + v.c;
      p.clip(g, () => {
        g.dashed(p.X(v.x), p.Y(0), p.X(v.x), p.Y(y), C.gold2);
        g.dashed(p.X(0), p.Y(y), p.X(v.x), p.Y(y), C.gold2);
      });
      p.dot(g, v.x, y, C.moss3, 3);
      return [`f(x) = ${v.m}x + ${v.c}`, `f(${v.x}) = ${y}`, guided ? 'Satu input menghasilkan tepat satu output.' : ''];
    },
  },
  {
    id: 'polynomial', name: 'Polynomial Lab', desc: '(px + q)(rx + s): lihat hasil penjabaran.',
    knobs: [K('p', 'p', -4, 4, 1, 1), K('q', 'q', -9, 9, 1, 2), K('r', 'r', -4, 4, 1, 1), K('s', 's', -9, 9, 1, 3)],
    presets: [[1, 2, 1, 3], [2, 1, 1, -4], [1, -3, 1, 3]],
    draw(g, v, vq, guided) {
      const f1 = pAdd(pMul(pConst(vq.p), pVar('x')), pConst(vq.q));
      const f2p = pAdd(pMul(pConst(vq.r), pVar('x')), pConst(vq.s));
      const prod = pFormat(pMul(f1, f2p));
      g.math(`(${v.p}x + ${v.q})(${v.r}x + ${v.s})`, 160, 34, { size: 10, align: 'center', color: C.cyan3 });
      g.math(`= ${prod}`, 160, 56, { size: 12, align: 'center', color: C.gold3 });
      for (let i = 0; i < 5; i++) g.spr('crystals', i % 2 ? 'x_normal' : 'unit_normal', 100 + i * 24, 82);
      return [guided ? 'Kalikan setiap suku dengan setiap suku, lalu gabungkan.' : '', `derajat hasil = ${v.p * v.r !== 0 ? 2 : v.p !== 0 || v.r !== 0 ? 1 : 0}`];
    },
  },
  {
    id: 'quadratic', name: 'Quadratic Lab', desc: 'y = ax² + bx + c: bentuk parabola.',
    knobs: [K('a', 'a', -3, 3, 0.5, 1), K('b', 'b', -8, 8, 1, -2), K('c', 'c', -8, 8, 1, -3)],
    presets: [[1, -2, -3], [-1, 0, 4], [0.5, 1, -2]],
    draw(g, v, vq, guided) {
      const p = plot(8);
      p.grid(g);
      p.fn(g, (x) => v.a * x * x + v.b * x + v.c, C.mag2, 2);
      const out = [`y = ${v.a}x² + ${v.b}x + ${v.c}`];
      if (v.a !== 0) {
        const s = solveQuadratic(vq.a, vq.b, vq.c);
        out.push(`D = ${fmtQ(s.disc)}   puncak (${f2(toNumber(s.vertex.x))}, ${f2(toNumber(s.vertex.y))})`);
        p.dot(g, toNumber(s.vertex.x), toNumber(s.vertex.y), C.gold2, 3);
        if (s.roots) {
          out.push(`akar: ${s.roots.map(fmtQ).join(', ')}`);
          s.roots.forEach((r) => p.dot(g, toNumber(r), 0, C.moss3, 3));
        } else out.push(cmp(s.disc, q(0)) < 0 ? 'tidak ada akar real (D < 0)' : 'akar tidak rasional');
        if (guided) out.push('a > 0 membuka ke atas; a < 0 ke bawah.');
      } else out.push('a = 0 → garis lurus, bukan parabola');
      return out;
    },
  },
  {
    id: 'matrix', name: 'Matrix Lab', desc: 'Transformasi bentuk dengan matriks 2×2.',
    knobs: [K('a', 'a', -3, 3, 1, 1), K('b', 'b', -3, 3, 1, 0), K('c', 'c', -3, 3, 1, 0), K('d', 'd', -3, 3, 1, 1)],
    presets: [[1, 0, 0, 1], [0, -1, 1, 0], [2, 0, 0, 2], [1, 1, 0, 1]],
    draw(g, v, vq, guided) {
      const p = plot(6);
      p.grid(g);
      const sh = [[0, 0], [2, 0], [2, 2], [1, 3], [0, 2]];
      p.clip(g, () => g.poly(sh.map(([x, y]) => [p.X(x), p.Y(y)]), C.ind2, C.ind3, 0.5));
      const tr = sh.map(([x, y]) => [v.a * x + v.b * y, v.c * x + v.d * y]);
      p.clip(g, () => g.poly(tr.map(([x, y]) => [p.X(x), p.Y(y)]), C.cyan1, C.cyan3, 0.75));
      const dt = det(mat([[v.a, v.b], [v.c, v.d]]));
      const inv = inverse([[vq.a, vq.b], [vq.c, vq.d]]);
      return [`det = ${fmtQ(dt)}${cmp(dt, q(0)) === 0 ? '  (singular: dimensi runtuh)' : ''}`, inv ? `A⁻¹ = [${inv[0].map(fmtQ).join(' ')}] [${inv[1].map(fmtQ).join(' ')}]` : 'tidak punya invers', guided ? 'Kolom 1 = bayangan (1,0); kolom 2 = bayangan (0,1).' : ''];
    },
  },
  {
    id: 'vector', name: 'Vector Lab', desc: 'Jumlah, panjang, dan hasil kali titik vektor.',
    knobs: [K('ux', 'u x', -6, 6, 1, 3), K('uy', 'u y', -6, 6, 1, 1), K('vx', 'v x', -6, 6, 1, 1), K('vy', 'v y', -6, 6, 1, 3)],
    presets: [[3, 1, 1, 3], [4, 0, 0, 3], [2, 2, -2, 2]],
    draw(g, v, _vq, guided) {
      const p = plot(8);
      p.grid(g);
      p.arrow(g, 0, 0, v.ux, v.uy, C.cyan2);
      p.arrow(g, 0, 0, v.vx, v.vy, C.mag2);
      p.arrow(g, 0, 0, v.ux + v.vx, v.uy + v.vy, C.gold2);
      return [`u + v = (${v.ux + v.vx}, ${v.uy + v.vy})`, `|u| = ${f2(Math.hypot(v.ux, v.uy))}   |v| = ${f2(Math.hypot(v.vx, v.vy))}`, `u · v = ${v.ux * v.vx + v.uy * v.vy}${v.ux * v.vx + v.uy * v.vy === 0 ? ' (tegak lurus)' : ''}`, guided ? 'Panah emas = jumlah (jajargenjang).' : ''];
    },
  },
  {
    id: 'complex', name: 'Complex Lab', desc: 'Jumlah dan hasil kali bilangan kompleks.',
    knobs: [K('a', 'Re z₁', -6, 6, 1, 1), K('b', 'Im z₁', -6, 6, 1, 2), K('c', 'Re z₂', -6, 6, 1, 3), K('d', 'Im z₂', -6, 6, 1, -1)],
    presets: [[1, 2, 3, -1], [0, 1, 0, 1], [2, 0, 0, 2]],
    draw(g, v, vq, guided) {
      const p = plot(10);
      p.grid(g, false);
      const z1 = { re: vq.a, im: vq.b };
      const z2 = { re: vq.c, im: vq.d };
      const s = cAdd(z1, z2);
      const m = cMul(z1, z2);
      g.spr('puzzle_objects', 'complex_orb', p.X(v.a), p.Y(v.b), { pivot: true, a: 0.9 });
      p.dot(g, v.c, v.d, C.mag2, 3);
      p.dot(g, toNumber(m.re), toNumber(m.im), C.gold2, 3);
      return [`z₁ + z₂ = ${fmtC(s)}`, `z₁ × z₂ = ${fmtC(m)}`, guided ? 'Titik emas = hasil kali; i² = −1.' : ''];
    },
  },
  {
    id: 'eigen', name: 'Eigen Lab', desc: 'Nilai & vektor eigen matriks 2×2.',
    knobs: [K('a', 'a', -4, 4, 1, 2), K('b', 'b', -4, 4, 1, 1), K('c', 'c', -4, 4, 1, 1), K('d', 'd', -4, 4, 1, 2)],
    presets: [[2, 0, 0, 3], [2, 1, 1, 2], [0, 1, 1, 0], [0, -1, 1, 0]],
    draw(g, v, vq, guided) {
      const p = plot(5);
      p.grid(g);
      const pairs = eigen2([[vq.a, vq.b], [vq.c, vq.d]]);
      const out: string[] = [];
      if (pairs) {
        pairs.forEach((e, i) => {
          const vx = toNumber(e.vector[0]);
          const vy = toNumber(e.vector[1]);
          const n = Math.hypot(vx, vy) || 1;
          p.arrow(g, 0, 0, (vx / n) * 4, (vy / n) * 4, i ? C.mag2 : C.cyan2);
          out.push(`λ = ${fmtQ(e.value)},  v = (${fmtQ(e.vector[0])}, ${fmtQ(e.vector[1])})`);
        });
      } else {
        const tr = v.a + v.d;
        const dt = v.a * v.d - v.b * v.c;
        const D = tr * tr - 4 * dt;
        out.push(D < 0 ? 'eigenvalue kompleks (tidak ada arah stabil real)' : `λ = ${f2((tr + Math.sqrt(D)) / 2)}, ${f2((tr - Math.sqrt(D)) / 2)} (tak rasional)`);
      }
      if (guided) out.push('Panah menunjukkan arah yang tidak berubah oleh A.');
      return out;
    },
  },
];

class LabScene implements Scene {
  private ui = new UI();
  private vals: Record<string, Q> = {};
  private guided = true;
  private presetIdx = 0;
  private boxes: Array<{ k: LabKnob; x: number; y: number; w: number; h: number }> = [];
  private info: string[] = [];
  constructor(private lab: Lab) {
    this.resetVals();
    const n = lab.knobs.length;
    const cols = n <= 3 ? n : n === 4 ? 4 : 5;
    const cw = Math.floor(312 / cols) - 2;
    lab.knobs.forEach((k, i) => {
      const x = 4 + i * (cw + 2);
      this.boxes.push({ k, x: x + 13, y: 132, w: cw - 26, h: 16 });
      this.ui.add(new Button(x, 132, 14, 16, '-', () => this.step(k, -1), { repeat: true }));
      this.ui.add(new Button(x + cw - 14, 132, 14, 16, '+', () => this.step(k, 1), { repeat: true }));
    });
    const bs: Array<[string, () => void]> = [
      ['reset', () => this.resetVals()],
      ['Preset', () => this.preset()],
      ['Simpan', () => this.saveExp()],
      ['Muat', () => this.loadExp()],
      ['Panduan', () => (this.guided = !this.guided)],
      ['back', () => app.pop()],
    ];
    bs.forEach(([lab2, fn], i) => this.ui.add(new Button(4 + i * 53, 155, 51, 18, () => (lab2 === 'reset' || lab2 === 'back' ? t(lab2) : lab2), fn, { size: 6 })));
  }
  private resetVals(): void {
    for (const k of this.lab.knobs) this.vals[k.id] = nq(k.init);
  }
  private preset(): void {
    const p = this.lab.presets[this.presetIdx++ % this.lab.presets.length];
    this.lab.knobs.forEach((k, i) => (this.vals[k.id] = nq(p[i] ?? k.init)));
    audio.sfx('hint');
  }
  private saveExp(): void {
    save.data.labs[this.lab.id] = this.lab.knobs.map((k) => toNumber(this.vals[k.id]));
    save.commit();
    app.toast('Eksperimen disimpan');
  }
  private loadExp(): void {
    const s = save.data.labs[this.lab.id];
    if (!s) return void app.toast('Belum ada eksperimen tersimpan');
    this.lab.knobs.forEach((k, i) => (this.vals[k.id] = nq(s[i] ?? k.init)));
  }
  private step(k: LabKnob, dir: number): void {
    let v = add(this.vals[k.id], nq(k.step * dir));
    if (cmp(v, nq(k.min)) < 0) v = nq(k.min);
    if (cmp(v, nq(k.max)) > 0) v = nq(k.max);
    this.vals[k.id] = v;
    audio.sfx('move');
  }
  enter(): void { audio.setMood(3, 0); }
  update(dt: number): void { this.ui.update(dt); }
  draw(g: Gfx): void {
    drawBg(g, 3, true, 0.6);
    g.text(this.lab.name, 6, 4, { size: 8, color: C.gold3 });
    g.text(this.lab.desc, 6, 14, { size: 6, color: C.stone3, shadow: null });
    const nv: Record<string, number> = {};
    for (const k of this.lab.knobs) nv[k.id] = toNumber(this.vals[k.id]);
    panel(g, 0, 22, 100, 106);
    let info: string[] = [];
    try {
      info = this.lab.draw(g, nv, this.vals, this.guided);
    } catch {
      info = ['Nilai tidak valid'];
    }
    this.info = info.filter(Boolean);
    let y = 27;
    for (const l of this.info) for (const r of g.wrap(l, 90, 6)) { g.math(r, 6, y, { size: 6, color: C.cream3 }); y += 8; }
    for (const bx of this.boxes) {
      g.nine('name_plate', bx.x, bx.y, bx.w, bx.h);
      g.text(`${bx.k.label} ${fmtQ(this.vals[bx.k.id])}`, bx.x + bx.w / 2, bx.y + 4, { size: 6, align: 'center', color: C.gold3 });
    }
    this.ui.draw(g);
  }
  down(x: number, y: number): void {
    if (this.ui.down(x, y)) return;
    for (const bx of this.boxes) {
      if (x >= bx.x && x < bx.x + bx.w && y >= bx.y && y < bx.y + bx.h) {
        app.push(new NumpadScene(bx.k.label, this.vals[bx.k.id], (v) => {
          if (!v) return;
          this.vals[bx.k.id] = cmp(v, nq(bx.k.min)) < 0 ? nq(bx.k.min) : cmp(v, nq(bx.k.max)) > 0 ? nq(bx.k.max) : v;
        }), false);
        return;
      }
    }
  }
  move(x: number, y: number): void { this.ui.move(x, y); }
  up(x: number, y: number): void { this.ui.up(x, y); }
}

export class LabMenuScene implements Scene {
  private ui = new UI();
  constructor() {
    LABS.forEach((lab, i) => this.ui.add(new Button(6 + (i % 2) * 156, 24 + Math.floor(i / 2) * 25, 152, 22, lab.name, () => app.push(new LabScene(lab)), { size: 8 })));
    this.ui.add(new Button(120, 154, 80, 20, () => t('back'), () => app.pop()));
  }
  enter(): void { audio.setMood(3, 0); }
  update(dt: number): void { this.ui.update(dt); }
  draw(g: Gfx): void {
    drawBg(g, 3, true, 0.6);
    g.text(t('labs'), 160, 6, { size: 10, align: 'center', color: C.gold3 });
    g.text('Bebas dari kampanye. Eksperimen tanpa tekanan.', 160, 16, { size: 6, align: 'center', color: C.stone3, shadow: null });
    this.ui.draw(g);
  }
  down(x: number, y: number): void { this.ui.down(x, y); }
  move(x: number, y: number): void { this.ui.move(x, y); }
  up(x: number, y: number): void { this.ui.up(x, y); }
}
SceneRegistry.lab = LabMenuScene;
export { LABS };
