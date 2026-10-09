import icon from './icon.svg';
import type { PartView } from '../view';

export const and: PartView = {
  label: 'AND',
  icon,
  group: 'gate',
  description: { ja: 'すべての入力が ON のとき ON' },
};
