import type { PartLayoutOf } from '../layout';

/**
 * 7 セグメントディスプレイ。入力ピン (a〜g、DP) は下の辺に 1 マスおき。
 * 大きさとピンの間隔は仮 (計画の段階 2 で、プレビューを見て決める)
 */
export const sevenSegment: PartLayoutOf = (pinout) => ({
  w: 9,
  h: 6,
  body: 'rect',
  inputs: pinout.inputs.map((_, i) => ({ side: 'bottom', at: i + 1 })),
  outputs: [],
  nameAbove: true,
});
