// NOR ゲート。遅延の 1 段の基準

import { definePart } from '../spec';

export const nor = definePart({
  kind: 'nor',
  shape: 'gate',
  inputs: ['', ''],
  delay: 1,
  output: ([a, b]) => !(a || b),
});
