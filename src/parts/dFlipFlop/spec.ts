// D フリップフロップ。CLK の立ち上がりで D を取り込む

import { definePart, onRisingEdge } from '../spec';

export const dFlipFlop = definePart({
  kind: 'dFlipFlop',
  shape: 'flipflop',
  inputs: ['D', '>'],
  delay: 3,
  next: (ins, s) => onRisingEdge(ins, s, () => ins[0]),
});
