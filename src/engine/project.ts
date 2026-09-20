// 回路とプロジェクトのデータ構造、部品の種類ごとの仕様、モジュールのピンの決め方。

import { isObject } from './util';

export const MAIN_ID = 'main';

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

export interface CircuitDef extends Circuit {
  id: string;
  name: string;
}

export interface Project {
  /** 先頭はメイン回路 (id = MAIN_ID) */
  circuits: CircuitDef[];
  /** 書き出すときに付ける作者名。入力されていなければ無い */
  author?: string;
}

export function emptyProject(): Project {
  return { circuits: [{ id: MAIN_ID, name: 'メイン', components: [], wires: [] }] };
}

export function findDef(project: Project, id: string | undefined): CircuitDef | undefined {
  return project.circuits.find((d) => d.id === id);
}

function byPosition(a: Component, b: Component): number {
  return a.y - b.y || a.x - b.x;
}

/** モジュールのピンになる INPUT / OUTPUT (上から順) */
export function portComponents(def: Circuit): { inputs: Component[]; outputs: Component[] } {
  return {
    inputs: def.components.filter((c) => c.kind === 'INPUT').sort(byPosition),
    outputs: def.components.filter((c) => c.kind === 'OUTPUT').sort(byPosition),
  };
}

/** 部品の入出力ピン名 (表示用。名前のないピンは空文字) */
export interface Ports {
  inputs: string[];
  outputs: string[];
}

export function portsOf(c: Component, project: Project): Ports {
  if (c.kind === 'CUSTOM') {
    const def = findDef(project, c.custom);
    if (!def) return { inputs: [], outputs: [] };
    const { inputs, outputs } = portComponents(def);
    return { inputs: inputs.map((k) => k.label ?? ''), outputs: outputs.map((k) => k.label ?? '') };
  }
  return {
    inputs: inputPinNames(c.kind),
    outputs: isFlipFlop(c.kind) ? ['Q', 'Q̄'] : Array(outputCount(c.kind)).fill(''),
  };
}

/** 回路 a が (間接的にでも) 回路 b をモジュールとして含むか */
export function dependsOn(project: Project, a: string, b: string, seen = new Set<string>()): boolean {
  if (seen.has(a)) return false;
  seen.add(a);
  const def = findDef(project, a);
  if (!def) return false;
  return def.components.some(
    (c) => c.kind === 'CUSTOM' && c.custom !== undefined && (c.custom === b || dependsOn(project, c.custom, b, seen)),
  );
}

/** モジュール id を部品として直接置いている回路 */
export function circuitsUsing(project: Project, id: string): CircuitDef[] {
  return project.circuits.filter((d) => d.components.some((c) => c.kind === 'CUSTOM' && c.custom === id));
}

export function isFlipFlop(kind: ComponentKind): kind is FlipFlopKind {
  return kind === 'RS' || kind === 'DFF' || kind === 'TFF' || kind === 'JKFF';
}

function inputPinNames(kind: ComponentKind): string[] {
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

/** 共有データに置ける部品の種類。BUF は展開用の内部の部品なので含めない */
const KINDS = new Set<ComponentKind>([
  'AND',
  'OR',
  'NOT',
  'NAND',
  'NOR',
  'XOR',
  'RS',
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
 * プロジェクトとして正しい形かを確かめ、問題があればその内容を返す。
 * 共有された JSON のほか、localStorage の保存データを読み込むときにも使う
 */
export function checkProject(project: unknown): string | undefined {
  if (!isObject(project) || !Array.isArray(project.circuits)) return '回路の一覧がありません';
  if (project.author !== undefined && typeof project.author !== 'string') return '作者名が文字列ではありません';
  const circuits = project.circuits as unknown[];
  if (!isObject(circuits[0]) || circuits[0].id !== MAIN_ID) return 'メイン回路がありません';
  const ids = new Set<string>();
  for (const def of circuits) {
    const error = checkCircuit(def);
    if (error) return error;
    const { id } = def as CircuitDef;
    if (ids.has(id)) return `回路の ID が重複しています: ${id}`;
    ids.add(id);
  }
  for (const def of circuits as CircuitDef[]) {
    for (const c of def.components) {
      if (c.kind === 'CUSTOM' && !ids.has(c.custom ?? ''))
        return `「${def.name}」が存在しないモジュールを参照しています`;
    }
  }
  return undefined;
}

function checkCircuit(def: unknown): string | undefined {
  if (!isObject(def) || typeof def.id !== 'string' || typeof def.name !== 'string')
    return '回路の ID か名前がありません';
  if (!Array.isArray(def.components) || !Array.isArray(def.wires)) return `「${def.name}」の部品か配線がありません`;
  const compIds = new Set<string>();
  for (const c of def.components as unknown[]) {
    if (!isComponent(c)) return `「${def.name}」に不正な部品があります`;
    if (compIds.has(c.id)) return `「${def.name}」で部品の ID が重複しています: ${c.id}`;
    compIds.add(c.id);
  }
  for (const w of def.wires as unknown[]) {
    if (!isWire(w) || !compIds.has(w.from.comp) || !compIds.has(w.to.comp)) {
      return `「${def.name}」に不正な配線があります`;
    }
  }
  return undefined;
}

function isComponent(c: unknown): c is Component {
  return (
    isObject(c) &&
    typeof c.id === 'string' &&
    KINDS.has(c.kind as ComponentKind) &&
    typeof c.x === 'number' &&
    typeof c.y === 'number'
  );
}

function isPinRef(p: unknown): p is Wire['from'] {
  return isObject(p) && typeof p.comp === 'string' && Number.isInteger(p.pin) && (p.pin as number) >= 0;
}

function isWire(w: unknown): w is Wire {
  return isObject(w) && typeof w.id === 'string' && isPinRef(w.from) && isPinRef(w.to);
}
