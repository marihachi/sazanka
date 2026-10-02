// 部品の種類の仕様の一覧。種類を足すときは、このフォルダにファイルを足して PARTS に並べる。
// 一覧から外れる特別な部品 (INPUT、OUTPUT、CLOCK、モジュール、BUF) は component.ts にある

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
import type { PartSpec } from './spec';
import { tff } from './tff';
import { xnor } from './xnor';
import { xor } from './xor';

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
