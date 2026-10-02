import icon from '../../assets/icons/nor.svg';
import type { PartView } from './spec';

export const nor: PartView = {
  label: 'NOR',
  icon,
  group: 'gate',
  description: 'OR の反転。すべての入力が OFF のときだけ ON',
};
