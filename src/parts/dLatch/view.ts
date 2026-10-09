import icon from './icon.svg';
import type { PartView } from '../view';

export const dLatch: PartView = {
  label: 'D Latch',
  bodyLabel: 'DL',
  icon,
  group: 'latch',
  description: {
    ja: 'EN が ON の間は D の値をそのまま出し、OFF になると直前の値を保持する',
    en: 'Passes D through while EN is ON, and holds the last value when EN turns OFF',
  },
  hints: {
    ja: [
      'EN が ON の間は、Q が D に追従する',
      'EN を OFF にすると、その直前の D を保持する。D-FF と違い、EN が ON の間ずっと D の変化が出力に出る',
    ],
    en: [
      'While EN is ON, Q follows D',
      'Turning EN OFF holds the D just before. Unlike D-FF, every change of D reaches the output while EN is ON',
    ],
  },
};
