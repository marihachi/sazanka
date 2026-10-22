import { describe, expect, it } from 'vitest';
import type { Part } from '../circuit/part';
import { checkProject, emptyProject, type Project } from '../circuit/project';
import { assignPortNumbers } from '../circuit/module';
import { newPart } from '../editing/edit';
import { PART_SPECS } from '../parts/specs';
import {
  fromStoredProject,
  readStored,
  readTicksPerSecond,
  type StoredProject,
  toStoredProject,
} from './storage';

const project = emptyProject();

/** 呼ぶたびに id1, id2, … を返す ID の作り方 (テスト用) */
function counter(): () => string {
  let n = 0;
  return () => `id${++n}`;
}

function read(raw: string | null) {
  return readStored(raw, counter());
}

/** アプリの中の形のプロジェクト。位置は px (1 マス 20px) */
const withModule: Project = {
  folders: ['lib'],
  circuits: [
    {
      id: 'main',
      name: '',
      path: '',
      author: '',
      package: { kind: 'split' },
      sheet: { width: 40, height: 30 },
      // biome-ignore format: 表形式を維持するため
      parts: [
        { id: 'a', kind: 'input', x: 0, y: 20, portName: 'A', portNumber: 1 },
        { id: 'm', kind: 'module', x: 100, y: 0, circuitId: 'mod', rotation: 90 },
      ],
      // biome-ignore format: 表形式を維持するため
      wires: [{ id: 'w', points: [{ x: 60, y: 40 }, { x: 80, y: 40 }] }],
    },
    {
      id: 'mod',
      name: 'M',
      path: 'lib',
      author: 'さざんか',
      package: { kind: 'split' },
      sheet: { width: 300, height: 200 },
      parts: [{ id: 'i', kind: 'input', x: 40, y: 60, portNumber: 1 }],
      wires: [],
    },
  ],
};

/**
 * withModule を保存して読み込んだもの。部品と配線の ID は保存しないので、読み込むと新しい ID が付く
 * (counter で、回路ごとに部品、配線の順)
 */
const [main0, mod0] = withModule.circuits;
const loaded: Project = {
  folders: ['lib'],
  circuits: [
    {
      ...main0,
      parts: [
        { ...main0.parts[0], id: 'id1' },
        { ...main0.parts[1], id: 'id2' },
      ],
      wires: [{ ...main0.wires[0], id: 'id3' }],
    },
    { ...mod0, parts: [{ ...mod0.parts[0], id: 'id4' }] },
  ],
};

/** 部品から ID を外したもの (保存の形) */
function withoutId<T extends { id: string }>({ id: _, ...rest }: T) {
  return rest;
}

