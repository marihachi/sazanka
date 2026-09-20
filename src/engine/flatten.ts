import { portComponents, findDef, type CircuitDef, type Project, type Circuit, type PinRef } from './project';

/** 展開したモジュールのピンに対応する、展開後の部品 ID */
export interface ModulePorts {
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

/** 展開の結果。modules は、最上位に置かれたモジュールのピンに対応する展開後の部品 ID */
export interface Flattened {
  circuit: Circuit;
  modules: Map<string, ModulePorts>;
}

/** 回路定義 id を最上位として、モジュールを展開した1つの回路にする */
export function flattenProject(project: Project, id: string): Flattened {
  const def = findDef(project, id);
  const circuit: Circuit = { components: [], wires: [] };
  if (!def) return { circuit, modules: new Map() };
  return { circuit, modules: flattenInto(project, def, '', circuit, [def.id]) };
}
