// 回路 1 つ分のデータ構造と、部品の種類ごとの仕様。
// 複数の回路をまとめたプロジェクトは project.ts にある

/** 回路 */
export interface Circuit {
  components: Component[];
  wires: Wire[];
}

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
}

export interface Wire {
  id: string;
  from: PinRef; // 出力ピン
  to: PinRef; // 入力ピン
}

export interface PinRef {
  comp: string;
  pin: number;
}

/** 部品・配線・回路の ID。回路の中で重ならなければよいので、短いランダムな文字列で足りる */
export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * HIGH: 常に ON を出力する
 * CUSTOM: モジュール。シミュレーション前に展開される
 * BUF: 入力をそのまま出力する。展開したモジュールのピンに使う内部用の部品
 */
export type ComponentKind = GateKind | FlipFlopKind | 'INPUT' | 'CLOCK' | 'HIGH' | 'OUTPUT' | 'CUSTOM' | 'BUF';

export type GateKind = 'AND' | 'OR' | 'NOT' | 'NAND' | 'NOR' | 'XOR';

/** 記憶素子。RS はクロックのないラッチ、ほかはクロックの立ち上がりで動くフリップフロップ */
export type FlipFlopKind = 'RS' | 'DFF' | 'TFF' | 'JKFF';

/**
 * 入力ピン名 (表示用。ゲートは空文字)。
 * 並び順がそのままピン番号になり、配線 (Wire) と保存データはピン番号で入力ピンを指す。
 * 順番を入れ替えると、既存の配線が別のピンにつながってしまうので注意
 */
const INPUT_PINS: Partial<Record<ComponentKind, string[]>> = {
  RS: ['S', 'R'],
  DFF: ['D', '>'],
  TFF: ['T', '>'],
  JKFF: ['J', '>', 'K'],
};

/** エッジトリガ型フリップフロップの CLK 入力のピン番号。JK も CLK を真ん中 (J, >, K) に置いてそろえている */
export const CLK_PIN = 1;

/** 部品の入出力ピン名 (表示用。名前のないピンは空文字) */
export interface Ports {
  inputs: string[];
  outputs: string[];
}

export function isFlipFlop(kind: ComponentKind): kind is FlipFlopKind {
  return kind === 'RS' || kind === 'DFF' || kind === 'TFF' || kind === 'JKFF';
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
    case 'CUSTOM': // ピン数は定義による (ports.ts の portsOf)。シミュレーション前に展開されるのでここでは 0
      return 0;
    case 'NOT':
    case 'OUTPUT':
    case 'BUF':
      return 1;
    default:
      return 2;
  }
}

export function outputCount(kind: ComponentKind): number {
  if (kind === 'OUTPUT' || kind === 'CUSTOM') return 0;
  return isFlipFlop(kind) ? 2 : 1; // フリップフロップは Q, Q̄
}
