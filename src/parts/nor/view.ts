import icon from './icon.svg';
import type { PartView } from '../view';

export const nor: PartView = {
  label: 'NOR',
  icon,
  group: 'gate',
  description: { ja: 'OR の反転。すべての入力が OFF のときだけ ON' },
};
