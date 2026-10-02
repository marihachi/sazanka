// 部品の種類の一覧と、種類ごとの仕様を引く入口。
// 種類を足すときは、このフォルダに種類のフォルダ (spec.ts、view.ts、icon.svg) を足し、PARTS と views.ts の PART_VIEWS に並べる。
// 仕様の形で書けない特別な部品も、種類の名前だけはここに置く (ピンと遅延は circuit/component.ts)

import type { SetElement } from '../util';
import { and } from './and/spec';
import { dff } from './dff/spec';
import { dlatch } from './dlatch/spec';
import { high } from './high/spec';
import { jkff } from './jkff/spec';
import { nand } from './nand/spec';
import { nor } from './nor/spec';
import { not } from './not/spec';
import { or } from './or/spec';
import { rs } from './rs/spec';
import { rsen } from './rsen/spec';
import type { PartSpec } from './spec';
import { tff } from './tff/spec';
import { xnor } from './xnor/spec';
import { xor } from './xor/spec';

export const PARTS = [high, and, or, not, nand, nor, xor, xnor, rs, rsen, dlatch, dff, tff, jkff];

type Part = (typeof PARTS)[number];

/** 仕様の一覧にある部品の種類 */
export type PartKind = Part['kind'];

/** 論理ゲート */
export type GateKind = Extract<Part, { shape: 'gate' }>['kind'];

/**
 * 記憶素子。
 * RS、RSEN、DLATCH はCLKのないラッチ (入力の ON/OFF の状態で動く)、
 * ほかはCLKの立ち上がりの瞬間だけ動くフリップフロップ
 */
export type FlipFlopKind = Extract<Part, { shape: 'flipflop' }>['kind'];

const BY_KIND = new Map<string, PartSpec>(PARTS.map((p) => [p.kind, p]));

/** 種類の仕様。一覧にない種類 (特別な部品) なら undefined */
export function partSpecOf(kind: string): PartSpec | undefined {
  return BY_KIND.get(kind);
}

/**
 * 特別な部品。モジュールのピン、時間での切り替え、展開など、ほかの処理が種類の名前で扱うので、
 * 仕様の形では書けない
 *
 * CUSTOM: モジュール。シミュレーション前に展開される
 */
const SPECIAL_KINDS = new Set([
  'INPUT',
  'OUTPUT',
  'CLOCK',
  'CUSTOM',
  // NOTE: BUFは展開用の内部の部品なので含めない
] as const);

export type SpecialKind = SetElement<typeof SPECIAL_KINDS>;

export function isSpecialKind(kind: string): kind is SpecialKind {
  return (SPECIAL_KINDS as Set<string>).has(kind);
}
