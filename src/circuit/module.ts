// モジュール: 回路を部品として使うときのピンの決め方と、回路同士の依存。
// 展開 (シミュレーション用に1つの回路にする) は simulation/flatten.ts にある

import { inputPinNames, outputPinNames, type Part } from './part';
import type { Circuit } from './circuit';
import { findDef, type CircuitDef, type Footprint, type Project } from './project';

/**
 * 部品のピンの割り当て。シート上の配置 (parts/layouts.ts の layoutOf) は、これから決める。
 * モジュールのピンは中身の回路で決まるので、プロジェクトを読める pinoutOf で作り、配置まで届ける
 */
export interface Pinout {
  /** 入力ピンの名前 (表示用。名前のないピンは空文字)。並び順がピン番号 */
  inputs: string[];
  /** 出力ピンの名前。並び順は inputs と同じ */
  outputs: string[];
  /** モジュールのピンの出し方。モジュール以外の部品にはない */
  footprint?: Footprint;
}

/** モジュールのピンになる INPUT / OUTPUT (上から順) */
export function portParts(def: Circuit): {
  inputs: Part[];
  outputs: Part[];
} {
  // 並び計算: 上から、同じ高さなら左から。この順がピン番号になるので、変えると既存の配線が別のピンにつながる
  function byPosition(a: Part, b: Part): number {
    return a.y - b.y || a.x - b.x;
  }

  return {
    inputs: def.parts.filter((c) => c.kind === 'input').sort(byPosition),
    outputs: def.parts.filter((c) => c.kind === 'output').sort(byPosition),
  };
}

/** 部品のピン名。モジュールは中の INPUT / OUTPUT のラベル、ほかは種類で決まる */
export function pinoutOf(c: Part, project: Project): Pinout {
  if (c.kind === 'module') {
    const def = findDef(project, c.module);

    if (!def) {
      return { inputs: [], outputs: [], footprint: { kind: 'split' } };
    }

    const { inputs, outputs } = portParts(def);

    return {
      inputs: inputs.map((k) => k.label ?? ''),
      outputs: outputs.map((k) => k.label ?? ''),
      footprint: def.footprint ?? { kind: 'split' },
    };
  }

  return {
    inputs: inputPinNames(c.kind),
    outputs: outputPinNames(c.kind),
  };
}

/** 回路 a が (間接的にでも) 回路 b をモジュールとして含むか */
export function dependsOn(
  project: Project,
  a: string,
  b: string,
  seen = new Set<string>(),
): boolean {
  // seen は調べ終えた回路。一度調べた回路は飛ばす。
  // 循環した参照で止まらなくなるのを防ぎ、同じ回路を何度も調べないため
  if (seen.has(a)) {
    return false;
  }

  seen.add(a);
  const def = findDef(project, a);

  if (!def) {
    return false;
  }

  return def.parts.some(
    (c) =>
      c.kind === 'module' &&
      c.module !== undefined &&
      (c.module === b || dependsOn(project, c.module, b, seen)),
  );
}

/** モジュール id を部品として直接置いている回路 */
export function circuitsUsing(project: Project, id: string): CircuitDef[] {
  return project.circuits.filter((d) =>
    d.parts.some((c) => c.kind === 'module' && c.module === id),
  );
}
