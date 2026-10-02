import icon from '../../assets/icons/xor.svg';
import type { PartView } from './spec';

export const xor: PartView = {
  label: 'XOR',
  icon,
  group: 'gate',
  description: '2つの入力が異なるとき ON',
};
