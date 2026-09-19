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

/** サブ回路のピンになる INPUT / OUTPUT (上から順) */
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
  if (c.kind === 'SUB') {
    const def = findDef(project, c.sub);
    if (!def) return { inputs: [], outputs: [] };
    const { inputs, outputs } = portComponents(def);
    return { inputs: inputs.map((k) => k.label ?? ''), outputs: outputs.map((k) => k.label ?? '') };
  }
  return {
    inputs: inputPinNames(c.kind),
    outputs: isFlipFlop(c.kind) ? ['Q', 'Q̄'] : Array(outputCount(c.kind)).fill(''),
  };
}

/** 回路 a が (間接的にでも) 回路 b をサブ回路として含むか */
export function dependsOn(project: Project, a: string, b: string, seen = new Set<string>()): boolean {
  if (seen.has(a)) return false;
  seen.add(a);
  const def = findDef(project, a);
  if (!def) return false;
  return def.components.some((c) => c.kind === 'SUB' && c.sub !== undefined && (c.sub === b || dependsOn(project, c.sub, b, seen)));
}

/** 展開したサブ回路のピンに対応する、展開後の部品 ID */
interface SubPorts {
  inputs: string[];
  outputs: string[];
}

/**
 * def を展開して out に追加する。部品 ID には prefix が付く。
 * サブ回路の中の INPUT / OUTPUT は外部と接続する BUF になる。
 */
function flattenInto(project: Project, def: CircuitDef, prefix: string, out: Circuit, stack: string[]): Map<string, SubPorts> {
  const inner = stack.length > 1;
  const subs = new Map<string, SubPorts>();
  for (const c of def.components) {
    if (c.kind === 'SUB') {
      const child = findDef(project, c.sub);
      // 見つからない・循環している参照は無視
      if (!child || stack.includes(child.id)) continue;
      const childPrefix = `${prefix}${c.id}/`;
      flattenInto(project, child, childPrefix, out, [...stack, child.id]);
      const { inputs, outputs } = portComponents(child);
      subs.set(c.id, {
        inputs: inputs.map((k) => childPrefix + k.id),
        outputs: outputs.map((k) => childPrefix + k.id),
      });
    } else {
      const kind = inner && (c.kind === 'INPUT' || c.kind === 'OUTPUT') ? 'BUF' : c.kind;
      out.components.push({ ...c, id: prefix + c.id, kind });
    }
  }

  const resolve = (ref: PinRef, side: 'inputs' | 'outputs'): PinRef | undefined => {
    const sub = subs.get(ref.comp);
    if (!sub) return { comp: prefix + ref.comp, pin: ref.pin };
    const id = sub[side][ref.pin];
    return id === undefined ? undefined : { comp: id, pin: 0 };
  };
  for (const w of def.wires) {
    const from = resolve(w.from, 'outputs');
    const to = resolve(w.to, 'inputs');
    if (from && to) out.wires.push({ id: prefix + w.id, from, to });
  }
  return subs;
}

/**
 * 回路定義 id を最上位としてシミュレーションする。
 * 最上位に置かれたサブ回路の出力ピンの値も values に含める。
 */
export function simulateCircuit(project: Project, id: string, prev?: SimResult): SimResult {
  const def = findDef(project, id);
  if (!def) return simulate({ components: [], wires: [] });
  const flat: Circuit = { components: [], wires: [] };
  const subs = flattenInto(project, def, '', flat, [def.id]);
  const result = simulate(flat, prev);
  for (const [compId, sub] of subs) {
    sub.outputs.forEach((id, pin) => result.values.set(pinKey(compId, pin), result.values.get(pinKey(id, 0)) ?? false));
  }
  return result;
}
