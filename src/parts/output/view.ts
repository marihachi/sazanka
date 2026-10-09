import icon from './icon.svg';
import type { PartView } from '../view';

export const output: PartView = {
  label: 'OUTPUT',
  icon,
  group: 'io',
  description: {
    ja: '入力が ON のとき点灯するランプ。モジュールの中に置くと、そのモジュールの出力ピンになる',
  },
  hints: {
    ja: ['入力が ON のとき点灯する。モジュールの中に置くと、そのモジュールの出力ピンにもなる'],
  },
};
