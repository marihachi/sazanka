import icon from './icon.svg';
import type { PartView } from '../view';

export const sevenSegment: PartView = {
  label: { ja: '7セグ', en: '7-Seg' },
  icon,
  group: 'device',
  description: {
    ja: '1 桁の 7 セグメントディスプレイ。入力が ON のセグメントが光る',
    en: 'A 1-digit 7-segment display. Segments whose input is ON light up',
  },
  hints: {
    ja: ['a〜g はセグメント、DP は小数点。入力が ON のものが光る'],
    en: ['a–g are segments, DP is the decimal point. Those whose input is ON light up'],
  },
};
