// D ラッチ。EN が ON の間は Q が D に追従し、OFF の間は値を保つ。
// EN で入力を通すゲートの後ろに RS ラッチを置いた構成なので 3 段

import { definePart } from '../spec';

export const dLatch = definePart({
  kind: 'dLatch',
  behavior: 'flipFlop',
  inputs: ['D', 'EN'],
  delay: 3,
  next: ([d, en], s) => ({ q: en ? d : s.q, clk: false }),
});
