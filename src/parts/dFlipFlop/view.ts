import icon from './icon.svg';
import type { PartView } from '../view';

export const dFlipFlop: PartView = {
  label: 'D-FF',
  icon,
  group: 'flipflop',
  description: {
    ja: 'CLK が OFF から ON になった瞬間に D の値を取り込み、保持する',
    en: 'Captures and holds D the moment CLK turns from OFF to ON',
  },
  hints: {
    ja: ['CLK (>) が OFF→ON になった瞬間の D を Q に取り込む'],
    en: ['Captures D into Q the moment CLK (>) turns OFF→ON'],
  },
};
