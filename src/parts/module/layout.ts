import type { PartLayout, PartLayoutOf, PinPlacement } from '../layout';
import type { Pinout } from '../../circuit/module';

/**
 * モジュール。配置はモジュールの形 (pinout.package) で決まる。
 * qfp の配置はまだないので、split と同じに置く
 */
export const module: PartLayoutOf = (pinout) => {
  const pkg = pinout.package;
  if (pkg?.kind === 'dip' && pinout.pinNumbers) {
    return makeDipLayout(pinout.pinNumbers, pkg.pins);
  }
  return makeSplitLayout(pinout);
};

/**
 * 形 split (version 2 までの形)。幅 4 マスで、本体の上に名前を書く。
 * 入力は左、出力は右に、それぞれ上から 1 マスおき (1, 2, 3… マスめ) に並ぶので、高さは多い方のピンの数 + 1 マスにする。
 * 例: ピンが 3 本なら、ピンは 1, 2, 3 マスめで、高さは 4 マス
 */
function makeSplitLayout(pinout: Pinout): PartLayout {
  return {
    w: 4,
    h: Math.max(pinout.inputs.length, pinout.outputs.length, 1) + 1,
    body: 'rect',
    inputs: pinout.inputs.map((_, i) => ({ side: 'left', at: i + 1 })),
    outputs: pinout.outputs.map((_, i) => ({ side: 'right', at: i + 1 })),
    nameAbove: true,
  };
}

/**
 * 形 dip。幅 3 マスで、本体の上に名前を書く。ピンは左右の 2 辺に、2 マスおきに pins / 2 本ずつ並ぶ。
 * 番号は実際の IC と同じく、左上の 1 番から反時計回り: 左の辺を上から下へ 1〜pins/2、右の辺を下から上へ pins/2+1〜pins。
 * 高さは (pins / 2 - 1) × 2 + 2 マス。例: 8 ピンなら左は 1〜4 番 (1, 3, 5, 7 マスめ)、右は下から 5〜8 番、高さは 8 マス
 */
function makeDipLayout(numbers: { inputs: number[]; outputs: number[] }, pins: number): PartLayout {
  const half = pins / 2;
  const place = (n: number): PinPlacement =>
    n <= half
      ? { side: 'left', at: 1 + (n - 1) * 2, number: n }
      : { side: 'right', at: 1 + (pins - n) * 2, number: n };
  const used = new Set([...numbers.inputs, ...numbers.outputs]);
  const nc: PinPlacement[] = [];
  for (let n = 1; n <= pins; n++) {
    if (!used.has(n)) {
      nc.push(place(n));
    }
  }
  return {
    w: 3,
    h: (half - 1) * 2 + 2,
    body: 'rect',
    inputs: numbers.inputs.map(place),
    outputs: numbers.outputs.map(place),
    nameAbove: true,
    nc,
    directionMarks: true,
  };
}
