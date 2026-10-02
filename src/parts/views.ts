// 部品の種類ごとの見せ方の一覧と、見せ方を引く入口。パレット、シート、シート上の部品、プロパティ欄、ヒントで使う。
// 種類を足すときは、このフォルダに種類のフォルダを足して PART_VIEWS に並べる (仕様の一覧は specs.ts)
import { and } from './and/view';
import { clock } from './clock/view';
import { dff } from './dff/view';
import { dlatch } from './dlatch/view';
import { high } from './high/view';
import { input } from './input/view';
import { jkff } from './jkff/view';
import { module } from './module/view';
import { nand } from './nand/view';
import { nor } from './nor/view';
import { not } from './not/view';
import { or } from './or/view';
import { output } from './output/view';
import { rs } from './rs/view';
import { rsen } from './rsen/view';
import type { PartKind, SpecialKind } from './specs';
import type { PartView } from './view';
import { tff } from './tff/view';
import { xnor } from './xnor/view';
import { xor } from './xor/view';

export type { HintContext, PaletteGroupId, PartView } from './view';

/**
 * 利用者が置ける種類 (仕様の一覧 PARTS の種類と、特別な部品) ごとの見せ方。種類が欠けると型エラーになる。
 * 並び順が、パレットのグループの中での並び順になる
 */
export const PART_VIEWS: Record<PartKind | SpecialKind, PartView> = {
  INPUT: input,
  OUTPUT: output,
  CLOCK: clock,
  HIGH: high,
  AND: and,
  OR: or,
  NOT: not,
  NAND: nand,
  NOR: nor,
  XOR: xor,
  XNOR: xnor,
  RS: rs,
  RSEN: rsen,
  DLATCH: dlatch,
  DFF: dff,
  TFF: tff,
  JKFF: jkff,
  CUSTOM: module,
};

/** 種類の見せ方。内部用の BUF なら undefined */
export function partViewOf(kind: string): PartView | undefined {
  return (PART_VIEWS as Partial<Record<string, PartView>>)[kind];
}

/** 部品の表示名。見せ方のない種類 (BUF) は種類の名前のまま */
export function labelOf(kind: string): string {
  return partViewOf(kind)?.label ?? kind;
}
