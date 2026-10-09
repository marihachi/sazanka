import icon from './icon.svg';
import type { PartView } from '../view';

export const output: PartView = {
  label: 'OUTPUT',
  icon,
  group: 'io',
  description: {
    ja: '入力が ON のとき点灯するランプ。モジュールの中に置くと、そのモジュールの出力ピンになる',
    en: 'A lamp that lights while its input is ON. Inside a module, it becomes an output pin of the module',
  },
  hints: {
    ja: ['入力が ON のとき点灯する。モジュールの中に置くと、そのモジュールの出力ピンにもなる'],
    en: ['Lights while the input is ON. Inside a module, it is also an output pin of the module'],
  },
};
