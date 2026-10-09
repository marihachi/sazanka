import icon from './icon.svg';
import type { PartView } from '../view';

/** モジュール (種類 module)。パレットには、種類ではなくモジュールごとに出す (Palette.tsx) */
export const module: PartView = {
  label: 'CUSTOM',
  icon,
  description: {
    ja: '回路をまとめた部品。中の INPUT / OUTPUT がピンになる',
    en: 'A part made from a circuit. Its INPUT / OUTPUT become pins',
  },
  hints: {
    ja: [
      'ダブルクリックでモジュールの回路を開く',
      '「モジュール設定」で、ピンの割り当てを確かめられる',
    ],
    en: [
      "Double-click to open the module's circuit",
      'Check the pin assignment in "Module settings"',
    ],
  },
};
