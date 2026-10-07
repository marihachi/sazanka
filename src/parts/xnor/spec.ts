// XNOR ゲート。NOR 4 個で組んだ 3 段 (XOR と同じ段数)

import { definePart } from '../spec';

export const xnor = definePart({
  kind: 'xnor',
  shape: 'gate',
  inputs: ['', ''],
  delay: 3,
  output: ([a, b]) => a === b,
});
