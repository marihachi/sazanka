// 部品のデータと、置ける部品の種類と、種類ごとのピンと遅延を引く入口。
// 部品の種類の一覧と、種類ごとの仕様は parts/ にあり、ここではそれを引くだけにする。
// parts/ の仕様の形で書けない特別な部品 (INPUT、OUTPUT、CLOCK、モジュール、BUF) のピンと遅延は、ここに書く。
// 部品を並べた回路は circuit.ts、モジュールのピンは module.ts にある

import { isObject } from '../util';
import { isSpecialKind, type SpecKind, partSpecOf, type SpecialKind } from '../parts/specs';

export type { FlipFlopKind, GateKind, SpecialKind } from '../parts/specs';

/** 部品 */
export interface Part {
  id: string;
  kind: PartKind;
  x: number;
  y: number;
  /** INPUT / CLOCK の出力状態 */
  on?: boolean;
  /** INPUT / OUTPUT のラベル (モジュールのピン名になる) */
  label?: string;
  /** モジュールが参照する回路定義の ID */
  module?: string;
  /** CLOCK が ON/OFF を一往復する tick 数。なければ DEFAULT_CLOCK_PERIOD */
  period?: number;
  /**
   * モジュールの中の INPUT / OUTPUT の、外側のピン番号 (1 から)。
   * モジュールのパッケージが dip / qfp のときだけ使う。範囲外や重なりがあっても読み込みは断らない
   */
  pinNumber?: number;
  /**
   * INPUT / OUTPUT を見分ける番号 (ポート番号。1 から)。入力と出力で別々に振る。
   * メイン回路とモジュールの回路のどちらでも持つ。読み込みでは、ないものや重なるものを付け直す (module.ts の fillPortNumbers)
   */
  portNumber?: number;
}

export function isPart(c: unknown): c is Part {
  return (
    isObject(c) &&
    typeof c.id === 'string' &&
    typeof c.kind === 'string' &&
    isPlaceablePartKind(c.kind) &&
    typeof c.x === 'number' &&
    typeof c.y === 'number' &&
    (c.period === undefined || isClockPeriod(c.period)) &&
    (c.pinNumber === undefined || Number.isInteger(c.pinNumber)) &&
    (c.portNumber === undefined || isPortNumber(c.portNumber))
  );
}

/** ポート番号として使える値か (1 以上の整数) */
export function isPortNumber(n: unknown): n is number {
  return Number.isInteger(n) && (n as number) >= 1;
}

/**
 * BUF: 入力をそのまま出力する。展開したモジュールのピンに使う内部用の部品
 */
export type PartKind = PlaceablePartKind | 'buf';

/**
 * 利用者が回路に置ける部品の種類。
 * 保存データや共有データに現れるのはこれだけ。
 */
export type PlaceablePartKind = SpecKind | SpecialKind;

function isPlaceablePartKind(kind: string): kind is PlaceablePartKind {
  return partSpecOf(kind) !== undefined || isSpecialKind(kind);
}

/** 記憶素子 (ラッチとフリップフロップ) か */
export function isFlipFlopKind(kind: PartKind): boolean {
  return partSpecOf(kind)?.behavior === 'flipFlop';
}

// 入力ピン

/** 入力ピンの名前 (表示用)。名前のないピンは空文字。並び順がピン番号 */
export function inputPinNames(kind: PartKind): string[] {
  const spec = partSpecOf(kind);
  if (spec) {
    return [...spec.inputs];
  }
  switch (kind) {
    case 'output':
    case 'buf':
      return [''];
    // モジュールのピン数は中身の回路で決まる (module.ts の getPinout)。
    // シミュレーションでは展開してから数えるので、ここでは 0 でよい
    default:
      return [];
  }
}

export function inputCount(kind: PartKind): number {
  return inputPinNames(kind).length;
}

// 出力ピン

export function outputPinNames(kind: PartKind): string[] {
  if (isFlipFlopKind(kind)) {
    return ['Q', 'Q̄'];
  }
  return Array(outputCount(kind)).fill('');
}

export function outputCount(kind: PartKind): number {
  if (kind === 'output' || kind === 'module') {
    return 0;
  }
  return isFlipFlopKind(kind) ? 2 : 1; // フリップフロップは Q, Q̄
}

// 部品の遅延

/**
 * 部品の遅延 (何 tick 後に出力へ現れるか)。種類ごとの値は parts/ の仕様にある。
 * 特別な部品は遅延なし (0)。部品ではなく端子である INPUT / CLOCK / OUTPUT と、
 * モジュールのピンを表す内部用の BUF (モジュールにしただけで遅れないようにするため)
 */
export function delayOf(kind: PartKind): number {
  return partSpecOf(kind)?.delay ?? 0;
}

// CLOCK

/** CLOCK の周期 (一往復の tick 数) の既定値と、設定できる範囲 */
export const DEFAULT_CLOCK_PERIOD = 100;
export const MIN_CLOCK_PERIOD = 2;
export const MAX_CLOCK_PERIOD = 10000;

/** CLOCK の周期として有効な値か */
export function isClockPeriod(v: unknown): v is number {
  return (
    Number.isInteger(v) && (v as number) >= MIN_CLOCK_PERIOD && (v as number) <= MAX_CLOCK_PERIOD
  );
}

/** CLOCK の周期 (一往復の tick 数) */
export function clockPeriodOf(c: Part): number {
  return c.period ?? DEFAULT_CLOCK_PERIOD;
}

/**
 * CLOCK が、時刻 tick の時点で ON/OFF を切り替えるか。
 * 前半の半周期は OFF、後半は ON。周期が奇数なら、ON と OFF の長さは 1 tick 違う
 */
export function clockFlipsAt(c: Part, tick: number): boolean {
  const period = clockPeriodOf(c);
  // floor(tick * 2 / period) は、時刻 tick が何番目の半周期か。番号が前の tick から変わったら反転する
  return Math.floor((tick * 2) / period) !== Math.floor(((tick - 1) * 2) / period);
}
