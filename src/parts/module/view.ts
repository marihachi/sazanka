import icon from './icon.svg';
import type { PartView } from '../view';

/** モジュール (種類 CUSTOM)。パレットには、種類ではなくモジュールごとに出す (Palette.tsx) */
export const module: PartView = {
  label: 'CUSTOM',
  icon,
  description: '回路をまとめた部品。シート上でダブルクリックすると中身を開く',
  hints: [
    'ダブルクリックで中身を開く',
    'ピンの番号は、中を開くと INPUT / OUTPUT の上に #1, #2… と出る',
  ],
};
