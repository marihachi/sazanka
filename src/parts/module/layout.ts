import type { PartLayout, PartLayoutOf } from '../layout';
import type { Pinout } from '../../circuit/module';

/**
 * モジュール。配置はピンの出し方 (pinout.footprint) で決まる。
 * dip / qfp の配置はまだないので、どの出し方でも split と同じに置く
 */
export const module: PartLayoutOf = (pinout) => splitLayout(pinout);

/**
 * 出し方 split (version 2 までの形)。幅 4 マスで、本体の上に名前を書く。
 * 入力は左、出力は右に、それぞれ上から 1 マスおき (1, 2, 3… マスめ) に並ぶので、高さは多い方のピンの数 + 1 マスにする。
 * 例: ピンが 3 本なら、ピンは 1, 2, 3 マスめで、高さは 4 マス
 */
function splitLayout(pinout: Pinout): PartLayout {
  return {
    w: 4,
    h: Math.max(pinout.inputs.length, pinout.outputs.length, 1) + 1,
    body: 'rect',
    inputs: pinout.inputs.map((_, i) => ({ side: 'left', at: i + 1 })),
    outputs: pinout.outputs.map((_, i) => ({ side: 'right', at: i + 1 })),
    nameAbove: true,
  };
}
