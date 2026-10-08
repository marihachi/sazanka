// T フリップフロップ。CLK の立ち上がりで、T が ON なら反転する

import { definePart, onRisingEdge } from '../spec';

export const tFlipFlop = definePart({
  kind: 'tFlipFlop',
  behavior: 'flipFlop',
  inputs: ['T', '>'],
  delay: 3,
  next: (ins, s) => onRisingEdge(ins, s, () => (ins[0] ? !s.q : s.q)),
});
