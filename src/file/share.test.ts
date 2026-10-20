import { describe, expect, it } from 'vitest';
import { emptyProject, MAIN_ID, type Project, withoutSwitchStates } from '../circuit/project';
import { parseProject, serializeProject } from './share';
import { type StoredProject, toStoredProject } from './storage';

/** アプリの中の形のプロジェクト。位置は px で、メイン回路の名前は空文字 */
const project: Project = {
  folders: [],
  circuits: [
    {
      id: MAIN_ID,
      name: '',
      path: '',
      author: '',
      package: { kind: 'split' },
      sheet: { width: 40, height: 30 },
      // biome-ignore format: 表形式を維持するため
      parts: [
        { id: 'a', kind: 'input', x: 0, y: 0, on: true, portNumber: 1 },
        { id: 'm', kind: 'module', x: 100, y: 0, circuitId: 'mod' },
      ],
      // a の出力ピンの先 (60, 20) から、m の入力ピンの先 (80, 20) へ
      // biome-ignore format: 表形式を維持するため
      wires: [{ id: 'w', points: [{ x: 60, y: 20 }, { x: 80, y: 20 }] }],
    },
    {
      id: 'mod',
      name: 'モジュール1',
      path: '',
      author: '',
      package: { kind: 'split' },
      sheet: { width: 300, height: 200 },
      parts: [{ id: 'i', kind: 'input', x: 0, y: 0, portNumber: 1 }],
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

/** 一体の形式 version 4 のプロジェクトファイル。p は保存の形 (位置はマス) で渡す */
function integratedV4(p: unknown): string {
  return JSON.stringify({ app: 'sazanka', version: 4, project: p });
}

/** 保存の形のプロジェクトと、そのメイン回路 */
const stored = toStoredProject(project);
const storedMain = stored.circuits[0].circuit;

/** メイン回路の要素を elements にしたもの (2 つ目以降のモジュールはそのまま) */
function withMainElements(elements: unknown[]): string {
  return JSON.stringify({
    ...stored,
    circuits: [{ path: '', circuit: { ...storedMain, elements } }, stored.circuits[1]],
  });
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
  it('書き出すと、プロジェクトの形式のデータそのものになる (外側の包みはない)', () => {
    const data = JSON.parse(serializeProject(project));
    expect(data).toEqual(toStoredProject(withoutSwitchStates(project)));
    expect(data).toMatchObject({ format: 'sazanka-project', version: 1 });
    expect(data).not.toHaveProperty('app');
  });

  it('書き出すと、部品と配線を 1 つの一覧にし、位置はマスになり、メイン回路の名前と部品と配線の ID は書かず、配線に種類を書く', () => {
    expect((JSON.parse(serializeProject(project)) as StoredProject).circuits[0].circuit).toEqual({
      format: 'sazanka-circuit',
      version: 1,
      id: MAIN_ID,
      author: '',
      package: { kind: 'split' },
      sheet: { width: 40, height: 30 },
      // biome-ignore format: 表形式を維持するため
      elements: [
        { kind: 'input', x: 0, y: 0, portNumber: 1 }, // ON/OFF (on) は書き出さない
        { kind: 'module', x: 5, y: 0, circuitId: 'mod', circuitName: 'モジュール1' },
        { kind: 'wire', points: [{ x: 3, y: 1 }, { x: 4, y: 1 }] },
      ],
    });
  });

  it('読み込んでも、回路の ID は付け直さない。部品と配線には新しい ID を付ける', () => {
    const [main, mod] = project.circuits;
    // 新しい ID は、回路ごとに部品、配線の順に付ける
    expect(parse(serializeProject(project))).toEqual({
      ok: true,
      project: {
        folders: [],
        circuits: [
          {
            ...main,
            parts: [
              { id: 'id1', kind: 'input', x: 0, y: 0, portNumber: 1 },
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

  it('作者名は、モジュールごとに書き出して読み込む', () => {
    const authored: Project = {
      ...project,
      circuits: project.circuits.map((d) => ({ ...d, author: `${d.id} の作者` })),
    };
    const text = serializeProject(authored);
    expect((JSON.parse(text) as StoredProject).circuits.map((e) => e.circuit.author)).toEqual([
      'main の作者',
      'mod の作者',
    ]);
    const result = parse(text);
    expect(result.ok && result.project.circuits.map((d) => d.author)).toEqual([
      'main の作者',
      'mod の作者',
    ]);
  });

  it('JSON でないもの、sazanka のデータでないものは読み込まず、理由を返す', () => {
    expect(parse('abc')).toEqual({ ok: false, error: { code: 'NOT_JSON' } });
    for (const text of ['{"circuits":[]}', '1', '{"format":"other","version":1}']) {
      expect(parse(text)).toEqual({ ok: false, error: { code: 'NOT_SAZANKA' } });
    }
  });

  it('モジュールのデータやモジュールファイルは、種類が違うので読み込まない', () => {
    for (const format of ['sazanka-circuit', 'sazanka-circuits']) {
      expect(parse(JSON.stringify({ format, version: 1 }))).toEqual({
        ok: false,
        error: { code: 'CIRCUIT_FILE' },
      });
    }
    expect(parse(JSON.stringify(storedMain))).toEqual({
      ok: false,
      error: { code: 'CIRCUIT_FILE' },
    });
  });

  it('新しい版のデータは読み込まない', () => {
    const newer: unknown[] = [
      { app: 'sazanka', version: 99, project },
      { ...stored, version: 2 },
      { ...stored, circuits: [{ path: '', circuit: { ...storedMain, version: 2 } }] },
    ];
    for (const data of newer) {
      expect(parse(JSON.stringify(data))).toEqual({ ok: false, error: { code: 'NEWER_VERSION' } });
    }
  });

  it('壊れた回路データは読み込まない', () => {
    const [input, module, wire] = storedMain.elements;
    const broken = [
      { ...stored, circuits: [] },
      { ...stored, circuits: [{ path: '', circuit: { ...storedMain, id: 'x' } }] },
      // 置けない種類の部品、位置が数でない部品
      {
        ...stored,
        circuits: [
          { path: '', circuit: { ...storedMain, elements: [{ kind: 'buf', x: 0, y: 0 }] } },
        ],
      },
      {
        ...stored,
        circuits: [
          { path: '', circuit: { ...storedMain, elements: [{ kind: 'and', x: '0', y: 0 }] } },
        ],
      },
      // 存在しないモジュールへの参照
      { ...stored, circuits: [stored.circuits[0]] },
      // 知らない種類の要素
      JSON.parse(withMainElements([input, module, { ...wire, kind: 'bus' }])),
      // 回路 ID の重複
      { ...stored, circuits: [...stored.circuits, stored.circuits[1]] },
      // 位置がマスの途中
      JSON.parse(withMainElements([{ ...input, x: 0.5 }, module, wire])),
    ];
    for (const p of broken) {
      expect(parse(JSON.stringify(p))).toMatchObject({ ok: false, error: { code: 'BROKEN' } });
    }
  });

  it('INPUT / CLOCK の ON/OFF は書き出さず、読み込んでも使わない', () => {
    expect(serializeProject(project)).not.toContain('"on"');
    // ON/OFF を含む古いデータを読み込んでも、OFF から始まる
    const old = JSON.stringify({ app: 'sazanka', version: 2, project: projectV2 });
    const result = parse(old);
    expect(result.ok && result.project.circuits[0].parts[0].on).toBeUndefined();
  });

  it('ポート名やモジュールの参照は保ったまま往復する', () => {
    const result = parse(serializeProject(project));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const [main] = result.project.circuits;
    expect(main.parts[0]).toMatchObject({ kind: 'input', x: 0, y: 0 });
    expect(main.parts[1]).toMatchObject({ kind: 'module', circuitId: 'mod' });
    expect(result.project.circuits[1].id).toBe('mod');
  });

  it('フォルダとパスを保ったまま往復する', () => {
    const inFolders: Project = {
      folders: ['lib', 'lib/gates'],
      circuits: [project.circuits[0], { ...project.circuits[1], path: 'lib/gates' }],
    };
    const result = parse(serializeProject(inFolders));
    expect(result.ok && result.project.folders).toEqual(['lib', 'lib/gates']);
    expect(result.ok && result.project.circuits.map((d) => d.path)).toEqual(['', 'lib/gates']);
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
      [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    ]) {
      expect(parse(withMainElements([{ kind: 'wire', points: bad }])).ok).toBe(false);
    }
  });
});

describe('一体の形式のデータ', () => {
  it('version 4 のプロジェクトファイルは、新しい形式に変えて読み込む', () => {
    // biome-ignore format: 表形式を維持するため
    const v4 = {
      circuits: [
        { id: MAIN_ID, elements: [
          { kind: 'input', x: 0, y: 0, portNumber: 1 },
          { kind: 'module', x: 5, y: 0, module: 'mod' },
          { kind: 'wire', points: [{ x: 3, y: 1 }, { x: 4, y: 1 }] },
        ] },
        { id: 'mod', name: 'モジュール1', package: { kind: 'split' }, elements: [
          { kind: 'input', x: 0, y: 0, portNumber: 1 },
        ] },
      ],
    };
    expect(parse(integratedV4(v4))).toEqual(
      parse(
        serializeProject({
          ...project,
          circuits: [
            { ...project.circuits[0], sheet: { width: 300, height: 200 } },
            project.circuits[1],
          ],
        }),
      ),
    );
  });

  it('ポート番号がないものや重なるものは、読み込むときに付け直す (split のモジュールとメイン回路は、そのあと位置の順に振り直す)', () => {
    // biome-ignore format: 表形式を維持するため
    const elements = [
      { kind: 'input', x: 0, y: 5, portNumber: 1 },
      { kind: 'input', x: 0, y: 0, portNumber: 1 },
      { kind: 'input', x: 0, y: 10 },
      { kind: 'output', x: 0, y: 0 },
    ];
    const dip = { id: 'd', name: 'D', package: { kind: 'dip', pins: 4 }, elements };
    const result = parse(integratedV4({ circuits: [{ id: MAIN_ID, elements }, dip] }));
    // メイン回路は位置の順に 1 から振り直す
    expect(result.ok && result.project.circuits[0].parts.map((c) => c.portNumber)).toEqual([
      2, 1, 3, 1,
    ]);
    // dip のモジュールは振り直さず、ないものと、位置の順で後ろの重なるものに、空いているいちばん小さい番号を付ける
    expect(result.ok && result.project.circuits[1].parts.map((c) => c.portNumber)).toEqual([
      2, 1, 3, 1,
    ]);
    // 正しくない番号 (0) は付け直さず、検証で断る
    const zero = { ...dip, elements: [{ ...elements[0], portNumber: 0 }] };
    expect(parse(integratedV4({ circuits: [{ id: MAIN_ID, elements: [] }, zero] })).ok).toBe(false);
  });

  it('version 2 のデータは、新しい形式に変えて読み込む', () => {
    const result = parse(JSON.stringify({ app: 'sazanka', version: 2, project: projectV2 }));
    const [main, mod] = withoutSwitchStates(project).circuits;
    // モジュールの回路の ID は version 3 → 4 の変換で付け直す (id1)。
    // 部品と配線の ID は、そのあとの読み込みで、回路ごとに部品、配線の順に付ける。
    // version 2 にはシートの大きさがないので、どの回路も 300×200 になる
    expect(result).toEqual({
      ok: true,
      project: {
        folders: [],
        circuits: [
          {
            ...main,
            sheet: { width: 300, height: 200 },
            // biome-ignore format: 表形式を維持するため
            parts: [
              { ...main.parts[0], id: 'id2' },
              { ...main.parts[1], id: 'id3', circuitId: 'id1' },
            ],
            wires: [{ ...main.wires[0], id: 'id4' }],
          },
          { ...mod, id: 'id1', parts: [{ ...mod.parts[0], id: 'id5' }] },
        ],
      },
    });
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

describe('CLOCK の周期', () => {
  it('範囲外の周期を持つ部品は読み込まない', () => {
    const clock = { kind: 'clock', x: 1, y: 0, period: 0 };
    expect(parse(withMainElements([clock])).ok).toBe(false);
  });

  it('一体の形式で周期がない CLOCK は、100 にして読み込む', () => {
    const v4 = { circuits: [{ id: MAIN_ID, elements: [{ kind: 'clock', x: 1, y: 0 }] }] };
    const result = parse(integratedV4(v4));
    expect(result.ok && result.project.circuits[0].parts[0].period).toBe(100);
  });
});
