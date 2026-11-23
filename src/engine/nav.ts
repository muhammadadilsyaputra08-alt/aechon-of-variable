/** Registri pabrik scene untuk menghindari impor melingkar antar scene. */
import { Scene } from './core';
import { TopicCode } from '../data/topics';

export const nav: {
  title: () => Scene;
  codex: (topic?: TopicCode) => Scene;
  settings: () => Scene;
  campaign: () => Scene;
} = {
  title: () => {
    throw new Error('nav.title belum terdaftar');
  },
  codex: () => {
    throw new Error('nav.codex belum terdaftar');
  },
  settings: () => {
    throw new Error('nav.settings belum terdaftar');
  },
  campaign: () => {
    throw new Error('nav.campaign belum terdaftar');
  },
};