describe('toStoredProject / fromStoredProject', () => {
  it('保存するときは、回路を要素の並びにし、部品と配線を 1 つの一覧にし、位置をマスにし、メイン回路の名前と部品と配線の ID を外し、配線に種類を書き、モジュールの部品に名前の写しを書く', () => {
    const [main, mod] = withModule.circuits;
    expect(toStoredProject(withModule)).toEqual({
      format: 'sazanka-project',
      version: 1,
      folders: ['lib'],
      circuits: [
        {
          path: '',
          circuit: {
            format: 'sazanka-circuit',
            version: 1,
            id: 'main',
            author: '',
            package: { kind: 'split' },
            sheet: { width: 40, height: 30 },
            // biome-ignore format: 表形式を維持するため
            elements: [
              { ...withoutId(main.parts[0]), x: 0, y: 1 },
              { ...withoutId(main.parts[1]), x: 5, y: 0, circuitName: 'M' },
              { kind: 'wire', points: [{ x: 3, y: 2 }, { x: 4, y: 2 }] },
            ],
          },
        },
        {
          path: 'lib',
          circuit: {
            format: 'sazanka-circuit',
            version: 1,
            id: 'mod',
            name: 'M',
            author: 'さざんか',
            package: { kind: 'split' },
            sheet: { width: 300, height: 200 },
            elements: [{ ...withoutId(mod.parts[0]), x: 2, y: 3 }],
          },
        },
      ],
    });
  });

  it('周期を持たない CLOCK (置いたばかりのもの) には、既定の周期を書く', () => {
    const clock: Project = {
      circuits: [
        { id: 'main', name: '', parts: [{ id: 'c', kind: 'clock', x: 0, y: 0 }], wires: [] },
      ],
    };
    const stored = toStoredProject(clock);
    expect(stored.circuits[0].circuit.elements).toEqual([
      { kind: 'clock', x: 0, y: 0, period: 100 },
    ]);
    expect(checkProject(stored)).toBeUndefined();
  });

  it('どの種類の部品も、アプリで置いた形 (newPart と、置いたあとのポート番号) のまま保存すると、検証を通る', () => {
    // 保存データで省略できない項目 (CLOCK の周期、ポート番号、モジュールの名前の写し) を、置く操作が漏らしていないかを見る
    const kinds = [...PART_SPECS.map((s) => s.kind), 'input', 'output', 'clock', 'module'] as const;
    const parts = kinds.map((kind, i) =>
      newPart(`p${i}`, kind, { x: i * 200, y: 0 }, kind === 'module' ? 'mod' : undefined),
    );
    const placed = assignPortNumbers(
      { id: 'main', name: '', parts, wires: [] },
      new Set(parts.map((c) => c.id)),
    );
    const app: Project = {
      ...emptyProject(),
      circuits: [placed, { ...withModule.circuits[1], path: '' }],
    };
    expect(checkProject(toStoredProject(app))).toBeUndefined();
  });

  it('保存したものは検証を通る', () => {
    expect(checkProject(toStoredProject(withModule))).toBeUndefined();
    expect(checkProject(toStoredProject(project))).toBeUndefined();
  });

  it('パッケージ、シートの大きさ、作者名、パスを持たない回路 (テストで作ったもの) には、split、300×200、空文字を書く', () => {
    const bare: Project = { circuits: [{ id: 'main', name: '', parts: [], wires: [] }] };
    expect(toStoredProject(bare)).toEqual({
      format: 'sazanka-project',
      version: 1,
      folders: [],
      circuits: [
        {
          path: '',
          circuit: {
            format: 'sazanka-circuit',
            version: 1,
            id: 'main',
            author: '',
            package: { kind: 'split' },
            sheet: { width: 300, height: 200 },
            elements: [],
          },
        },
      ],
    });
  });

  it('読み込むと元に戻り (一覧は種類で部品と配線に分かれる)、部品と配線に新しい ID が付く。メイン回路の名前は、あっても空文字にする', () => {
    expect(fromStoredProject(toStoredProject(withModule), counter())).toEqual(loaded);
    const stored = toStoredProject(withModule);
    const [main, mod] = stored.circuits;
    const named = {
      ...stored,
      circuits: [{ ...main, circuit: { ...main.circuit, name: 'メイン' } }, mod],
    };
    expect(fromStoredProject(named, counter())).toEqual(loaded);
  });

  it('名前の写し (circuitName) は読み込まない (指す回路の名前を使う)', () => {
    const stored = toStoredProject(withModule);
    const [main, mod] = stored.circuits;
    const renamed = {
      ...stored,
      circuits: [
        {
          ...main,
          circuit: {
            ...main.circuit,
            elements: main.circuit.elements.map((e) =>
              e.kind === 'module' ? { ...e, circuitName: '古い名前' } : e,
            ),
          },
        },
        mod,
      ],
    };
    expect(fromStoredProject(renamed, counter())).toEqual(loaded);
  });

  it('保存するときは、要素を種類の決まった順に並べる。同じ種類の中はアプリの中の順のまま', () => {
    const part = (id: string, kind: Part['kind'], x: number): Part => ({ id, kind, x, y: 0 });
    // biome-ignore format: 表形式を維持するため
    const shuffled: Project = { circuits: [{ id: 'main', name: '', wires: [
      { id: 'w', points: [{ x: 0, y: 0 }, { x: 20, y: 0 }] },
    ], parts: [
      part('m', 'module', 0),
      part('j', 'jkFlipFlop', 0),
      part('a1', 'and', 20),
      part('o', 'output', 0),
      part('c', 'clock', 0),
      part('a2', 'and', 40),
      part('i', 'input', 0),
      part('s', 'sevenSegment', 0),
    ] }] };
    const { elements } = toStoredProject(shuffled).circuits[0].circuit;
    expect(elements.map((e) => ('x' in e ? `${e.kind}${e.x}` : e.kind))).toEqual([
      'input0',
      'output0',
      'clock0',
      'and1',
      'and2',
      'jkFlipFlop0',
      'sevenSegment0',
      'module0',
      'wire',
    ]);
  });

  it('一覧の中で部品と配線が混ざっていても、種類で分け、それぞれの中の順を保つ', () => {
    const stored = toStoredProject(withModule);
    const [main, mod] = stored.circuits;
    const [input, module, wire] = main.circuit.elements;
    const mixed = {
      ...stored,
      circuits: [{ ...main, circuit: { ...main.circuit, elements: [wire, module, input] } }, mod],
    };
    const [loadedMain] = fromStoredProject(mixed, counter()).circuits;
    expect(loadedMain.parts.map((c) => c.kind)).toEqual(['module', 'input']);
    expect(loadedMain.wires).toHaveLength(1);
  });

  it('読み込むデータの部品と配線に ID があっても (重なっていても) 使わない', () => {
    const stored = toStoredProject(withModule);
    const withIds: StoredProject = {
      ...stored,
      circuits: stored.circuits.map((entry) => ({
        ...entry,
        circuit: {
          ...entry.circuit,
          elements: entry.circuit.elements.map((e) => ({ ...e, id: 'old' })),
        },
      })),
    };
    expect(read(JSON.stringify(withIds))).toEqual({ project: loaded });
  });

  it('読み込むと、回路の並びは要素の並びのまま (メイン回路が先頭でなくてもよい)', () => {
    const stored = toStoredProject(withModule);
    const reversed = { ...stored, circuits: [...stored.circuits].reverse() };
    expect(fromStoredProject(reversed, counter()).circuits.map((d) => d.id)).toEqual([
      'mod',
      'main',
    ]);
  });
});

