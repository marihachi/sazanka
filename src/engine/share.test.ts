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
            { ...main.components[0], id: 'part-1' },
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
              { ...main.components[0], id: 'id1' },
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

  it('作者名を入れて書き出し、読み込むと作者名も返す。空なら含めない', () => {
    const text = serializeProject(project, ' さざんか ');
    expect(JSON.parse(text).author).toBe('さざんか');
    expect(parse(text)).toMatchObject({ ok: true, author: 'さざんか' });
    expect(JSON.parse(serializeProject(project, '  '))).not.toHaveProperty('author');
    expect(parse(JSON.stringify({ app: 'sazanka', version: 1, author: 1, project })).ok).toBe(false);
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
});
