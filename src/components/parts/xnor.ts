import icon from '../../assets/icons/xnor.svg';
import type { PartView } from './spec';

export const xnor: PartView = {
  label: 'XNOR',
  icon,
  group: 'gate',
  description: 'XOR の反転。2つの入力が同じとき ON',
};
