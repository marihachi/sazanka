import icon from './icon.svg';
import type { PartView } from '../view';

export const or: PartView = {
  label: 'OR',
  icon,
  symbol: { gate: 'or', negated: false },
  group: 'gate',
  description: {
    ja: 'どれかの入力が ON のとき ON',
    en: 'ON when any input is ON',
  },
};
