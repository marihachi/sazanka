import { describe, expect, it } from 'vitest';
import type { Part } from '../circuit/part';
import { MAIN_ID, type Project } from '../circuit/project';
import { removeCircuitFrom } from './useCircuits';

const mod = (id: string, circuitId: string): Part => ({
  id,
  kind: 'module',
  x: 0,
  y: 0,
  circuitId,
});

describe('removeCircuitFrom', () => {
  // メイン回路と O に、A を置いている。B には何も置いていない
  const project = {
    circuits: [
      { id: MAIN_ID, name: '', parts: [mod('u1', 'a'), mod('u2', 'o')], wires: [] },
      { id: 'a', name: 'A', parts: [], wires: [] },
      { id: 'o', name: 'O', parts: [mod('u3', 'a')], wires: [] },
      { id: 'b', name: 'B', parts: [], wires: [] },
    ],
  } as unknown as Project;

  it('回路を消し、置いていた部品は名前と大きさの写しを持って残る (見つからないモジュール)', () => {
    const result = removeCircuitFrom(project, 'a', 'A');
    expect(result.circuits.map((d) => d.id)).toEqual([MAIN_ID, 'o', 'b']);
    expect(result.circuits[0].parts).toEqual([
      { ...mod('u1', 'a'), circuitName: 'A', circuitSize: { width: 4, height: 2 } },
      mod('u2', 'o'),
    ]);
    expect(result.circuits[1].parts).toEqual([
      { ...mod('u3', 'a'), circuitName: 'A', circuitSize: { width: 4, height: 2 } },
    ]);
  });

  it('部品を書き換えない回路は、同じものを使う', () => {
    const result = removeCircuitFrom(project, 'a', 'A');
    expect(result.circuits[2]).toBe(project.circuits[3]);
  });
});
