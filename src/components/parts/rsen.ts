import icon from '../../assets/icons/rsen.svg';
import type { PartView } from './spec';

export const rsen: PartView = {
  label: 'RS-EN Latch',
  bodyLabel: 'RS',
  icon,
  group: 'latch',
  description: 'EN が ON の間だけ、S で ON、R で OFF にする。EN が OFF の間は値を保持する',
  hints: [
    'EN が ON の間だけ、S で Q を ON、R で Q を OFF にする (両方 ON なら OFF)',
    'EN が OFF の間は、S / R を変えても Q は変わらない',
  ],
};
