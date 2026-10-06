import { describe, expect, it } from 'vitest';
import { emptyProject, MAIN_ID, type Project, withoutSwitchStates } from '../circuit/project';
import { parseProject, serializeProject } from './share';

const project: Project = {
  circuits: [
    {
      id: MAIN_ID,
      name: 'メイン',
      // biome-ignore format: 表形式を維持するため
      parts: [
        { id: 'a', kind: 'input', x: 0, y: 0, on: true },
        { id: 'm', kind: 'module', x: 100, y: 0, module: 'mod' },
      ],
      // a の出力ピンの先 (60, 20) から、m の入力ピンの先 (80, 20) へ
      // biome-ignore format: 表形式を維持するため
      wires: [{ id: 'w', points: [{ x: 60, y: 20 }, { x: 80, y: 20 }] }],
    },
    {
      id: 'mod',
      name: 'モジュール1',
      footprint: { kind: 'split' },
      parts: [{ id: 'i', kind: 'input', x: 0, y: 0 }],
      wires: [],
    },
  ],
};

/** 上の project を version 2 の形で書いたもの (部品の一覧は components、種類の名前は大文字、モジュールの参照は custom) */
const projectV2 = {
  circuits: [
    {
      id: MAIN_ID,
      name: 'メイン',
      // biome-ignore format: 表形式を維持するため
      components: [
        { id: 'a', kind: 'INPUT', x: 0, y: 0, on: true },
        { id: 'm', kind: 'CUSTOM', x: 100, y: 0, custom: 'mod' },
      ],
      // biome-ignore format: 表形式を維持するため
      wires: [{ id: 'w', points: [{ x: 60, y: 20 }, { x: 80, y: 20 }] }],
    },
    {
      id: 'mod',
      name: 'モジュール1',
      components: [{ id: 'i', kind: 'INPUT', x: 0, y: 0 }],
      wires: [],
    },
  ],
};

function withProject(p: unknown): string {
  return JSON.stringify({ app: 'sazanka', version: 3, project: p });
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
          parts: [
            { id: 'part-1', kind: 'input', x: 0, y: 0 }, // ON/OFF (on) は書き出さない
            { ...main.parts[1], id: 'part-2' },
          ],
          wires: [{ ...main.wires[0], id: 'wire-1' }],
        },
        { ...mod, parts: [{ ...mod.parts[0], id: 'part-1' }] },
      ],
    });
  });

  it('読み込むと、部品と配線の ID を付け直す', () => {
    const [main, mod] = project.circuits;
    expect(parse(serializeProject(project))).toEqual({
      ok: true,
      project: {
        circuits: [
          {
            ...main,
            // biome-ignore format: 表形式を維持するため
            parts: [
              { id: 'id1', kind: 'input', x: 0, y: 0 },
              { ...main.parts[1], id: 'id2' },
            ],
            wires: [{ ...main.wires[0], id: 'id3' }],
          },
          { ...mod, parts: [{ ...mod.parts[0], id: 'id4' }] },
        ],
      },
    });
    expect(parse(serializeProject(emptyProject()))).toEqual({
      ok: true,
      project: emptyProject(),
    });
  });

  it('作者名はプロジェクトの中に入れて書き出す。空なら含めない', () => {
    const text = serializeProject({ ...project, author: ' さざんか ' });
    expect(JSON.parse(text).project.author).toBe('さざんか');
    expect(parse(text)).toMatchObject({
      ok: true,
      project: { author: 'さざんか' },
    });
    expect(JSON.parse(serializeProject({ ...project, author: '  ' })).project).not.toHaveProperty(
      'author',
    );
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
      {
        circuits: [
          {
            ...main,
            parts: [{ id: 'a', kind: 'buf', x: 0, y: 0 }],
            wires: [],
          },
        ],
      },
      {
        circuits: [
          {
            ...main,
            parts: [{ id: 'a', kind: 'and', x: '0', y: 0 }],
            wires: [],
          },
        ],
      },
      {
        circuits: [
          {
            ...main,
            // 点が 1 つしかない配線
            wires: [{ id: 'w', points: [{ x: 0, y: 0 }] }],
          },
        ],
      },
      // 存在しないモジュールへの参照
      { circuits: [main] },
      // 部品 ID の重複
      {
        circuits: [
          {
            ...main,
            parts: [main.parts[0], main.parts[0]],
            wires: [],
          },
        ],
      },
      // 回路 ID の重複
      { circuits: [main, project.circuits[1], project.circuits[1]] },
    ];
    for (const p of broken) {
      expect(parse(withProject(p)).ok).toBe(false);
    }
  });

  it('INPUT / CLOCK の ON/OFF は書き出さず、読み込んでも使わない', () => {
    expect(serializeProject(project)).not.toContain('"on"');
    // ON/OFF を含む古いデータを読み込んでも、OFF から始まる
    const old = JSON.stringify({ app: 'sazanka', version: 2, project: projectV2 });
    const result = parse(old);
    expect(result.ok && result.project.circuits[0].parts[0].on).toBeUndefined();
  });

  it('ラベルやモジュールの参照は保ったまま往復する', () => {
    const result = parse(serializeProject(project));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const [main] = result.project.circuits;
    expect(main.parts[0]).toMatchObject({ kind: 'input', x: 0, y: 0 });
    expect(main.parts[1]).toMatchObject({ kind: 'module', module: 'mod' });
    // モジュールの参照先 (回路の ID) は付け直さない
    expect(result.project.circuits[1].id).toBe('mod');
  });
});

