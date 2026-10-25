import icon from './icon.svg';
import symbol from './symbol.svg?raw';
import type { PartView } from '../view';

export const nand: PartView = {
  label: 'NAND',
  icon,
  symbol,
  group: 'gate',
  description: {
    ja: 'AND の反転。すべての入力が ON のときだけ OFF',
    en: 'Inverted AND. OFF only when all inputs are ON',
  },
};
