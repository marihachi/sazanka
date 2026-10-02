// NOT ゲート。1 入力

import { definePart } from '../spec';

export const not = definePart({
  kind: 'NOT',
  shape: 'gate',
  inputs: [''],
  delay: 1,
  output: ([a]) => !a,
});
