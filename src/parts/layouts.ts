// 部品の種類ごとの配置の一覧と、配置を引く入口。シート上の座標の計算 (geometry/layout.ts) とシート上の部品で使う。
// 既定と違う配置にする種類は、種類のフォルダに layout.ts を足して PART_LAYOUTS に並べる (書き方は layout.ts)

import { clock } from './clock/layout';
import { input } from './input/layout';
import { high } from './high/layout';
import { flipflopLayout, gateLayout, type PartLayout, type PartLayoutOf } from './layout';
import { module } from './module/layout';
import { output } from './output/layout';
import { sevenSegment } from './sevenSegment/layout';
import type { Pinout } from '../circuit/module';
import { type SpecKind, partSpecOf, type SpecialKind } from './specs';

/**
 * 既定と違う配置にする種類ごとの配置。
 * ここにない種類は、仕様の動作の分類 (behavior) の既定の配置になる。特別な部品は仕様を持たないので、すべてここに置く
 */
const PART_LAYOUTS: Partial<Record<SpecKind | SpecialKind, PartLayoutOf>> = {
  high: high,
  input: input,
  output: output,
  clock: clock,
  module: module,
  sevenSegment: sevenSegment,
};

/** 種類の配置。pinout は部品のピンの割り当て (circuit/module.ts の getPinout) */
export function getLayout(kind: string, pinout: Pinout): PartLayout {
  const own = (PART_LAYOUTS as Partial<Record<string, PartLayoutOf>>)[kind];
  if (own) {
    return own(pinout);
  }
  switch (partSpecOf(kind)?.behavior) {
    case 'flipFlop':
      return flipflopLayout(pinout);
    default:
      // ゲートと、仕様を持たない内部用の BUF
      return gateLayout(pinout);
  }
}
