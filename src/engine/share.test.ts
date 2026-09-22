import { describe, expect, it } from 'vitest';
import { emptyProject, MAIN_ID, type Project } from './project';
import { parseProject, serializeProject } from './share';

const project: Project = {
  circuits: [
    {
      id: MAIN_ID,
      name: 'メイン',
      components: [
        { id: 'a', kind: 'INPUT', x: 0, y: 0, on: true },
        { id: 'm', kind: 'CUSTOM', x: 100, y: 0, custom: 'mod' },
      ],
      wires: [{ id: 'w', from: { comp: 'a', pin: 0 }, to: { comp: 'm', pin: 0 } }],
    },
    { id: 'mod', name: 'モジュール1', components: [{ id: 'i', kind: 'INPUT', x: 0, y: 0 }], wires: [] },
  ],
};

function withProject(p: unknown): string {
  return JSON.stringify({ app: 'sazanka', version: 1, project: p });
}

/** 呼ぶたびに id1, id2, … を返す ID の作り方 (テスト用) */
function counter(): () => string {
  let n = 0;
  return () => `id${++n}`;
}

function parse(text: string) {
  return parseProject(text, counter());
}

describe('share', () => {
  it('書き出すと、部品と配線の ID は回路ごとの連番 (part-1、wire-1、…) になる', () => {
    const [main, mod] = project.circuits;
    expect(JSON.parse(serializeProject(project)).project).toEqual({
      circuits: [
        {
          ...main,
          components: [
            { id: 'part-1', kind: 'INPUT', x: 0, y: 0 }, // ON/OFF (on) は書き出さない
            { ...main.components[1], id: 'part-2' },
          ],
          wires: [{ id: 'wire-1', from: { comp: 'part-1', pin: 0 }, to: { comp: 'part-2', pin: 0 } }],
        },
        { ...mod, components: [{ ...mod.components[0], id: 'part-1' }] },
      ],
    });
  });

  it('読み込むと、部品と配線の ID を付け直し、配線の接続先も合わせる', () => {
    const [main, mod] = project.circuits;
    expect(parse(serializeProject(project))).toEqual({
      ok: true,
      project: {
        circuits: [
          {
            ...main,
            components: [
              { id: 'id1', kind: 'INPUT', x: 0, y: 0 },
              { ...main.components[1], id: 'id2' },
            ],
            wires: [{ id: 'id3', from: { comp: 'id1', pin: 0 }, to: { comp: 'id2', pin: 0 } }],
          },
          { ...mod, components: [{ ...mod.components[0], id: 'id4' }] },
        ],
      },
    });
    expect(parse(serializeProject(emptyProject()))).toEqual({ ok: true, project: emptyProject() });
  });

  it('作者名はプロジェクトの中に入れて書き出す。空なら含めない', () => {
    const text = serializeProject({ ...project, author: ' さざんか ' });
    expect(JSON.parse(text).project.author).toBe('さざんか');
    expect(parse(text)).toMatchObject({ ok: true, project: { author: 'さざんか' } });
    expect(JSON.parse(serializeProject({ ...project, author: '  ' })).project).not.toHaveProperty('author');
    expect(parse(withProject({ ...project, author: 1 })).ok).toBe(false);
  });

  it('JSON でないもの、sazanka のデータでないものは読み込まない', () => {
    expect(parse('abc').ok).toBe(false);
    expect(parse('{"circuits":[]}').ok).toBe(false);
  });

  it('新しい版のデータは読み込まない', () => {
    expect(parse(JSON.stringify({ app: 'sazanka', version: 99, project })).ok).toBe(false);
  });

  it('壊れた回路データは読み込まない', () => {
    const main = project.circuits[0];
    const broken = [
      { circuits: [] },
      { circuits: [{ ...main, id: 'x' }] },
      { circuits: [{ ...main, components: [{ id: 'a', kind: 'BUF', x: 0, y: 0 }], wires: [] }] },
      { circuits: [{ ...main, components: [{ id: 'a', kind: 'AND', x: '0', y: 0 }], wires: [] }] },
      { circuits: [{ ...main, wires: [{ id: 'w', from: { comp: 'zz', pin: 0 }, to: { comp: 'm', pin: 0 } }] }] },
      // 存在しないモジュールへの参照
      { circuits: [main] },
      // 部品 ID の重複
      { circuits: [{ ...main, components: [main.components[0], main.components[0]], wires: [] }] },
      // 回路 ID の重複
      { circuits: [main, project.circuits[1], project.circuits[1]] },
    ];
    for (const p of broken) expect(parse(withProject(p)).ok).toBe(false);
  });

  it('INPUT / CLOCK の ON/OFF は書き出さず、読み込んでも使わない', () => {
    expect(serializeProject(project)).not.toContain('"on"');
    // ON/OFF を含む古いデータを読み込んでも、OFF から始まる
    const old = JSON.stringify({ app: 'sazanka', version: 1, project });
    const result = parse(old);
    expect(result.ok && result.project.circuits[0].components[0].on).toBeUndefined();
  });

  it('ラベルやモジュールの参照は保ったまま往復する', () => {
    const result = parse(serializeProject(project));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [main] = result.project.circuits;
    expect(main.components[0]).toMatchObject({ kind: 'INPUT', x: 0, y: 0 });
    expect(main.components[1]).toMatchObject({ kind: 'CUSTOM', custom: 'mod' });
    // モジュールの参照先 (回路の ID) は付け直さない
    expect(result.project.circuits[1].id).toBe('mod');
  });
});

describe('配線の折れる点', () => {
  const withPoints: Project = {
    circuits: [
      { ...project.circuits[0], wires: [{ ...project.circuits[0].wires[0], points: [{ x: 60, y: 100 }] }] },
      project.circuits[1],
    ],
  };

  it('書き出して読み込んでも、折れる点を保つ', () => {
    const result = parse(serializeProject(withPoints));
    expect(result.ok && result.project.circuits[0].wires[0].points).toEqual([{ x: 60, y: 100 }]);
  });

  it('折れる点の形が正しくなければ読み込まない', () => {
    const wire = { ...withPoints.circuits[0].wires[0], points: [{ x: '1', y: 0 }] };
    const broken = { circuits: [{ ...withPoints.circuits[0], wires: [wire] }, project.circuits[1]] };
    expect(parse(withProject(broken)).ok).toBe(false);
  });
});

describe('CLOCK の周期', () => {
  it('範囲外の周期を持つ部品は読み込まない', () => {
    const main = project.circuits[0];
    const broken = {
      circuits: [
        { ...main, components: [{ id: 'c', kind: 'CLOCK', x: 20, y: 0, period: 0 }], wires: [] },
        project.circuits[1],
      ],
    };
    expect(parse(withProject(broken)).ok).toBe(false);
  });
});
