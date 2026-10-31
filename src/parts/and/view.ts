import icon from './icon.svg';
import symbol from './symbol.svg?raw';
import type { PartView } from '../view';

export const and: PartView = {
  label: 'AND',
  icon,
  symbol,
  group: 'gate',
  description: {
    ja: 'すべての入力が ON のとき ON',
    en: 'ON when all inputs are ON',
  },
};
