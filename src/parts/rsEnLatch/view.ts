import icon from './icon.svg';
import type { PartView } from '../view';

export const rsEnLatch: PartView = {
  label: 'RS-EN Latch',
  bodyLabel: 'RS',
  icon,
  group: 'latch',
  description: {
    ja: 'EN が ON の間だけ、S で ON、R で OFF にする。EN が OFF の間は値を保持する',
    en: 'Only while EN is ON: S sets ON, R sets OFF. Holds the value while EN is OFF',
  },
  hints: {
    ja: [
      'EN が ON の間だけ、S で Q を ON、R で Q を OFF にする (両方 ON なら OFF)',
      'EN が OFF の間は、S / R を変えても Q は変わらない',
    ],
    en: [
      'Only while EN is ON: S sets Q ON, R sets Q OFF (both ON → OFF)',
      'While EN is OFF, changing S / R does not change Q',
    ],
  },
};
