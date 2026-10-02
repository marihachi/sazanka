import icon from './icon.svg';
import type { PartView } from '../view';

export const nand: PartView = {
  label: 'NAND',
  icon,
  group: 'gate',
  description: 'AND の反転。すべての入力が ON のときだけ OFF',
};
