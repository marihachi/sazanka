// プロジェクト (メイン回路と複数のモジュール)、モジュールのピンの決め方、外から来たデータの検証。
// 回路そのもののデータと部品の種類の仕様は circuit.ts にある

import {
  inputPinNames,
  isFlipFlop,
  outputCount,
  type Circuit,
  type Component,
  type ComponentKind,
  type Ports,
  type Wire,
} from './circuit';
import { isObject } from './util';

export const MAIN_ID = 'main';

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

function isPinRef(p: unknown): p is Wire['from'] {
  return isObject(p) && typeof p.comp === 'string' && Number.isInteger(p.pin) && (p.pin as number) >= 0;
}

function isWire(w: unknown): w is Wire {
  return isObject(w) && typeof w.id === 'string' && isPinRef(w.from) && isPinRef(w.to);
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
