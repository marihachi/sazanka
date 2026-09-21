import { describe, expect, it } from 'vitest';
import type { Component } from './circuit';
import {
  checkProject,
  circuitsUsing,
  dependsOn,
  emptyProject,
  findDef,
  MAIN_ID,
  portComponents,
  portsOf,
  type Project,
} from './project';

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

describe('emptyProject / findDef', () => {
  it('空のプロジェクトはメイン回路だけを持つ', () => {
    const project = emptyProject();
    expect(project.circuits).toHaveLength(1);
    expect(project.circuits[0].id).toBe(MAIN_ID);
    expect(project.circuits[0].components).toEqual([]);
  });

  it('findDef は ID の回路を返し、なければ undefined', () => {
    const project = emptyProject();
    expect(findDef(project, MAIN_ID)).toBe(project.circuits[0]);
    expect(findDef(project, 'ない')).toBeUndefined();
    expect(findDef(project, undefined)).toBeUndefined();
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
    expect(portsOf(comp('u', 'CUSTOM', { custom: 'm' }), project)).toEqual({ inputs: ['A', ''], outputs: ['S'] });
    // 参照先がなければピンなし
    expect(portsOf(comp('u', 'CUSTOM', { custom: 'ない' }), project)).toEqual({ inputs: [], outputs: [] });
  });

  it('モジュール以外のピン名は種類で決まる', () => {
    const project = emptyProject();
    expect(portsOf(comp('g', 'AND'), project)).toEqual({ inputs: ['', ''], outputs: [''] });
    expect(portsOf(comp('n', 'NOT'), project)).toEqual({ inputs: [''], outputs: [''] });
    expect(portsOf(comp('f', 'JKFF'), project)).toEqual({ inputs: ['J', '>', 'K'], outputs: ['Q', 'Q̄'] });
    expect(portsOf(comp('i', 'INPUT'), project)).toEqual({ inputs: [], outputs: [''] });
    expect(portsOf(comp('o', 'OUTPUT'), project)).toEqual({ inputs: [''], outputs: [] });
  });
});

describe('dependsOn', () => {
  const project: Project = {
    circuits: [
      { id: MAIN_ID, name: 'メイン', components: [comp('u', 'CUSTOM', { custom: 'a' })], wires: [] },
      { id: 'a', name: 'A', components: [comp('u', 'CUSTOM', { custom: 'b' })], wires: [] },
      { id: 'b', name: 'B', components: [], wires: [] },
    ],
  };

  it('間接的に含む場合も true', () => {
    expect(dependsOn(project, MAIN_ID, 'b')).toBe(true);
    expect(dependsOn(project, 'a', 'b')).toBe(true);
    expect(dependsOn(project, 'b', 'a')).toBe(false);
  });
});

describe('checkProject', () => {
  function main(components: Component[], wires: unknown[] = []) {
    return { circuits: [{ id: MAIN_ID, name: 'メイン', components, wires }] };
  }

  it('正しいプロジェクトは undefined', () => {
    expect(checkProject(emptyProject())).toBeUndefined();
    expect(checkProject({ ...emptyProject(), author: 'さざんか' })).toBeUndefined();
  });

  const 壊れたもの: [string, unknown][] = [
    ['オブジェクトでない', [1, 2]],
    ['回路の一覧がない', {}],
    ['メイン回路がない', { circuits: [{ id: 'x', name: 'x', components: [], wires: [] }] }],
    ['回路に名前がない', { circuits: [{ id: MAIN_ID, components: [], wires: [] }] }],
    ['部品の種類が不正', main([{ id: 'a', kind: 'FOO', x: 0, y: 0 } as unknown as Component])],
    ['内部用の BUF が入っている', main([comp('a', 'BUF')])],
    ['座標が数値でない', main([{ id: 'a', kind: 'AND', x: '0', y: 0 } as unknown as Component])],
    ['部品の ID が重複', main([comp('a', 'AND'), comp('a', 'OR')])],
    [
      '配線の接続先がない',
      main([comp('a', 'INPUT')], [{ id: 'w', from: { comp: 'a', pin: 0 }, to: { comp: 'x', pin: 0 } }]),
    ],
    [
      'ピン番号が負',
      main([comp('a', 'INPUT')], [{ id: 'w', from: { comp: 'a', pin: 0 }, to: { comp: 'a', pin: -1 } }]),
    ],
    ['作者名が文字列でない', { ...emptyProject(), author: 1 }],
    ['存在しないモジュールを参照', main([comp('u', 'CUSTOM', { custom: 'ない' })])],
  ];
  for (const [name, value] of 壊れたもの) {
    it(`壊れたデータを弾く: ${name}`, () => {
      expect(checkProject(value)).toBeTypeOf('string');
    });
  }
});