describe('readStored', () => {
  it('保存データがなければ空のプロジェクト', () => {
    expect(read(null)).toEqual({ project: emptyProject() });
  });

  it('保存データを読み込む。回路の ID は付け直さない', () => {
    expect(read(JSON.stringify(toStoredProject(project)))).toEqual({ project });
    expect(read(JSON.stringify(toStoredProject(withModule)))).toEqual({ project: loaded });
  });

  it('一体の形式 version 4 の保存データは、新しい形式に変えて読み込む', () => {
    // biome-ignore format: 表形式を維持するため
    const v4 = {
      version: 4,
      project: {
        author: 'さざんか',
        circuits: [
          { id: 'main', elements: [
            { kind: 'input', x: 0, y: 1, portName: 'A', portNumber: 1 },
            { kind: 'module', x: 5, y: 0, module: 'mod' },
          ] },
          { id: 'mod', name: 'M', package: { kind: 'split' }, elements: [
            { kind: 'input', x: 2, y: 3 },
          ] },
        ],
      },
    };
    const result = read(JSON.stringify(v4));
    expect(result.error).toBeUndefined();
    expect(result.project).toEqual({
      folders: [],
      circuits: [
        {
          id: 'main',
          name: '',
          path: '',
          author: 'さざんか',
          package: { kind: 'split' },
          sheet: { width: 300, height: 200 },
          // biome-ignore format: 表形式を維持するため
          parts: [
            { id: 'id1', kind: 'input', x: 0, y: 20, portName: 'A', portNumber: 1 },
            { id: 'id2', kind: 'module', x: 100, y: 0, circuitId: 'mod' },
          ],
          wires: [],
        },
        {
          id: 'mod',
          name: 'M',
          path: '',
          author: 'さざんか',
          package: { kind: 'split' },
          sheet: { width: 300, height: 200 },
          parts: [{ id: 'id3', kind: 'input', x: 40, y: 60, portNumber: 1 }],
          wires: [],
        },
      ],
    });
  });

  it('version 1 のデータは、配線を点の並びに変えて読み込む', () => {
    const v1 = {
      circuits: [
        {
          id: 'main',
          name: 'メイン',
          // biome-ignore format: 表形式を維持するため
          components: [
            { id: 'a', kind: 'INPUT', x: 0, y: 0 },
            { id: 'o', kind: 'OUTPUT', x: 100, y: 0 },
          ],
          wires: [{ id: 'w', from: { comp: 'a', pin: 0 }, to: { comp: 'o', pin: 0 } }],
        },
      ],
    };
    const result = read(JSON.stringify({ version: 1, project: v1 }));
    expect(result.error).toBeUndefined();
    // a の出力ピンの先 (60, 20) と o の入力ピンの先 (80, 20) は同じ高さなので、まっすぐ結ぶ
    expect(result.project.circuits[0].wires.map((w) => w.points)).toEqual([
      [
        { x: 60, y: 20 },
        { x: 80, y: 20 },
      ],
    ]);
  });

  it('INPUT / CLOCK の ON/OFF は読み込まない (古いデータには入っている)', () => {
    const withSwitch = {
      circuits: [
        {
          id: 'main',
          name: 'メイン',
          components: [{ id: 'a', kind: 'INPUT', x: 20, y: 0, on: true }],
          wires: [],
        },
      ],
    };
    const result = read(JSON.stringify({ version: 2, project: withSwitch }));
    expect(result.error).toBeUndefined();
    expect(result.project.circuits[0].parts[0].on).toBeUndefined();
  });

  it('version 2 のデータは、新しい形式に変えて読み込む', () => {
    const v2 = {
      circuits: [
        {
          id: 'main',
          name: 'メイン',
          components: [{ id: 'm', kind: 'CUSTOM', x: 100, y: 0, custom: 'mod' }],
          wires: [],
        },
        { id: 'mod', name: 'M', components: [{ id: 'd', kind: 'DFF', x: 0, y: 0 }], wires: [] },
      ],
    };
    const result = read(JSON.stringify({ version: 2, project: v2 }));
    // ID は version 3 → 4 の変換で付け直す (モジュールの回路、メイン回路の部品、モジュールの部品の順)
    expect(result).toEqual({
      project: {
        folders: [],
        circuits: [
          {
            id: 'main',
            name: '',
            path: '',
            author: '',
            package: { kind: 'split' },
            sheet: { width: 300, height: 200 },
            parts: [{ id: 'id2', kind: 'module', x: 100, y: 0, circuitId: 'id1' }],
            wires: [],
          },
          {
            id: 'id1',
            name: 'M',
            path: '',
            author: '',
            package: { kind: 'split' },
            sheet: { width: 300, height: 200 },
            parts: [{ id: 'id3', kind: 'dFlipFlop', x: 0, y: 0 }],
            wires: [],
          },
        ],
      },
    });
  });

  it('新しい版のデータは読み込まず、理由を返す', () => {
    const stored = toStoredProject(project);
    for (const data of [
      { version: 99, project },
      { ...stored, version: 2 },
      {
        ...stored,
        circuits: [
          { ...stored.circuits[0], circuit: { ...stored.circuits[0].circuit, version: 2 } },
        ],
      },
    ]) {
      const result = read(JSON.stringify(data));
      expect(result.project).toEqual(emptyProject());
      expect(result.error).toEqual({ code: 'NEWER_VERSION' });
    }
  });

  it('壊れたデータは読み込まず、理由を返す', () => {
    const source = [
      '{',
      JSON.stringify(project),
      '{"version":1}',
      JSON.stringify({ version: 1, project: { circuits: [] } }),
      JSON.stringify({ ...toStoredProject(project), circuits: [] }),
      JSON.stringify({ format: 'sazanka-circuit', version: 1 }),
    ];
    // 版のない保存データ (以前の形式) も読み込まない
    for (const raw of source) {
      const result = read(raw);
      expect(result.project).toEqual(emptyProject());
      expect(result.error).toEqual({ code: 'BROKEN' });
    }
  });
});

