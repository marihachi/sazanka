import icon from './icon.svg';
import type { PartView } from '../view';

export const dlatch: PartView = {
  label: 'D Latch',
  bodyLabel: 'DL',
  icon,
  group: 'latch',
  description: 'EN が ON の間は D の値をそのまま出し、OFF になると直前の値を保持する',
  hints: [
    'EN が ON の間は、Q が D に追従する',
    'EN を OFF にすると、その直前の D を保持する。D-FF と違い、EN が ON の間ずっと D の変化が出力に出る',
  ],
};
