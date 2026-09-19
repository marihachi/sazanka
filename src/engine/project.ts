import {
  inputPinNames,
  isFlipFlop,
  outputCount,
  pinKey,
  simulate,
  type Circuit,
  type Component,
  type PinRef,
  type SimResult,
} from './sim';

export const MAIN_ID = 'main';

export interface CircuitDef extends Circuit {
  id: string;
  name: string;
}

export interface Project {
  /** 先頭はメイン回路 (id = MAIN_ID) */
  circuits: CircuitDef[];
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

/** 部品の入出力ピン名 */
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

/** 展開したモジュールのピンに対応する、展開後の部品 ID */
interface ModulePorts {
  inputs: string[];
  outputs: string[];
}

/**
 * def を展開して out に追加する。部品 ID には prefix が付く。
 * モジュールの中の INPUT / OUTPUT は外部と接続する BUF になる。
 */
function flattenInto(
  project: Project,
  def: CircuitDef,
  prefix: string,
  out: Circuit,
  stack: string[],
): Map<string, ModulePorts> {
  const inner = stack.length > 1;
  const modules = new Map<string, ModulePorts>();
  for (const c of def.components) {
    if (c.kind === 'CUSTOM') {
      const child = findDef(project, c.custom);
      // 見つからない・循環している参照は無視
      if (!child || stack.includes(child.id)) continue;
      const childPrefix = `${prefix}${c.id}/`;
      flattenInto(project, child, childPrefix, out, [...stack, child.id]);
      const { inputs, outputs } = portComponents(child);
      modules.set(c.id, {
        inputs: inputs.map((k) => childPrefix + k.id),
        outputs: outputs.map((k) => childPrefix + k.id),
      });
    } else {
      const kind = inner && (c.kind === 'INPUT' || c.kind === 'OUTPUT') ? 'BUF' : c.kind;
      out.components.push({ ...c, id: prefix + c.id, kind });
    }
  }

  const resolve = (ref: PinRef, side: 'inputs' | 'outputs'): PinRef | undefined => {
    const mod = modules.get(ref.comp);
    if (!mod) return { comp: prefix + ref.comp, pin: ref.pin };
    const id = mod[side][ref.pin];
    return id === undefined ? undefined : { comp: id, pin: 0 };
  };
  for (const w of def.wires) {
    const from = resolve(w.from, 'outputs');
    const to = resolve(w.to, 'inputs');
    if (from && to) out.wires.push({ id: prefix + w.id, from, to });
  }
  return modules;
}

/**
 * 回路定義 id を最上位としてシミュレーションする。
 * 最上位に置かれたモジュールの出力ピンの値も values に含める。
 */
export function simulateCircuit(project: Project, id: string, prev?: SimResult): SimResult {
  const def = findDef(project, id);
  if (!def) return simulate({ components: [], wires: [] });
  const flat: Circuit = { components: [], wires: [] };
  const modules = flattenInto(project, def, '', flat, [def.id]);
  const result = simulate(flat, prev);
  for (const [compId, mod] of modules) {
    mod.outputs.forEach((id, pin) => result.values.set(pinKey(compId, pin), result.values.get(pinKey(id, 0)) ?? false));
  }
  return result;
}

/**
 * restored の INPUT / CLOCK の ON/OFF を、current の同じ部品の値で置き換える。
 * スイッチ操作やクロックは元に戻す対象ではないので、履歴をたどっても今の値を保つために使う。
 */
export function keepSwitchStates(restored: Project, current: Project): Project {
  const on = new Map<string, boolean | undefined>();
  for (const d of current.circuits) {
    for (const c of d.components) if (c.kind === 'INPUT' || c.kind === 'CLOCK') on.set(`${d.id}/${c.id}`, c.on);
  }
  return {
    circuits: restored.circuits.map((d) => ({
      ...d,
      components: d.components.map((c) => {
        const key = `${d.id}/${c.id}`;
        return on.has(key) ? { ...c, on: on.get(key) } : c;
      }),
    })),
  };
}
