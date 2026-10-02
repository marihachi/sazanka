import icon from '../../assets/icons/dff.svg';
import type { PartView } from './spec';

export const dff: PartView = {
  label: 'D-FF',
  icon,
  group: 'flipflop',
  description: 'CLK が OFF から ON になった瞬間に D の値を取り込み、保持する',
  hints: ['CLK (>) が OFF→ON になった瞬間の D を Q に取り込む'],
};
