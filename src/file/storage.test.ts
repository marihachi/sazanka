import { describe, expect, it } from 'vitest';
import { emptyProject, type Project } from '../circuit/project';
import { fromStoredProject, readStored, readTicksPerSecond, toStoredProject } from './storage';

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
  circuits: [
    {
      id: 'main',
      name: '',
      sheet: { width: 40, height: 30 },
      // biome-ignore format: 表形式を維持するため
      parts: [
        { id: 'a', kind: 'input', x: 0, y: 20, portName: 'A', portNumber: 1 },
        { id: 'm', kind: 'module', x: 100, y: 0, module: 'mod' },
      ],
      // biome-ignore format: 表形式を維持するため
      wires: [{ id: 'w', points: [{ x: 60, y: 40 }, { x: 80, y: 40 }] }],
    },
    {
      id: 'mod',
      name: 'M',
      package: { kind: 'split' },
      sheet: { width: 300, height: 200 },
      parts: [{ id: 'i', kind: 'input', x: 40, y: 60, portNumber: 1 }],
      wires: [],
    },
  ],
};

describe('toStoredProject / fromStoredProject', () => {
  it('保存するときは、位置をマスにし、メイン回路の名前を外す', () => {
    const [main, mod] = withModule.circuits;
    const { name: _, ...mainWithoutName } = main;
    expect(toStoredProject(withModule)).toEqual({
      circuits: [
        {
          ...mainWithoutName,
          // biome-ignore format: 表形式を維持するため
          parts: [
            { ...main.parts[0], x: 0, y: 1 },
            { ...main.parts[1], x: 5, y: 0 },
          ],
          // biome-ignore format: 表形式を維持するため
          wires: [{ id: 'w', points: [{ x: 3, y: 2 }, { x: 4, y: 2 }] }],
        },
        { ...mod, parts: [{ ...mod.parts[0], x: 2, y: 3 }] },
      ],
    });
  });

  it('読み込むと元に戻る。メイン回路の名前は、あっても空文字にする', () => {
    expect(fromStoredProject(toStoredProject(withModule))).toEqual(withModule);
    const stored = toStoredProject(withModule);
    const named = {
      ...stored,
      circuits: [{ ...stored.circuits[0], name: 'メイン' }, stored.circuits[1]],
    };
    expect(fromStoredProject(named)).toEqual(withModule);
  });
});

describe('readStored', () => {
  it('保存データがなければ空のプロジェクト', () => {
    expect(read(null)).toEqual({ project: emptyProject() });
  });

  it('版付きの保存データを読み込む。ID は付け直さない', () => {
    expect(read(JSON.stringify({ version: 4, project: toStoredProject(project) }))).toEqual({
      project,
    });
    expect(read(JSON.stringify({ version: 4, project: toStoredProject(withModule) }))).toEqual({
      project: withModule,
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

  it('version 2 のデータは、version 4 の形に変えて読み込む', () => {
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
        circuits: [
          {
            id: 'main',
            name: '',
            sheet: { width: 300, height: 200 },
            parts: [{ id: 'id2', kind: 'module', x: 100, y: 0, module: 'id1' }],
            wires: [],
          },
          {
            id: 'id1',
            name: 'M',
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
    const result = read(JSON.stringify({ version: 99, project }));
    expect(result.project).toEqual(emptyProject());
    expect(result.error).toEqual({ code: 'NEWER_VERSION' });
  });

  it('壊れたデータは読み込まず、理由を返す', () => {
    const source = [
      '{',
      JSON.stringify(project),
      '{"version":1}',
      JSON.stringify({ version: 1, project: { circuits: [] } }),
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
});
