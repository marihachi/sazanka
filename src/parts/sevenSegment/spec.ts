// 7 セグメントディスプレイ (1 桁)。入力ピンの値で、セグメント a〜g と小数点 DP を光らせる。
// 表示するだけの部品なので、出力ピンも遅延もない

import { definePart } from '../spec';

export const sevenSegment = definePart({
  kind: 'sevenSegment',
  behavior: 'display',
  inputs: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'DP'],
  delay: 0,
});
