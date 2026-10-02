// RS ラッチ。クロックはなく入力にすぐ反応する。S=R=1 はリセット優先。
// NOR をたすきに組んだ構成なので 2 段

import { definePart } from '../spec';

export const rs = definePart({
  kind: 'RS',
  shape: 'flipflop',
  inputs: ['S', 'R'],
  delay: 2,
  next: ([set, reset], s) => ({ q: reset ? false : set ? true : s.q, clk: false }),
});
