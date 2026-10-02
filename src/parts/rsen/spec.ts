// EN 付きの RS ラッチ。EN が ON の間だけ S / R が効く (RS と同じくリセット優先)。OFF の間は値を保つ。
// EN で入力を通すゲートの後ろに RS ラッチを置いた構成なので 3 段

import { definePart } from '../spec';

export const rsen = definePart({
  kind: 'RSEN',
  shape: 'flipflop',
  inputs: ['S', 'EN', 'R'],
  delay: 3,
  next: ([set, en, reset], s) => {
    if (!en) {
      return { q: s.q, clk: false };
    }
    return { q: reset ? false : set ? true : s.q, clk: false };
  },
});
