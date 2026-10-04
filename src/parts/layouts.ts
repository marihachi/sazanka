// 部品の種類ごとの配置の一覧と、配置を引く入口。シート上の座標の計算 (geometry/layout.ts) とシート上の部品で使う。
// 既定と違う配置にする種類は、種類のフォルダに layout.ts を足して PART_LAYOUTS に並べる (書き方は layout.ts)

import { clock } from './clock/layout';
import { input } from './input/layout';
import {
  flipflopLayout,
  gateLayout,
  type PartLayout,
  type PartLayoutOf,
  type PinNames,
  terminalLayout,
} from './layout';
import { module } from './module/layout';
import { output } from './output/layout';
import { type PartKind, partSpecOf, type SpecialKind } from './specs';

/**
 * 既定と違う配置にする種類ごとの配置。
 * ここにない種類は、仕様の形 (shape) の既定の配置になる。特別な部品は仕様を持たないので、すべてここに置く
 */
const PART_LAYOUTS: Partial<Record<PartKind | SpecialKind, PartLayoutOf>> = {
  INPUT: input,
  OUTPUT: output,
  CLOCK: clock,
  CUSTOM: module,
};

/** 種類の配置。pins は部品のピンの名前 (circuit/module.ts の portsOf) */
export function layoutOf(kind: string, pins: PinNames): PartLayout {
  const own = (PART_LAYOUTS as Partial<Record<string, PartLayoutOf>>)[kind];
  if (own) {
    return own(pins);
  }
  switch (partSpecOf(kind)?.shape) {
    case 'flipflop':
      return flipflopLayout(pins);
    case 'terminal':
      return terminalLayout(pins);
    default:
      // ゲートと、仕様を持たない内部用の BUF
      return gateLayout(pins);
  }
}
