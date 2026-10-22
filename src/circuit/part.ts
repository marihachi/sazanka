// 部品のデータと、置ける部品の種類と、種類ごとのピンと遅延を引く入口。
// 部品の種類の一覧と、種類ごとの仕様は parts/ にあり、ここではそれを引くだけにする。
// parts/ の仕様の形で書けない特別な部品 (INPUT、OUTPUT、CLOCK、モジュール、BUF) のピンと遅延は、ここに書く。
// 部品を並べた回路は circuit.ts、モジュールのピンは module.ts にある

import { isObject } from '../util';
import { isSpecialKind, type SpecKind, partSpecOf, type SpecialKind } from '../parts/specs';
import { ROTATIONS, type Rotation } from '../parts/layout';

export type { FlipFlopKind, GateKind, SpecialKind } from '../parts/specs';

/** 部品 */
export interface Part {
  id: string;
  kind: PartKind;
  x: number;
  y: number;
  /** INPUT / CLOCK の出力状態 */
  on?: boolean;
  /** INPUT / OUTPUT のポート名 (モジュールのピン名になる) */
  portName?: string;
  /** モジュールの部品が指している回路の ID (どの回路をモジュールとして置いたか) */
  circuitId?: string;
  /**
   * 指している回路の名前の写し。指す回路がプロジェクトにない (見つからない) モジュールの部品だけが持つ。
   * 指す回路があるときは回路の名前を使うので持たせない (改名のたびに書き換えずに済むように)。
   * 読み込んだときに指す回路がなかった部品と、指す回路をプロジェクトから削除した部品に付ける
   */
  circuitName?: string;
  /**
   * 指している回路をモジュールとして置いたときの、本体の大きさの写し (マス、回していない向き)。circuitName と同じく、
   * 見つからないモジュールの部品だけが持ち、元の大きさの箱で描くのに使う
   */
  circuitSize?: CircuitSize;
  /** CLOCK が ON/OFF を一往復する tick 数。なければ DEFAULT_CLOCK_PERIOD */
  period?: number;
  /**
   * 回路の中の INPUT / OUTPUT の、モジュールとして置いたときの外側のピン番号 (1 から)。
   * 回路のパッケージが dip / qfp のときだけ使う。範囲外や重なりがあっても読み込みは断らない
   */
  pinNumber?: number;
  /**
   * INPUT / OUTPUT を見分ける番号 (ポート番号。1 から)。入力と出力で別々に振る。
   * メイン回路とほかの回路のどちらでも持つ。読み込んだデータと、アプリで置いたポートには必ずあり、入力どうし・出力どうしで重ならない。
   * 型で省略できるのは、テストで部品を手短に作れるようにするため
   */
  portNumber?: number;
  /**
   * 部品の向き。種類の配置から時計回りに回した角度。なければ 0 (回していない)。
   * 0 のときは持たせない (保存データに書かないため)
   */
  rotation?: Rotation;
}

/**
 * 保存データ (回路の形式) の部品として正しい形か。
 * ID は保存しないので見ない (あっても読み込むときに捨てる)。位置はマス単位なので整数。
 * INPUT / OUTPUT のポート番号、CLOCK の周期、モジュールの部品の circuitId と名前の写し circuitName と大きさの写し circuitSize は省略できない
 * (省略したときの意味を既定値にすると、既定値を変えたときに古いデータの意味が変わるため)
 */
export function isPart(c: unknown): boolean {
  if (!isObject(c) || typeof c.kind !== 'string' || !isPlaceablePartKind(c.kind)) {
    return false;
  }
  const isPort = c.kind === 'input' || c.kind === 'output';
  return (
    // 保存データの位置はマス単位なので、整数でなければならない
    Number.isInteger(c.x) &&
    Number.isInteger(c.y) &&
    (c.kind === 'clock'
      ? isClockPeriod(c.period)
      : c.period === undefined || isClockPeriod(c.period)) &&
    (c.pinNumber === undefined || Number.isInteger(c.pinNumber)) &&
    (isPort
      ? isPortNumber(c.portNumber)
      : c.portNumber === undefined || isPortNumber(c.portNumber)) &&
    (c.kind !== 'module' ||
      (typeof c.circuitId === 'string' &&
        typeof c.circuitName === 'string' &&
        isCircuitSize(c.circuitSize))) &&
    (c.rotation === undefined || isRotation(c.rotation))
  );
}

/** 回路をモジュールとして置いたときの本体の大きさ (マス) */
export interface CircuitSize {
  width: number;
  height: number;
}

/** 本体の大きさの写しとして正しい形か (幅と高さが 1 以上の整数) */
export function isCircuitSize(v: unknown): v is CircuitSize {
  return (
    isObject(v) &&
    Number.isInteger(v.width) &&
    (v.width as number) >= 1 &&
    Number.isInteger(v.height) &&
    (v.height as number) >= 1
  );
}

/** 部品の向きとして使える値か (0 / 90 / 180 / 270) */
function isRotation(v: unknown): v is Rotation {
  return ROTATIONS.includes(v as Rotation);
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

/** 表示するだけの部品 (7 セグメントディスプレイなど) か。出力ピンがなく、シミュレーションでは何も求めない */
export function isDisplayKind(kind: PartKind): boolean {
  return partSpecOf(kind)?.behavior === 'display';
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
  if (kind === 'output' || kind === 'module' || isDisplayKind(kind)) {
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
 * CLOCK の周期 (tick 数) を、1 秒に進める tick 数から秒に直す。画面に出すので、有効数字 3 桁に丸める
 * (例: 100 tick ÷ 7 tick/秒 = 14.285… → 14.3)
 */
export function clockPeriodSeconds(period: number, ticksPerSecond: number): number {
  return Number((period / ticksPerSecond).toPrecision(3));
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
