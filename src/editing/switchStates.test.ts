import { describe, expect, it } from 'vitest';
import type { Part } from '../circuit/part';
import { MAIN_ID, type CircuitDef, type Project } from '../circuit/project';
import { keepSwitchStates } from './switchStates';

function comp(id: string, kind: Part['kind'], y = 0, extra: Partial<Part> = {}): Part {
  return { id, kind, x: 0, y, ...extra };
}

function main(parts: Part[]): CircuitDef {
  return { id: MAIN_ID, name: 'メイン', parts, wires: [] };
}

describe('keepSwitchStates', () => {
  it('INPUT / CLOCK の ON/OFF だけ今の値を引き継ぎ、ほかは戻した状態のまま', () => {
    const restored: Project = {
      circuits: [
        // biome-ignore format: 表形式を維持するため
        main([
          comp('i', 'input', 0, { on: false }),
          comp('k', 'clock', 0, { on: false }),
          comp('g', 'and', 100),
        ]),
      ],
    };
    const current: Project = {
      circuits: [
        // biome-ignore format: 表形式を維持するため
        main([
          comp('i', 'input', 40, { on: true }),
          comp('k', 'clock', 0, { on: true }),
        ]),
      ],
    };
    const merged = keepSwitchStates(restored, current);
    expect(merged.circuits[0].parts).toEqual([
      comp('i', 'input', 0, { on: true }),
      comp('k', 'clock', 0, { on: true }),
      comp('g', 'and', 100),
    ]);
  });
});
