import { describe, expect, it } from 'vitest';
import type { Component } from './circuit';
import { circuitsUsing, MAIN_ID, type Project } from './project';

function comp(id: string, kind: Component['kind'], extra: Partial<Component> = {}): Component {
  return { id, kind, x: 0, y: 0, ...extra };
}

describe('circuitsUsing', () => {
  it('モジュールを直接置いている回路を返す', () => {
    const project: Project = {
      circuits: [
        { id: MAIN_ID, name: 'メイン', components: [comp('m', 'CUSTOM', { custom: 'a' })], wires: [] },
        { id: 'a', name: 'A', components: [comp('n', 'CUSTOM', { custom: 'b' })], wires: [] },
        { id: 'b', name: 'B', components: [], wires: [] },
      ],
    };
    expect(circuitsUsing(project, 'a').map((d) => d.id)).toEqual([MAIN_ID]);
    expect(circuitsUsing(project, 'b').map((d) => d.id)).toEqual(['a']);
    expect(circuitsUsing(project, MAIN_ID)).toEqual([]);
  });
});
