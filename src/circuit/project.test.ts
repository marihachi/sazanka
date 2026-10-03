import { describe, expect, it } from 'vitest';
import type { Component } from './component';
import {
  checkProject,
  emptyProject,
  findDef,
  MAIN_ID,
  moveCircuit,
  type Project,
  withoutSwitchStates,
} from './project';

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
    ['配線の点が 1 つ', main([], [{ id: 'w', points: [{ x: 0, y: 0 }] }])],
    [
      '配線に斜めの区間がある',
      main(
        [],
        [
          {
            id: 'w',
            points: [
              { x: 0, y: 0 },
              { x: 20, y: 20 },
            ],
          },
        ],
      ),
    ],
    [
      'version 1 の形の配線',
      main([], [{ id: 'w', from: { comp: 'a', pin: 0 }, to: { comp: 'a', pin: 0 } }]),
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

describe('moveCircuit', () => {
  const project: Project = {
    circuits: ['main', 'a', 'b', 'c'].map((id) => ({
      id,
      name: id,
      components: [],
      wires: [],
    })),
  };
  const ids = (p: Project) => p.circuits.map((d) => d.id);

  it('モジュールを指定した位置に移す', () => {
    expect(ids(moveCircuit(project, 'c', 1))).toEqual(['main', 'c', 'a', 'b']);
    expect(ids(moveCircuit(project, 'a', 3))).toEqual(['main', 'b', 'c', 'a']);
  });

  it('メイン回路は先頭に固定。動かさず、その前にも置かない', () => {
    expect(ids(moveCircuit(project, MAIN_ID, 2))).toEqual(['main', 'a', 'b', 'c']);
    expect(ids(moveCircuit(project, 'b', 0))).toEqual(['main', 'b', 'a', 'c']);
  });
});

describe('withoutSwitchStates', () => {
  const project: Project = {
    circuits: [
      {
        id: MAIN_ID,
        name: 'メイン',
        components: [
          comp('a', 'INPUT', { on: true, label: 'A' }),
          comp('c', 'CLOCK', { on: true, period: 20 }),
        ],
        wires: [],
      },
      { id: 'm', name: 'モジュール', components: [comp('b', 'INPUT', { on: false })], wires: [] },
    ],
  };

  it('すべての回路の INPUT / CLOCK から ON/OFF を外す', () => {
    const result = withoutSwitchStates(project);
    const comps = result.circuits.flatMap((d) => d.components);
    expect(comps.every((c) => !('on' in c))).toBe(true);
  });

  it('ON/OFF 以外の項目は残し、元のプロジェクトは書き換えない', () => {
    const result = withoutSwitchStates(project);
    expect(result.circuits[0].components).toEqual([
      comp('a', 'INPUT', { label: 'A' }),
      comp('c', 'CLOCK', { period: 20 }),
    ]);
    expect(project.circuits[0].components[0].on).toBe(true);
  });
});