describe('readTicksPerSecond', () => {
  it('保存した 1 秒の tick 数を読む', () => {
    expect(readTicksPerSecond({ ticksPerSecond: 100_000 })).toBe(100_000);
  });

  it('古い版の間隔 (tickMs) は、1 秒あたりに直して読む', () => {
    expect(readTicksPerSecond({ tickMs: 10 })).toBe(100);
    expect(readTicksPerSecond({ tickMs: 1 })).toBe(1000);
    expect(readTicksPerSecond({ tickMs: 1000 })).toBe(1);
    expect(readTicksPerSecond({ tickMs: 3 })).toBe(333);
  });

  it('両方あれば、1 秒の tick 数を使う', () => {
    expect(readTicksPerSecond({ ticksPerSecond: 50, tickMs: 10 })).toBe(50);
  });

  it('読めなければ既定値', () => {
    for (const value of [
      {},
      { ticksPerSecond: 0 },
      { ticksPerSecond: 100_001 },
      { ticksPerSecond: '100' },
      { tickMs: 0 },
      { tickMs: 1.5 },
      { tickMs: 1001 },
    ]) {
      expect(readTicksPerSecond(value)).toBe(100);
    }
  });

  it('指す回路がない (未解決の) 部品は、名前の写しを残し、保存するときもそのまま書く', () => {
    const stored = toStoredProject(withModule);
    const [main] = stored.circuits;
    const missing = {
      ...stored,
      circuits: [
        {
          ...main,
          circuit: {
            ...main.circuit,
            elements: main.circuit.elements.map((e) =>
              e.kind === 'module' ? { ...e, circuitId: 'gone', circuitName: '消えた回路' } : e,
            ),
          },
        },
      ],
    };
    const app = fromStoredProject(missing, counter());
    const part = app.circuits[0].parts.find((c) => c.kind === 'module');
    expect(part).toMatchObject({ circuitId: 'gone', circuitName: '消えた回路' });
    const again = toStoredProject(app).circuits[0].circuit.elements.find(
      (e) => e.kind === 'module',
    );
    expect(again).toMatchObject({ circuitId: 'gone', circuitName: '消えた回路' });
  });
});
