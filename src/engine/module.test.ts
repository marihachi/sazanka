import { describe, expect, it } from 'vitest';
import type { Component } from './component';
import { emptyProject, MAIN_ID, type Project } from './project';
import { circuitsUsing, dependsOn, portComponents, portsOf } from './module';

function comp(
  id: string,
  kind: Component['kind'],
  extra: Partial<Component> = {},
): Component {
  return { id, kind, x: 0, y: 0, ...extra };
}

describe('circuitsUsing', () => {
  it('モジュールを直接置いている回路を返す', () => {
    const project: Project = {
      circuits: [
        {
          id: MAIN_ID,
          name: 'メイン',
          components: [comp('m', 'CUSTOM', { custom: 'a' })],
          wires: [],
        },
        {
          id: 'a',
          name: 'A',
          components: [comp('n', 'CUSTOM', { custom: 'b' })],
          wires: [],
        },
        { id: 'b', name: 'B', components: [], wires: [] },
      ],
    };
    expect(circuitsUsing(project, 'a').map((d) => d.id)).toEqual([MAIN_ID]);
    expect(circuitsUsing(project, 'b').map((d) => d.id)).toEqual(['a']);
    expect(circuitsUsing(project, MAIN_ID)).toEqual([]);
  });
});

describe('モジュールのピン', () => {
  it('ピンになるのは INPUT / OUTPUT で、上から順、同じ高さなら左から', () => {
    const def = {
      components: [
        { id: 'b', kind: 'INPUT' as const, x: 100, y: 40 },
        { id: 'a', kind: 'INPUT' as const, x: 0, y: 40 },
        { id: 'c', kind: 'INPUT' as const, x: 0, y: 0 },
        { id: 'g', kind: 'AND' as const, x: 0, y: 0 },
        { id: 'o', kind: 'OUTPUT' as const, x: 0, y: 0 },
      ],
      wires: [],
    };
    const { inputs, outputs } = portComponents(def);
    expect(inputs.map((k) => k.id)).toEqual(['c', 'a', 'b']);
    expect(outputs.map((k) => k.id)).toEqual(['o']);
  });

  it('モジュールのピン名は中の INPUT / OUTPUT のラベル。ラベルなしは空文字', () => {
    const project: Project = {
      circuits: [
        { id: MAIN_ID, name: 'メイン', components: [], wires: [] },
        {
          id: 'm',
          name: 'M',
          components: [
            comp('i', 'INPUT', { label: 'A' }),
            { ...comp('j', 'INPUT'), y: 40 },
            comp('o', 'OUTPUT', { label: 'S' }),
          ],
          wires: [],
        },
      ],
    };
    expect(portsOf(comp('u', 'CUSTOM', { custom: 'm' }), project)).toEqual({
      inputs: ['A', ''],
      outputs: ['S'],
    });
    // 参照先がなければピンなし
    expect(portsOf(comp('u', 'CUSTOM', { custom: 'ない' }), project)).toEqual({
      inputs: [],
      outputs: [],
    });
  });

  it('モジュール以外のピン名は種類で決まる', () => {
    const project = emptyProject();
    expect(portsOf(comp('g', 'AND'), project)).toEqual({
      inputs: ['', ''],
      outputs: [''],
    });
    expect(portsOf(comp('n', 'NOT'), project)).toEqual({
      inputs: [''],
      outputs: [''],
    });
    expect(portsOf(comp('f', 'JKFF'), project)).toEqual({
      inputs: ['J', '>', 'K'],
      outputs: ['Q', 'Q̄'],
    });
    expect(portsOf(comp('i', 'INPUT'), project)).toEqual({
      inputs: [],
      outputs: [''],
    });
    expect(portsOf(comp('o', 'OUTPUT'), project)).toEqual({
      inputs: [''],
      outputs: [],
    });
  });
});

describe('dependsOn', () => {
  const project: Project = {
    circuits: [
      {
        id: MAIN_ID,
        name: 'メイン',
        components: [comp('u', 'CUSTOM', { custom: 'a' })],
        wires: [],
      },
      {
        id: 'a',
        name: 'A',
        components: [comp('u', 'CUSTOM', { custom: 'b' })],
        wires: [],
      },
      { id: 'b', name: 'B', components: [], wires: [] },
    ],
  };

  it('間接的に含む場合も true', () => {
    expect(dependsOn(project, MAIN_ID, 'b')).toBe(true);
    expect(dependsOn(project, 'a', 'b')).toBe(true);
    expect(dependsOn(project, 'b', 'a')).toBe(false);
  });
});
