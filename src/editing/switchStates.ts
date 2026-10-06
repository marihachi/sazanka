import type { Project } from '../circuit/project';

/**
 * restored の INPUT / CLOCK の ON/OFF を、current の同じ部品の値で置き換える。
 * INPUT の ON/OFF は元に戻す対象ではないので、履歴をたどっても今の値を保つために使う。
 * CLOCK の ON/OFF はプロジェクトに書かず、シミュレーションの中で持つ (simulation/useSimulation.ts)。
 * CLOCK を含めているのは、部品の on をまとめて扱っているだけ
 */
export function keepSwitchStates(restored: Project, current: Project): Project {
  const on = new Map<string, boolean | undefined>();
  for (const d of current.circuits) {
    for (const c of d.parts) {
      if (c.kind === 'input' || c.kind === 'clock') {
        on.set(`${d.id}/${c.id}`, c.on);
      }
    }
  }
  return {
    ...restored,
    circuits: restored.circuits.map((d) => ({
      ...d,
      parts: d.parts.map((c) => {
        const key = `${d.id}/${c.id}`;
        return on.has(key) ? { ...c, on: on.get(key) } : c;
      }),
    })),
  };
}
