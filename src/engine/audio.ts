/** Audio: efek suara + musik ambient prosedural per tier (WebAudio), dan tema Vara-Loka (berkas MP3, loop) untuk menu/peta. */
import { save } from './save';

type Sfx = 'tap' | 'move' | 'ok' | 'bad' | 'restore' | 'star' | 'blip' | 'hint' | 'whoosh' | 'boss';
const SCALES: Record<number, number[]> = {
  1: [0, 2, 4, 7, 9], // pentatonik mayor — tenang
  2: [0, 2, 4, 7, 11], // cerah & teknologis
  3: [0, 3, 5, 7, 10], // misterius
  4: [0, 2, 3, 7, 8], // megah & abstrak
};

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private tier = 1;
  private intensity = 0;
  private step = 0;

  /* ---- Tema Vara-Loka (berkas audio, loop) ---- */
  /** URL tema; diatur dari main.ts agar mengikuti BASE_URL. */
  themeUrl = '';
  private theme: HTMLAudioElement | null = null;
  private themeWanted = false;
  private themeLevel = 0; // 0..1, untuk fade in/out
  private fadeTimer: ReturnType<typeof setInterval> | null = null;
  private unlocked = false;

  /** True bila tema Vara-Loka sedang dipakai (musik prosedural dibisukan agar tidak bertabrakan). */
  get themeActive(): boolean {
    return this.themeWanted || this.themeLevel > 0.01;
  }
  /** Minta tema diputar (true) atau di-fade out (false). Aman dipanggil berulang tiap frame. */
  setTheme(on: boolean): void {
    if (this.themeWanted === on) return;
    this.themeWanted = on;
    this.startTheme();
  }
  private startTheme(): void {
    if (!this.unlocked || !this.themeUrl) return;
    if (!this.theme) {
      const a = new Audio(this.themeUrl);
      a.loop = true;
      a.preload = 'auto';
      a.volume = 0;
      this.theme = a;
    }
    if (this.themeWanted && this.theme.paused && save.data.settings.music > 0) {
      void this.theme.play().catch(() => {
        /* diblokir autoplay: dicoba lagi pada gestur berikutnya */
      });
    }
    if (!this.fadeTimer) this.fadeTimer = setInterval(() => this.fadeStep(), 50);
  }
  private fadeStep(): void {
    const a = this.theme;
    if (!a) return;
    const target = this.themeWanted && save.data.settings.music > 0 ? 1 : 0;
    const d = target - this.themeLevel;
    this.themeLevel = Math.abs(d) < 0.03 ? target : this.themeLevel + Math.sign(d) * 0.04;
    a.volume = Math.max(0, Math.min(1, this.themeLevel * 0.7 * save.data.settings.music));
    if (this.themeLevel === 0 && target === 0 && !a.paused) a.pause();
    if (this.themeLevel === target && this.fadeTimer && (target === 0 || !a.paused)) {
      clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }
  }
  /** Jeda saat app di latar belakang, lanjut saat kembali. */
  suspend(hidden: boolean): void {
    if (!this.theme) return;
    if (hidden) this.theme.pause();
    else this.startTheme();
  }

  /** Harus dipanggil dari gestur pengguna pertama. */
  unlock(): void {
    this.unlocked = true;
    if (this.themeWanted) this.startTheme();
    if (this.ctx || typeof AudioContext === 'undefined') {
      void this.ctx?.resume();
      return;
    }
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.connect(this.master);
    this.applyVolumes();
    this.timer = setInterval(() => this.tick(), 520);
  }
  applyVolumes(): void {
    if (this.musicGain) this.musicGain.gain.value = 0.18 * save.data.settings.music;
    if (this.theme) {
      if (this.themeWanted && save.data.settings.music > 0 && this.theme.paused) this.startTheme();
      else if (!this.fadeTimer) this.fadeTimer = setInterval(() => this.fadeStep(), 50);
    }
  }
  setMood(tier: number, intensity: 0 | 1 | 2): void {
    this.tier = tier;
    this.intensity = intensity;
  }
  private tone(freq: number, dur: number, type: OscillatorType, vol: number, dest: AudioNode, when = 0, slide = 0): void {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(dest);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }
  private tick(): void {
    if (!this.ctx || !this.musicGain || save.data.settings.music <= 0 || this.themeActive) return;
    const sc = SCALES[this.tier] ?? SCALES[1];
    const base = 196 * 2 ** ((this.tier - 1) / 12);
    const note = (i: number, oct: number): number => base * 2 ** (oct + sc[i % sc.length] / 12);
    const s = this.step++;
    if (s % 8 === 0) {
      this.tone(note(0, -1), 4.2, 'sine', 0.5, this.musicGain);
      this.tone(note(2, 0), 4.2, 'triangle', 0.18, this.musicGain);
    }
    const density = this.intensity === 0 ? 0.35 : this.intensity === 1 ? 0.55 : 0.85;
    if (Math.random() < density) this.tone(note(Math.floor(Math.random() * 5), this.intensity === 2 ? 1 : 0), 0.9, this.intensity === 2 ? 'square' : 'triangle', this.intensity === 2 ? 0.07 : 0.16, this.musicGain);
    if (this.intensity === 2 && s % 2 === 0) this.tone(note(0, -2), 0.25, 'square', 0.12, this.musicGain);
  }
  sfx(name: Sfx): void {
    if (!this.ctx || !this.master) return;
    const v = save.data.settings.sfx;
    if (v <= 0) return;
    const d = this.master;
    switch (name) {
      case 'tap': this.tone(660, 0.06, 'square', 0.08 * v, d); break;
      case 'move': this.tone(180, 0.09, 'triangle', 0.16 * v, d, 0, 0.6); break;
      case 'blip': this.tone(520 + Math.random() * 120, 0.03, 'square', 0.04 * v, d); break;
      case 'hint': this.tone(440, 0.18, 'sine', 0.2 * v, d); this.tone(660, 0.25, 'sine', 0.16 * v, d, 0.1); break;
      case 'ok': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.35, 'sine', 0.22 * v, d, i * 0.07)); break;
      case 'bad': this.tone(140, 0.25, 'sawtooth', 0.1 * v, d, 0, 0.7); break;
      case 'star': this.tone(1318, 0.3, 'sine', 0.2 * v, d); this.tone(1760, 0.4, 'sine', 0.16 * v, d, 0.08); break;
      case 'restore': [262, 330, 392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.7, 'triangle', 0.2 * v, d, i * 0.12)); break;
      case 'whoosh': this.tone(300, 0.25, 'sawtooth', 0.05 * v, d, 0, 3); break;
      case 'boss': this.tone(98, 0.8, 'sawtooth', 0.14 * v, d, 0, 0.5); this.tone(147, 0.8, 'square', 0.08 * v, d, 0.1); break;
    }
  }
  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.fadeTimer) clearInterval(this.fadeTimer);
    this.theme?.pause();
  }
}
export const audio = new AudioEngine();
