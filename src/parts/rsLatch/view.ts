import icon from './icon.svg';
import type { PartView } from '../view';

export const rsLatch: PartView = {
  label: 'RS Latch',
  bodyLabel: 'RS',
  icon,
  group: 'latch',
  description: { ja: 'S で ON、R で OFF にして値を保持する。クロックはなく、入力にすぐ反応する' },
  hints: {
    ja: [
      'S が ON で Q を ON、R が ON で Q を OFF にする (両方 ON なら OFF)',
      'クロックはなく、S / R が変わるとすぐに Q が変わる',
    ],
  },
};
