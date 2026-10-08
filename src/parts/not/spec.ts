// NOT ゲート。1 入力

import { definePart } from '../spec';

export const not = definePart({
  kind: 'not',
  behavior: 'logic',
  inputs: [''],
  delay: 1,
  output: ([a]) => !a,
});
