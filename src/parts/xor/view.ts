import icon from './icon.svg';
import type { PartView } from '../view';

export const xor: PartView = {
  label: 'XOR',
  icon,
  group: 'gate',
  description: {
    ja: '2つの入力が異なるとき ON',
    en: 'ON when the 2 inputs differ',
  },
};
