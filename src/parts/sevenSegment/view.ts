import icon from './icon.svg';
import type { PartView } from '../view';

export const sevenSegment: PartView = {
  label: { ja: '7セグ' },
  icon,
  group: 'device',
  description: { ja: '1 桁の 7 セグメントディスプレイ。入力が ON のセグメントが光る' },
  hints: {
    ja: ['a〜g はセグメント、DP は小数点。入力が ON のものが光る'],
  },
};
