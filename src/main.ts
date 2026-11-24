import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Gfx, W, H } from './engine/gfx';
import { App, setApp } from './engine/core';
import { audio } from './engine/audio';
import { save } from './engine/save';
import { nav } from './engine/nav';
import { BootScene, SettingsScene, TitleScene } from './scenes/menu';
import { CampaignScene } from './scenes/campaign';
import { CodexScene } from './scenes/codex';
import { PuzzleScene } from './scenes/puzzle';
import { warehouse } from './archivist/warehouse';
import { TopicCode } from './data/topics';
import './scenes/lab';
import './scenes/curriculum';
import './scenes/archive';
import './learn/store';
import './scenes/challenge';

const canvas = document.getElementById('game') as HTMLCanvasElement;
audio.themeUrl = `${import.meta.env.BASE_URL}audio/vara-loka-theme.mp3`;
const g = new Gfx(canvas);
const app = new App(g);
setApp(app);

nav.title = () => new TitleScene();
nav.codex = (topic) => new CodexScene(topic);
nav.settings = () => new SettingsScene();
nav.campaign = () => new CampaignScene();

/** Ruang aman (notch, gesture bar) dibaca dari env(safe-area-inset-*). */
function insets(): { l: number; r: number; t: number; b: number } {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const v = { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
  probe.remove();
  return v;
}
/** Menyesuaikan layar: skala pecahan memenuhi perangkat apa pun (rasio 4:3 hingga 21:9), tanpa memotong. */
function fit(): void {
  const vv = window.visualViewport;
  const iw = vv?.width ?? window.innerWidth;
  const ih = vv?.height ?? window.innerHeight;
  const s = insets();
  g.resize(Math.max(160, iw - s.l - s.r), Math.max(90, ih - s.t - s.b), window.devicePixelRatio || 1);
  document.body.style.paddingLeft = `${s.l}px`;
  document.body.style.paddingTop = `${s.t}px`;
  document.body.classList.toggle('portrait', ih > iw * 1.15);
}
window.visualViewport?.addEventListener('resize', fit);
window.addEventListener('resize', fit);
window.addEventListener('orientationchange', fit);
fit();

function pos(e: PointerEvent): [number, number] {
  const r = canvas.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
}
let activePointer: number | null = null;
let lastPos: [number, number] = [0, 0];
const release = (cancel: boolean): void => {
  if (activePointer === null) return;
  activePointer = null;
  if (cancel) app.cancelInput();
  else app.up(...lastPos);
};
canvas.addEventListener('pointerdown', (e) => {
  // Pointer lama yang tidak pernah dilepas (event hilang) dibatalkan agar input tidak macet.
  if (activePointer !== null) {
    if (e.pointerType !== 'mouse' && e.pointerId !== activePointer && e.isPrimary) release(true);
    else return;
  }
  activePointer = e.pointerId;
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch {
    /* pointer sudah tidak aktif */
  }
  lastPos = pos(e);
  app.down(...lastPos);
  e.preventDefault();
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId !== activePointer) return;
  lastPos = pos(e);
  app.move(...lastPos);
});
const end = (e: PointerEvent): void => {
  if (e.pointerId !== activePointer) return;
  lastPos = pos(e);
  release(e.type === 'pointercancel');
};
canvas.addEventListener('pointerup', end);
canvas.addEventListener('pointercancel', end);
canvas.addEventListener('lostpointercapture', (e) => {
  if (e.pointerId === activePointer) release(true);
});
window.addEventListener('blur', () => release(true));
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') app.back();
  else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
    app.key(e.key);
    if (e.key === 'Backspace' || e.key === ' ') e.preventDefault();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    release(true);
    save.flush();
  }
  audio.suspend(document.hidden);
});
window.addEventListener('pagehide', () => save.flush());

if (Capacitor.isNativePlatform()) {
  void CapApp.addListener('backButton', () => {
    if (!app.back()) void CapApp.exitApp();
  });
  void CapApp.addListener('pause', () => save.flush());
}

app.push(
  new BootScene(
    (cb) => g.loadAll(import.meta.env.BASE_URL, cb),
    () => new TitleScene(),
  ),
  false,
);

// Hook QA (hanya aktif dengan ?debug): membuka puzzle tertentu langsung untuk pemeriksaan visual.
if (new URLSearchParams(location.search).has('debug')) {
  Object.assign(window, {
    __archon: {
      app,
      open(topic: TopicCode, target = 2, seed = 1, tier = 1): void {
        const cand = warehouse.curated(topic, seed, target);
        app.reset(new PuzzleScene({ cand, tier, badge: topic, onDone: () => app.reset(new TitleScene()), onQuit: () => app.reset(new TitleScene()) }));
      },
    },
  });
}

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  g.textScale = save.data.settings.textScale;
  app.update(dt * save.data.settings.animSpeed);
  app.draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
void audio;
