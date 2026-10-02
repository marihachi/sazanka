// HIGH: 常に ON を出力する。部品ではなく端子なので遅延なし

import { definePart } from './spec';

export const high = definePart({
  kind: 'HIGH',
  shape: 'terminal',
  inputs: [],
  delay: 0,
  output: () => true,
});
