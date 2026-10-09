import icon from './icon.svg';
import type { PartView } from '../view';

export const not: PartView = {
  label: 'NOT',
  icon,
  group: 'gate',
  description: {
    ja: '入力を反転する',
    en: 'Inverts the input',
  },
};
