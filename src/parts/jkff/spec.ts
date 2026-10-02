// JK フリップフロップ。CLK の立ち上がりで、J で ON、K で OFF、両方 ON なら反転する

import { definePart, onRisingEdge } from '../spec';

export const jkff = definePart({
  kind: 'JKFF',
  shape: 'flipflop',
  inputs: ['J', '>', 'K'],
  delay: 3,
  next: (ins, s) =>
    onRisingEdge(ins, s, () => {
      const [j, , k] = ins;
      return j && k ? !s.q : j ? true : k ? false : s.q;
    }),
});
