import icon from '../../assets/icons/tff.svg';
import type { PartView } from './spec';

export const tff: PartView = {
  label: 'T-FF',
  icon,
  group: 'flipflop',
  description: 'CLK が OFF から ON になった瞬間に、T が ON なら出力を反転する',
  hints: ['CLK (>) が OFF→ON になった瞬間、T が ON なら Q を反転する'],
};
