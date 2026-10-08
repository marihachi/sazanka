// 部品の種類の一覧と、種類ごとの仕様を引く入口。
// 種類を足すときは、このフォルダに種類のフォルダ (spec.ts、view.ts、icon.svg) を足し、PART_SPECS と views.ts の PART_VIEWS に並べる。
// 仕様の形で書けない特別な部品も、種類の名前だけはここに置く (ピンと遅延は circuit/part.ts)

import type { SetElement } from '../util';
import { and } from './and/spec';
import { dFlipFlop } from './dFlipFlop/spec';
import { dLatch } from './dLatch/spec';
import { high } from './high/spec';
import { jkFlipFlop } from './jkFlipFlop/spec';
import { nand } from './nand/spec';
import { nor } from './nor/spec';
import { not } from './not/spec';
import { or } from './or/spec';
import { rsLatch } from './rsLatch/spec';
import { rsEnLatch } from './rsEnLatch/spec';
import type { PartSpec } from './spec';
import { tFlipFlop } from './tFlipFlop/spec';
import { xnor } from './xnor/spec';
import { xor } from './xor/spec';

export const PART_SPECS = [
  high,
  and,
  or,
  not,
  nand,
  nor,
  xor,
  xnor,
  rsLatch,
  rsEnLatch,
  dLatch,
  dFlipFlop,
  tFlipFlop,
  jkFlipFlop,
];

type ListedSpec = (typeof PART_SPECS)[number];

/** 仕様の一覧にある部品の種類 */
export type SpecKind = ListedSpec['kind'];

/** 論理ゲート */
export type GateKind = Exclude<Extract<ListedSpec, { behavior: 'logic' }>['kind'], 'high'>;

/**
 * 記憶素子。
 * rsLatch、rsEnLatch、dLatch は CLK のないラッチ (入力の ON/OFF の状態で動く)、
 * ほかはCLKの立ち上がりの瞬間だけ動くフリップフロップ
 */
export type FlipFlopKind = Extract<ListedSpec, { behavior: 'flipFlop' }>['kind'];

const BY_KIND = new Map<string, PartSpec>(PART_SPECS.map((p) => [p.kind, p]));

/** 種類の仕様。一覧にない種類 (特別な部品) なら undefined */
export function partSpecOf(kind: string): PartSpec | undefined {
  return BY_KIND.get(kind);
}

/**
 * 特別な部品。モジュールのピン、時間での切り替え、展開など、ほかの処理が種類の名前で扱うので、
 * 仕様の形では書けない
 *
 * module: モジュール。シミュレーション前に展開される
 */
const SPECIAL_KINDS = new Set([
  'input',
  'output',
  'clock',
  'module',
  // NOTE: BUFは展開用の内部の部品なので含めない
] as const);

export type SpecialKind = SetElement<typeof SPECIAL_KINDS>;

export function isSpecialKind(kind: string): kind is SpecialKind {
  return (SPECIAL_KINDS as Set<string>).has(kind);
}
