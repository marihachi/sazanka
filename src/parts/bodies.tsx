// 本体の中の描き込みを、種類のフォルダ (<種類>/Body.tsx) に置く種類の一覧。シート上の部品 (sheet/SheetPart.tsx) が引いて描く。
// デバイス (7 セグメントなど) は描くものが大きく種類ごとに違うので、SheetPart.tsx の種類ごとの分け方に足さず、ここに並べる。
// 前からある部品 (INPUT のスイッチ、OUTPUT のランプなど) の描き込みは、SheetPart.tsx にある

import type { ComponentType } from 'react';
import type { PartKind } from '../circuit/part';
import type { PartLayout } from './layout';
import { SevenSegmentBody } from './sevenSegment/Body';

export interface PartBodyProps {
  /** 本体の幅と高さ (px)。座標は本体の左上が原点 */
  w: number;
  h: number;
  /** 種類の配置。ピン名と重ならないよう、ピンのある辺を避けて描くのに使う */
  layout: PartLayout;
  /** 入力ピンの値 (ピン番号の順) */
  inputValues: boolean[];
}

export const PART_BODIES: Partial<Record<PartKind, ComponentType<PartBodyProps>>> = {
  sevenSegment: SevenSegmentBody,
};
