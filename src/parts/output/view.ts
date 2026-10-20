import icon from './icon.svg';
import type { PartView } from '../view';

export const output: PartView = {
  label: 'OUTPUT',
  icon,
  group: 'io',
  description: {
    ja: '入力が ON のとき点灯するランプ。回路をモジュールとして置くと、出力ピンになる',
    en: 'A lamp that lights while its input is ON. When the circuit is placed as a module, it becomes an output pin',
  },
  hints: {
    ja: ['入力が ON のとき点灯する。回路をモジュールとして置くと、出力ピンにもなる'],
    en: [
      'Lights while the input is ON. When the circuit is placed as a module, it is also an output pin',
    ],
  },
};
