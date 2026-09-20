import { describe, expect, it } from 'vitest';
import { MAIN_ID, type CircuitDef, type Project, type Component } from '../engine/project';
import { keepSwitchStates } from './switchStates';

function comp(id: string, kind: Component['kind'], y = 0, extra: Partial<Component> = {}): Component {
  return { id, kind, x: 0, y, ...extra };
}

function main(components: Component[]): CircuitDef {
  return { id: MAIN_ID, name: 'メイン', components, wires: [] };
}

describe('keepSwitchStates', () => {
  it('INPUT / CLOCK の ON/OFF だけ今の値を引き継ぎ、ほかは戻した状態のまま', () => {
    const restored: Project = {
      circuits: [
        main([comp('i', 'INPUT', 0, { on: false }), comp('k', 'CLOCK', 0, { on: false }), comp('g', 'AND', 100)]),
      ],
    };
    const current: Project = {
      circuits: [main([comp('i', 'INPUT', 40, { on: true }), comp('k', 'CLOCK', 0, { on: true })])],
    };
    const merged = keepSwitchStates(restored, current);
    expect(merged.circuits[0].components).toEqual([
      comp('i', 'INPUT', 0, { on: true }),
      comp('k', 'CLOCK', 0, { on: true }),
      comp('g', 'AND', 100),
    ]);
  });
});
