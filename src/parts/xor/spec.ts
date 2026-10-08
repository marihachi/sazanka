// XOR ゲート。NAND 4 個で組んだ 3 段

import { definePart } from '../spec';

export const xor = definePart({
  kind: 'xor',
  behavior: 'logic',
  inputs: ['', ''],
  delay: 3,
  output: ([a, b]) => a !== b,
});
