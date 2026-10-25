import icon from './icon.svg';
import symbol from './symbol.svg?raw';
import type { PartView } from '../view';

export const not: PartView = {
  label: 'NOT',
  icon,
  symbol,
  group: 'gate',
  description: {
    ja: '入力を反転する',
    en: 'Inverts the input',
  },
};
