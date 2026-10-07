import icon from './icon.svg';
import type { PartView } from '../view';

/** モジュール (種類 module)。パレットには、種類ではなくモジュールごとに出す (Palette.tsx) */
export const module: PartView = {
  label: 'CUSTOM',
  icon,
  description: '回路をまとめた部品。中の INPUT / OUTPUT がピンになる',
  hints: [
    'ダブルクリックでモジュールの回路を開く',
    'ピンの並びとピン番号は、中を開いてツールバーの「モジュール設定」で確かめられる',
  ],
};
