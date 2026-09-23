import type { Project } from '../engine/project';

/**
 * restored の INPUT / CLOCK の ON/OFF を、current の同じ部品の値で置き換える。
 * スイッチ操作やクロックは元に戻す対象ではないので、履歴をたどっても今の値を保つために使う。
 */
export function keepSwitchStates(restored: Project, current: Project): Project {
  const on = new Map<string, boolean | undefined>();
  for (const d of current.circuits) {
    for (const c of d.components) {
      if (c.kind === 'INPUT' || c.kind === 'CLOCK') {
        on.set(`${d.id}/${c.id}`, c.on);
      }
    }
  }
  return {
    ...restored,
    circuits: restored.circuits.map((d) => ({
      ...d,
      components: d.components.map((c) => {
        const key = `${d.id}/${c.id}`;
        return on.has(key) ? { ...c, on: on.get(key) } : c;
      }),
    })),
  };
}
