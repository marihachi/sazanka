import icon from '../../assets/icons/nand.svg';
import type { PartView } from './spec';

export const nand: PartView = {
  label: 'NAND',
  icon,
  group: 'gate',
  description: 'AND の反転。すべての入力が ON のときだけ OFF',
};
