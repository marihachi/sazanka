// モジュール: 回路を部品として使うときのピンの決め方と、回路同士の依存。
// 展開 (シミュレーション用に1つの回路にする) は simulation/flatten.ts にある

import { inputPinNames, outputPinNames, type Component } from './component';
import type { Circuit } from './circuit';
import { findDef, type CircuitDef, type Project } from './project';

/** 部品の入出力ピン名 (表示用。名前のないピンは空文字) */
export interface Ports {
  inputs: string[];
  outputs: string[];
}

/** モジュールのピンになる INPUT / OUTPUT (上から順) */
export function portComponents(def: Circuit): {
  inputs: Component[];
  outputs: Component[];
} {
  // 並び計算: 上から、同じ高さなら左から。この順がピン番号になるので、変えると既存の配線が別のピンにつながる
  function byPosition(a: Component, b: Component): number {
    return a.y - b.y || a.x - b.x;
  }

  return {
    inputs: def.components.filter((c) => c.kind === 'INPUT').sort(byPosition),
    outputs: def.components.filter((c) => c.kind === 'OUTPUT').sort(byPosition),
  };
}

/** 部品のピン名。モジュールは中の INPUT / OUTPUT のラベル、ほかは種類で決まる */
export function portsOf(c: Component, project: Project): Ports {
  if (c.kind === 'CUSTOM') {
    const def = findDef(project, c.custom);

    if (!def) {
      return { inputs: [], outputs: [] };
    }

    const { inputs, outputs } = portComponents(def);

    return {
      inputs: inputs.map((k) => k.label ?? ''),
      outputs: outputs.map((k) => k.label ?? ''),
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

  return def.components.some(
    (c) =>
      c.kind === 'CUSTOM' &&
      c.custom !== undefined &&
      (c.custom === b || dependsOn(project, c.custom, b, seen)),
  );
}

/** モジュール id を部品として直接置いている回路 */
export function circuitsUsing(project: Project, id: string): CircuitDef[] {
  return project.circuits.filter((d) =>
    d.components.some((c) => c.kind === 'CUSTOM' && c.custom === id),
  );
}
