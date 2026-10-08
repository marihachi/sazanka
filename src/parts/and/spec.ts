// AND ゲート。NAND を反転した 2 段

import { definePart } from '../spec';

export const and = definePart({
  kind: 'and',
  behavior: 'logic',
  inputs: ['', ''],
  delay: 2,
  output: ([a, b]) => a && b,
});
