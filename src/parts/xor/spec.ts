// XOR ゲート。NAND 4 個で組んだ 3 段

import { definePart } from '../spec';

export const xor = definePart({
  kind: 'XOR',
  shape: 'gate',
  inputs: ['', ''],
  delay: 3,
  output: ([a, b]) => a !== b,
});
