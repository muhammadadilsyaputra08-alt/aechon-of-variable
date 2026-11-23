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
import './scenes/challenge';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const g = new Gfx(canvas);
const app = new App(g);
setApp(app);

nav.title = () => new TitleScene();
nav.codex = (topic) => new CodexScene(topic);
nav.settings = () => new SettingsScene();
nav.campaign = () => new CampaignScene();

function fit(): void {
  g.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
}
window.addEventListener('resize', fit);
window.addEventListener('orientationchange', fit);
fit();

function pos(e: PointerEvent): [number, number] {
  const r = canvas.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
}
let activePointer: number | null = null;
canvas.addEventListener('pointerdown', (e) => {
  if (activePointer !== null) return;
  activePointer = e.pointerId;
  canvas.setPointerCapture(e.pointerId);
  app.down(...pos(e));
  e.preventDefault();
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId === activePointer) app.move(...pos(e));
});
const end = (e: PointerEvent): void => {
  if (e.pointerId !== activePointer) return;
  activePointer = null;
  app.up(...pos(e));
};
canvas.addEventListener('pointerup', end);
canvas.addEventListener('pointercancel', end);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') app.back();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) save.flush();
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
