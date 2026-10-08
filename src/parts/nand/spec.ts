// NAND ゲート。遅延の 1 段の基準

import { definePart } from '../spec';

export const nand = definePart({
  kind: 'nand',
  behavior: 'logic',
  inputs: ['', ''],
  delay: 1,
  output: ([a, b]) => !(a && b),
});
