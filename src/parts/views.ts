// 部品の種類ごとの見せ方の一覧と、見せ方を引く入口。パレット、シート、シート上の部品、プロパティ欄、ヒントで使う。
// 種類を足すときは、このフォルダに種類のフォルダを足して PART_VIEWS に並べる (仕様の一覧は specs.ts)
import { and } from './and/view';
import { clock } from './clock/view';
import { dFlipFlop } from './dFlipFlop/view';
import { dLatch } from './dLatch/view';
import { high } from './high/view';
import { input } from './input/view';
import { jkFlipFlop } from './jkFlipFlop/view';
import { module } from './module/view';
import { nand } from './nand/view';
import { nor } from './nor/view';
import { not } from './not/view';
import { or } from './or/view';
import { output } from './output/view';
import { rsLatch } from './rsLatch/view';
import { rsEnLatch } from './rsEnLatch/view';
import { sevenSegment } from './sevenSegment/view';
import { type Language, getLocalText } from '../i18n/language';
import type { SpecKind, SpecialKind } from './specs';
import type { PartView } from './view';
import { tFlipFlop } from './tFlipFlop/view';
import { xnor } from './xnor/view';
import { xor } from './xor/view';

export type { HintContext, PaletteGroupId, PartView } from './view';

/**
 * 利用者が置ける種類 (仕様の一覧 PART_SPECS の種類と、特別な部品) ごとの見せ方。種類が欠けると型エラーになる。
 * 並び順が、パレットのグループの中での並び順になる
 */
export const PART_VIEWS: Record<SpecKind | SpecialKind, PartView> = {
  input: input,
  output: output,
  clock: clock,
  high: high,
  and: and,
  or: or,
  not: not,
  nand: nand,
  nor: nor,
  xor: xor,
  xnor: xnor,
  rsLatch: rsLatch,
  rsEnLatch: rsEnLatch,
  dLatch: dLatch,
  dFlipFlop: dFlipFlop,
  tFlipFlop: tFlipFlop,
  jkFlipFlop: jkFlipFlop,
  sevenSegment: sevenSegment,
  module: module,
};

/** 種類の見せ方。内部用の BUF なら undefined */
export function partViewOf(kind: string): PartView | undefined {
  return (PART_VIEWS as Partial<Record<string, PartView>>)[kind];
}

/** 部品の表示名。見せ方のない種類 (BUF) は種類の名前のまま */
export function labelOf(kind: string, lang: Language): string {
  const label = partViewOf(kind)?.label;
  return label === undefined ? kind : getLocalText(label, lang);
}
