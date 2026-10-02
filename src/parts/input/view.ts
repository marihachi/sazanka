import icon from './icon.svg';
import type { PartView } from '../view';

export const input: PartView = {
  label: 'INPUT',
  icon,
  group: 'io',
  description:
    '入力スイッチ。クリックで ON/OFF を切り替える。モジュールの中に置くと、そのモジュールの入力ピンになる',
  hints: ['クリックで ON/OFF。モジュールの中に置くと、そのモジュールの入力ピンにもなる'],
};
