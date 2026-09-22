// 部品のデータと、部品の種類ごとの仕様 (ピン、遅延)。
// 部品を並べた回路は circuit.ts、モジュールのピンは module.ts にある

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

/**
 * HIGH: 常に ON を出力する
 * CUSTOM: モジュール。シミュレーション前に展開される
 * BUF: 入力をそのまま出力する。展開したモジュールのピンに使う内部用の部品
 */
export type ComponentKind = GateKind | FlipFlopKind | 'INPUT' | 'CLOCK' | 'HIGH' | 'OUTPUT' | 'CUSTOM' | 'BUF';

export type GateKind = 'AND' | 'OR' | 'NOT' | 'NAND' | 'NOR' | 'XOR';

/**
 * 記憶素子。RS、RSEN、DLATCH はクロックのないラッチ (入力の ON/OFF の状態で動く)、
 * ほかはクロックの立ち上がりの瞬間だけ動くフリップフロップ
 */
export type FlipFlopKind = 'RS' | 'RSEN' | 'DLATCH' | 'DFF' | 'TFF' | 'JKFF';

/**
 * 利用者が回路に置ける部品の種類。保存データや共有データに現れるのはこれだけ。
 * BUF は展開用の内部の部品なので含めない。種類を足したらここにも足す
 */
export const PLACEABLE_KINDS: ReadonlySet<ComponentKind> = new Set<ComponentKind>([
  'AND',
  'OR',
  'NOT',
  'NAND',
  'NOR',
  'XOR',
  'RS',
  'RSEN',
  'DLATCH',
  'DFF',
  'TFF',
  'JKFF',
  'INPUT',
  'CLOCK',
  'HIGH',
  'OUTPUT',
  'CUSTOM',
]);

/**
 * 入力ピンに名前がある種類と、その名前 (表示用)。ここにない種類のピンは名前なし (空文字)。
 * 並び順がそのままピン番号になる。配線と保存データはピン番号で入力ピンを指すので、
 * 順番を入れ替えると、保存済みの回路の配線が別のピンにつながってしまう
 */
const INPUT_PINS: Partial<Record<ComponentKind, string[]>> = {
  RS: ['S', 'R'],
  RSEN: ['S', 'EN', 'R'],
  DLATCH: ['D', 'EN'],
  DFF: ['D', '>'],
  TFF: ['T', '>'],
  JKFF: ['J', '>', 'K'],
};

/**
 * 部品の遅延 (何 tick 後に出力へ現れるか)。ここに書かない種類は遅延なし (0)。
 * NAND / NOR を 1 段とし、AND / OR はそれを反転した 2 段、XOR は 3 段として実物に近づけている。
 * フリップフロップは、それらを組み合わせた構成の段数で数える。
 * 遅延なしなのは、部品ではなく端子である INPUT / CLOCK / HIGH / OUTPUT と、
 * モジュールのピンを表す内部用の BUF (モジュールにしただけで遅れないようにするため)
 */
const DELAYS: Partial<Record<ComponentKind, number>> = {
  NOT: 1,
  NAND: 1,
  NOR: 1,
  AND: 2,
  OR: 2,
  XOR: 3,
  // RS ラッチは NOR をたすきに組んだ構成、エッジトリガ型はさらにゲートを重ねた構成なので、その段数に合わせる
  RS: 2,
  // EN 付きの RS ラッチと D ラッチは、EN で入力を通すゲートの後ろに RS ラッチを置いた構成
  RSEN: 3,
  DLATCH: 3,
  DFF: 3,
  TFF: 3,
  JKFF: 3,
};

export function delayOf(kind: ComponentKind): number {
  return DELAYS[kind] ?? 0;
}

/** エッジトリガ型フリップフロップの CLK 入力のピン番号。JK も CLK を真ん中 (J, >, K) に置いてそろえている */
export const CLK_PIN = 1;

/** 部品の入出力ピン名 (表示用。名前のないピンは空文字) */
export interface Ports {
  inputs: string[];
  outputs: string[];
}

export function isFlipFlop(kind: ComponentKind): kind is FlipFlopKind {
  return kind === 'RS' || kind === 'RSEN' || kind === 'DLATCH' || kind === 'DFF' || kind === 'TFF' || kind === 'JKFF';
}

export function inputPinNames(kind: ComponentKind): string[] {
  const names = INPUT_PINS[kind];
  if (names) return names;
  return Array(inputCount(kind)).fill('');
}

export function inputCount(kind: ComponentKind): number {
  if (INPUT_PINS[kind]) return INPUT_PINS[kind].length;
  switch (kind) {
    case 'INPUT':
    case 'CLOCK':
    case 'HIGH':
    // モジュールのピン数は中身の回路で決まる (module.ts の portsOf)。
    // シミュレーションでは展開してから数えるので、ここでは 0 でよい
    case 'CUSTOM':
      return 0;
    case 'NOT':
    case 'OUTPUT':
    case 'BUF':
      return 1;
    default:
      return 2;
  }
}

export function outputPinNames(kind: ComponentKind): string[] {
  if (isFlipFlop(kind)) return ['Q', 'Q̄'];
  return Array(outputCount(kind)).fill('');
}

export function outputCount(kind: ComponentKind): number {
  if (kind === 'OUTPUT' || kind === 'CUSTOM') return 0;
  return isFlipFlop(kind) ? 2 : 1; // フリップフロップは Q, Q̄
}

/** CLOCK の周期 (一往復の tick 数) の既定値と、設定できる範囲 */
export const DEFAULT_CLOCK_PERIOD = 100;
export const MIN_CLOCK_PERIOD = 2;
export const MAX_CLOCK_PERIOD = 10000;

export function isClockPeriod(v: unknown): v is number {
  return Number.isInteger(v) && (v as number) >= MIN_CLOCK_PERIOD && (v as number) <= MAX_CLOCK_PERIOD;
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
