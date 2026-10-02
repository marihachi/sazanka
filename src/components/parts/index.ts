// 部品をコンポーネントをまたいで扱うための情報。パレット、シート、シート上の部品、プロパティ欄で共有する。
// 部品の種類ごとの見せ方の一覧 (種類を足すときは、このフォルダにファイルを足して PART_VIEWS に並べる) と、
// パレットからシートへのドラッグの受け渡し
import type { ComponentKind } from '../../engine/component';
import type { PartKind } from '../../engine/parts';
import { and } from './and';
import { dff } from './dff';
import { dlatch } from './dlatch';
import { high } from './high';
import { jkff } from './jkff';
import { nand } from './nand';
import { nor } from './nor';
import { not } from './not';
import { or } from './or';
import { rs } from './rs';
import { rsen } from './rsen';
import type { PartView } from './spec';
import { tff } from './tff';
import { xnor } from './xnor';
import { xor } from './xor';

export type { PaletteGroupId, PartView } from './spec';

/**
 * engine/parts/ の種類ごとの見せ方。種類が欠けると型エラーになる。
 * 並び順が、パレットのグループの中での並び順になる
 */
export const PART_VIEWS: Record<PartKind, PartView> = {
  AND: and,
  OR: or,
  NOT: not,
  NAND: nand,
  NOR: nor,
  XOR: xor,
  XNOR: xnor,
  HIGH: high,
  RS: rs,
  RSEN: rsen,
  DLATCH: dlatch,
  DFF: dff,
  TFF: tff,
  JKFF: jkff,
};

/** 種類の見せ方。特別な部品 (INPUT、OUTPUT、CLOCK、モジュール、BUF) なら undefined */
export function partViewOf(kind: ComponentKind): PartView | undefined {
  return (PART_VIEWS as Partial<Record<ComponentKind, PartView>>)[kind];
}

/** 部品の表示名。特別な部品は種類の名前のまま */
export function labelOf(kind: ComponentKind): string {
  return partViewOf(kind)?.label ?? kind;
}

/** パレットからシートへドラッグするときの dataTransfer の型 */
export const DRAG_MIME = 'application/x-sazanka-part';

export interface PaletteDrag {
  kind: ComponentKind;
  custom?: string;
}
