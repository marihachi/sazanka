import type { PartLayoutOf } from '../layout';

/**
 * モジュール。幅 4 マスで、本体の上に名前を書く。
 * ピンは左右とも上から 1 マスおき (1, 2, 3… マスめ) に並ぶので、高さは多い方のピンの数 + 1 マスにする。
 * 例: ピンが 3 本なら、ピンは 1, 2, 3 マスめで、高さは 4 マス
 */
export const module: PartLayoutOf = (pins) => ({
  w: 4,
  h: Math.max(pins.inputs.length, pins.outputs.length, 1) + 1,
  body: 'rect',
  inputs: pins.inputs.map((_, i) => ({ side: 'left', at: i + 1 })),
  outputs: pins.outputs.map((_, i) => ({ side: 'right', at: i + 1 })),
  nameAbove: true,
});
