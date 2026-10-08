import type { PartLayoutOf } from '../layout';

/**
 * 7 セグメントディスプレイ。幅 5、高さ 8 マス。横に並べて桁を増やせるよう、ピンは上下の辺に置く。
 * 上の辺に a〜d、下の辺に e、f、g、DP を、左から 1 マスおきに並べる。名前は書かない (数字の形で分かるため)
 */
export const sevenSegment: PartLayoutOf = (pinout) => ({
  w: 5,
  h: 8,
  body: 'rect',
  inputs: pinout.inputs.map((_, i) =>
    i < 4 ? { side: 'top', at: i + 1 } : { side: 'bottom', at: i - 3 },
  ),
  outputs: [],
  nameAbove: false,
});
