import { describe, expect, it } from 'vitest';
import type { Component } from './component';
import { checkProject, emptyProject, findDef, MAIN_ID } from './project';

function comp(id: string, kind: Component['kind'], extra: Partial<Component> = {}): Component {
  return { id, kind, x: 0, y: 0, ...extra };
}

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
