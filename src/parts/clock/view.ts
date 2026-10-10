import icon from './icon.svg';
import type { PartView } from '../view';

export const clock: PartView = {
  label: 'CLOCK',
  icon,
  group: 'source',
  description: {
    ja: '一定の周期で ON/OFF を繰り返す',
    en: 'Repeats ON/OFF at a fixed period',
  },
  hints: {
    ja: ({ period, periodSeconds }) => [
      `${period} tick (${periodSeconds} 秒) 周期で ON/OFF を繰り返す。周期は右のプロパティ欄で変えられる`,
    ],
    en: ({ period, periodSeconds }) => [
      `Repeats ON/OFF every ${period} ticks (${periodSeconds} s). Change the period in the properties panel on the right`,
    ],
  },
};
