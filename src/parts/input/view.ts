import icon from './icon.svg';
import type { PartView } from '../view';

export const input: PartView = {
  label: 'INPUT',
  icon,
  group: 'io',
  description: {
    ja: '入力スイッチ。クリックで ON/OFF を切り替える。回路をモジュールとして置くと、入力ピンになる',
    en: 'Input switch. Click to toggle ON/OFF. When the circuit is placed as a module, it becomes an input pin',
  },
  hints: {
    ja: ['クリックで ON/OFF。回路をモジュールとして置くと、入力ピンにもなる'],
    en: ['Click to toggle ON/OFF. When the circuit is placed as a module, it is also an input pin'],
  },
};
