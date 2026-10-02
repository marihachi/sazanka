import icon from '../../assets/icons/jkff.svg';
import type { PartView } from './spec';

export const jkff: PartView = {
  label: 'JK-FF',
  icon,
  group: 'flipflop',
  description: 'CLK が OFF から ON になった瞬間に、J で ON、K で OFF、両方 ON なら反転する',
  hints: ['CLK (>) が OFF→ON になった瞬間に、J で ON、K で OFF、両方で反転する'],
};
