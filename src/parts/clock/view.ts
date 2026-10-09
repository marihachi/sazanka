import icon from './icon.svg';
import type { PartView } from '../view';

export const clock: PartView = {
  label: 'CLOCK',
  icon,
  group: 'source',
  description: { ja: '一定の周期で ON/OFF を繰り返す' },
  hints: {
    ja: ({ period, tickMs }) => [
      `${period} tick (${(period * tickMs) / 1000} 秒) 周期で ON/OFF を繰り返す。周期は右のプロパティ欄で変えられる`,
    ],
  },
};
