import icon from './icon.svg';
import type { PartView } from '../view';

export const high: PartView = {
  label: 'HIGH',
  bodyLabel: '1',
  icon,
  group: 'source',
  description: '常に ON を出力する',
  hints: ['常に ON を出力する。入力を固定したいときに使う'],
};
