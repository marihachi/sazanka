import icon from './icon.svg';
import type { PartView } from '../view';

export const jkFlipFlop: PartView = {
  label: 'JK-FF',
  icon,
  group: 'flipflop',
  description: 'CLK が OFF から ON になった瞬間に、J で ON、K で OFF、両方 ON なら反転する',
  hints: ['CLK (>) が OFF→ON になった瞬間に、J で ON、K で OFF、両方で反転する'],
};
