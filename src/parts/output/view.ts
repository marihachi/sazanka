import icon from './icon.svg';
import type { PartView } from '../view';

export const output: PartView = {
  label: 'OUTPUT',
  icon,
  group: 'io',
  description:
    '入力が ON のとき点灯するランプ。モジュールの中に置くと、そのモジュールの出力ピンになる',
  hints: ['入力が ON のとき点灯する。モジュールの中に置くと、そのモジュールの出力ピンにもなる'],
};
