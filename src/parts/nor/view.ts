import icon from './icon.svg';
import symbol from './symbol.svg?raw';
import type { PartView } from '../view';

export const nor: PartView = {
  label: 'NOR',
  icon,
  symbol,
  group: 'gate',
  description: {
    ja: 'OR の反転。すべての入力が OFF のときだけ ON',
    en: 'Inverted OR. ON only when all inputs are OFF',
  },
};
