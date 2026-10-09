import icon from './icon.svg';
import type { PartView } from '../view';

export const tFlipFlop: PartView = {
  label: 'T-FF',
  icon,
  group: 'flipflop',
  description: { ja: 'CLK が OFF から ON になった瞬間に、T が ON なら出力を反転する' },
  hints: {
    ja: ['CLK (>) が OFF→ON になった瞬間、T が ON なら Q を反転する'],
  },
};
