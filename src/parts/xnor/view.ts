import icon from './icon.svg';
import type { PartView } from '../view';

export const xnor: PartView = {
  label: 'XNOR',
  icon,
  group: 'gate',
  description: { ja: 'XOR の反転。2つの入力が同じとき ON' },
};
