import type { PartLayout, PartLayoutOf, PinPlacement } from '../layout';
import type { Pinout } from '../../circuit/module';

/** モジュール。配置はモジュールの形 (pinout.package) で決まる */
export const module: PartLayoutOf = (pinout) => {
  const pkg = pinout.package;
  if (pkg?.kind === 'dip' && pinout.pinNumbers) {
    return makeDipLayout(pinout.pinNumbers, pkg.pins);
  }
  if (pkg?.kind === 'qfp' && pinout.pinNumbers) {
    return makeQfpLayout(pinout.pinNumbers, pkg.pins);
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
  return {
    w: 3,
    h: (half - 1) * 2 + 2,
    body: 'rect',
    inputs: numbers.inputs.map(place),
    outputs: numbers.outputs.map(place),
    nameAbove: true,
    nc: unassignedPins(numbers, pins).map(place),
    directionMarks: true,
  };
}

/**
 * 形 qfp。本体は正方形で、名前は本体の中に書く (上の辺にもピンがあるため)。ピンは 4 辺に、2 マスおきに pins / 4 本ずつ並ぶ。
 * 番号は実際の IC と同じく、左上の 1 番から反時計回り: 左の辺を上から下へ、下の辺を左から右へ、右の辺を下から上へ、上の辺を右から左へ。
 * 角から 2 マスあけて置く。1 マスだと、角で左右のピン名と上下の縦書きのピン名が重なるため。
 * 1 辺は (pins / 4 - 1) × 2 + 4 マス。例: 8 ピンなら 1 辺 6 マスで、左は 1, 2 番 (2, 4 マスめ)、下は 3, 4 番 (左から 2, 4 マスめ)、
 * 右は下から 5, 6 番 (4, 2 マスめ)、上は右から 7, 8 番 (4, 2 マスめ)
 */
function makeQfpLayout(numbers: { inputs: number[]; outputs: number[] }, pins: number): PartLayout {
  const quarter = pins / 4;
  const side = (quarter - 1) * 2 + 4;
  const place = (n: number): PinPlacement => {
    // k は、その辺の中で番号の順に数えて何本めか (0 から)
    const k = (n - 1) % quarter;
    const forward = 2 + k * 2;
    const backward = side - 2 - k * 2;
    if (n <= quarter) {
      return { side: 'left', at: forward, number: n };
    }
    if (n <= quarter * 2) {
      return { side: 'bottom', at: forward, number: n };
    }
    if (n <= quarter * 3) {
      return { side: 'right', at: backward, number: n };
    }
    return { side: 'top', at: backward, number: n };
  };
  return {
    w: side,
    h: side,
    body: 'rect',
    inputs: numbers.inputs.map(place),
    outputs: numbers.outputs.map(place),
    nameAbove: false,
    nc: unassignedPins(numbers, pins).map(place),
    directionMarks: true,
  };
}

/** どのポートにも割り当てていない番号 (NC)。1 から pins までのうち、numbers にない番号を小さい順に */
function unassignedPins(numbers: { inputs: number[]; outputs: number[] }, pins: number): number[] {
  const used = new Set([...numbers.inputs, ...numbers.outputs]);
  return Array.from({ length: pins }, (_, i) => i + 1).filter((n) => !used.has(n));
}
