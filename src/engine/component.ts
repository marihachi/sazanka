// 部品のデータと、部品の種類の一覧と、種類ごとのピンと遅延を引く入口。
// ゲートや記憶素子などの種類ごとの仕様は parts/ に 1 種類 1 ファイルで置き、ここではそれを引くだけにする。
// parts/ に書けない特別な部品 (INPUT、OUTPUT、CLOCK、モジュール、BUF) の仕様は、ここに書く。
// 部品を並べた回路は circuit.ts、モジュールのピンは module.ts にある

import { isObject, type SetElement } from '../util';
import { type PartKind, partSpecOf } from './parts';

export type { FlipFlopKind, GateKind } from './parts';

/** 部品 */
export interface Component {
  id: string;
  kind: ComponentKind;
  x: number;
  y: number;
  /** INPUT / CLOCK の出力状態 */
  on?: boolean;
  /** INPUT / OUTPUT のラベル (モジュールのピン名になる) */
  label?: string;
  /** CUSTOM が参照する回路定義の ID */
  custom?: string;
  /** CLOCK が ON/OFF を一往復する tick 数。なければ DEFAULT_CLOCK_PERIOD */
  period?: number;
}

export function isComponent(c: unknown): c is Component {
  return (
    isObject(c) &&
    typeof c.id === 'string' &&
    typeof c.kind === 'string' &&
    isPlaceableComponentKind(c.kind) &&
    typeof c.x === 'number' &&
    typeof c.y === 'number' &&
    (c.period === undefined || isClockPeriod(c.period))
  );
}

/**
 * BUF: 入力をそのまま出力する。展開したモジュールのピンに使う内部用の部品
 */
export type ComponentKind = PlaceableComponentKind | 'BUF';

/**
 * 利用者が回路に置ける部品の種類。
 * 保存データや共有データに現れるのはこれだけ。
 */
export type PlaceableComponentKind = PartKind | SpecialKind;

function isPlaceableComponentKind(kind: string): kind is PlaceableComponentKind {
  return partSpecOf(kind) !== undefined || isSpecialKind(kind);
}

/**
 * 特別な部品。モジュールのピン、時間での切り替え、展開など、ほかの処理が種類の名前で扱うので、
 * parts/ の仕様の形では書けない
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

/** 記憶素子 (ラッチとフリップフロップ) か */
export function isFlipFlopKind(kind: ComponentKind): boolean {
  return partSpecOf(kind)?.shape === 'flipflop';
}

// 入力ピン

/** 入力ピンの名前 (表示用)。名前のないピンは空文字。並び順がピン番号 */
export function inputPinNames(kind: ComponentKind): string[] {
  const spec = partSpecOf(kind);
  if (spec) {
    return [...spec.inputs];
  }
  switch (kind) {
    case 'OUTPUT':
    case 'BUF':
      return [''];
    // モジュールのピン数は中身の回路で決まる (module.ts の portsOf)。
    // シミュレーションでは展開してから数えるので、ここでは 0 でよい
    default:
      return [];
  }
}

export function inputCount(kind: ComponentKind): number {
  return inputPinNames(kind).length;
}

// 出力ピン

export function outputPinNames(kind: ComponentKind): string[] {
  if (isFlipFlopKind(kind)) {
    return ['Q', 'Q̄'];
  }
  return Array(outputCount(kind)).fill('');
}

export function outputCount(kind: ComponentKind): number {
  if (kind === 'OUTPUT' || kind === 'CUSTOM') {
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
export function delayOf(kind: ComponentKind): number {
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
export function clockPeriodOf(c: Component): number {
  return c.period ?? DEFAULT_CLOCK_PERIOD;
}

/**
 * CLOCK が、時刻 tick の時点で ON/OFF を切り替えるか。
 * 前半の半周期は OFF、後半は ON。周期が奇数なら、ON と OFF の長さは 1 tick 違う
 */
export function clockFlipsAt(c: Component, tick: number): boolean {
  const period = clockPeriodOf(c);
  return Math.floor((tick * 2) / period) !== Math.floor(((tick - 1) * 2) / period);
}