describe('配線の点', () => {
  // biome-ignore format: 表形式を維持するため
  const points = [{ x: 60, y: 20 }, { x: 60, y: 100 }, { x: 300, y: 100 }];
  const withPoints: Project = {
    circuits: [{ ...project.circuits[0], wires: [{ id: 'w', points }] }, project.circuits[1]],
  };

  it('書き出して読み込んでも、点の並びを保つ', () => {
    const result = parse(serializeProject(withPoints));
    expect(result.ok && result.project.circuits[0].wires[0].points).toEqual(points);
  });

  it('点の形が正しくないか、斜めの区間があれば読み込まない', () => {
    // biome-ignore format: 表形式を維持するため
    for (const bad of [
      [{ x: '1', y: 0 }, { x: 0, y: 0 }],
      [{ x: 0, y: 0 }, { x: 20, y: 20 }],
    ]) {
      const broken = {
        circuits: [{ ...project.circuits[0], wires: [{ id: 'w', points: bad }] }, project.circuits[1]],
      };
      expect(parse(withProject(broken)).ok).toBe(false);
    }
  });
});

describe('古い版のデータ', () => {
  it('version 2 のデータは、version 3 の形に変えて読み込む', () => {
    const result = parse(JSON.stringify({ app: 'sazanka', version: 2, project: projectV2 }));
    expect(result.ok && withoutIds(result.project)).toEqual(
      withoutIds(withoutSwitchStates(project)),
    );
  });

  it('version 1 のデータは、配線を version 1 で描いていた形の点の並びに変えて読み込む', () => {
    const [main, mod] = projectV2.circuits;
    const v1 = {
      circuits: [
        { ...main, wires: [{ id: 'w', from: { comp: 'a', pin: 0 }, to: { comp: 'm', pin: 0 } }] },
        mod,
      ],
    };
    const result = parse(JSON.stringify({ app: 'sazanka', version: 1, project: v1 }));
    expect(result.ok && result.project.circuits[0].wires[0].points).toEqual(
      project.circuits[0].wires[0].points,
    );
  });
});

/** 部品と配線の ID を除いたプロジェクト。読み込むと ID は付け直されるので、比べるときに使う */
function withoutIds(p: Project) {
  return p.circuits.map(({ parts, wires, ...d }) => ({
    ...d,
    parts: parts.map(({ id: _, ...c }) => c),
    wires: wires.map(({ id: _, ...w }) => w),
  }));
}

describe('CLOCK の周期', () => {
  it('範囲外の周期を持つ部品は読み込まない', () => {
    const main = project.circuits[0];
    const broken = {
      circuits: [
        {
          ...main,
          parts: [{ id: 'c', kind: 'clock', x: 20, y: 0, period: 0 }],
          wires: [],
        },
        project.circuits[1],
      ],
    };
    expect(parse(withProject(broken)).ok).toBe(false);
  });
});
