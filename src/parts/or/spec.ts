// OR ゲート。NOR を反転した 2 段

import { definePart } from '../spec';

export const or = definePart({
  kind: 'or',
  behavior: 'logic',
  inputs: ['', ''],
  delay: 2,
  output: ([a, b]) => a || b,
});
