import { describe, expect, it } from 'vitest';
import type { Part } from './part';
import {
  checkCircuitName,
  checkProject,
  emptyProject,
  findDef,
  MAIN_ID,
  moveCircuit,
  type Project,
  withoutSwitchStates,
} from './project';

function comp(id: string, kind: Part['kind'], extra: Partial<Part> = {}): Part {
  return { id, kind, x: 0, y: 0, ...extra };
}

describe('emptyProject / findDef', () => {
  it('空のプロジェクトはメイン回路だけを持つ。メイン回路は split のパッケージを持ち、フォルダなしに置く', () => {
    const project = emptyProject();
    expect(project.circuits).toHaveLength(1);
    expect(project.circuits[0]).toMatchObject({
      id: MAIN_ID,
      path: '',
      author: '',
      package: { kind: 'split' },
      parts: [],
    });
    expect(project.folders).toEqual([]);
  });

  it('findDef は ID の回路を返し、なければ undefined', () => {
    const project = emptyProject();
    expect(findDef(project, MAIN_ID)).toBe(project.circuits[0]);
    expect(findDef(project, 'ない')).toBeUndefined();
    expect(findDef(project, undefined)).toBeUndefined();
  });
});

describe('checkProject', () => {
  // 検証は保存データの形 (プロジェクトの形式のデータ。部品と配線を 1 つの一覧 elements に並べ、部品は ID を持たなくてよい) で行う
  type Data = Record<string, unknown>;

  /** 回路の形式のデータ。メイン回路は名前を持たない */
  function mod(id: string, elements: unknown = [], extra: Data = {}): Data {
    return {
      format: 'sazanka-circuit',
      version: 1,
      id,
      ...(id === MAIN_ID ? {} : { name: id.toUpperCase() }),
      author: '',
      package: { kind: 'split' },
      sheet: { width: 300, height: 200 },
      elements,
      ...extra,
    };
  }

  /** プロジェクトの形式のデータ。circuits はフォルダなしに置く */
  function project(circuits: Data[], extra: Data = {}): Data {
    return {
      format: 'sazanka-project',
      version: 1,
      folders: [],
      circuits: circuits.map((circuit) => ({ path: '', circuit })),
      ...extra,
    };
  }

  function main(parts: unknown[], wires: unknown[] = []) {
    return project([mod(MAIN_ID, [...parts, ...wires])]);
  }

  /** メイン回路と、名前が M のモジュール m。部品は引数で渡す */
  function withModule(mainParts: unknown[], moduleParts: unknown[]) {
    return project([mod(MAIN_ID, mainParts), mod('m', moduleParts)]);
  }

  const port = (id: string, kind: 'input' | 'output', portNumber: number) =>
    comp(id, kind, { portNumber });
  const moduleOf = (id: string, circuitId: string, circuitName: string) => ({
    ...comp(id, 'module', { circuitId }),
    circuitName,
    circuitSize: { width: 4, height: 2 },
  });
  const 点 = (x: number, y: number) => ({ x, y });
  const empty = main([]);

  it('正しいプロジェクトは undefined', () => {
    expect(checkProject(empty)).toBeUndefined();
    expect(checkProject(main([comp('s', 'sevenSegment')]))).toBeUndefined();
    expect(checkProject(withModule([moduleOf('u', 'm', 'M')], []))).toBeUndefined();
  });

  it('部品の向きは 0 / 90 / 180 / 270 を通す', () => {
    for (const rotation of [0, 90, 180, 270] as const) {
      expect(checkProject(main([comp('a', 'and', { rotation })]))).toBeUndefined();
    }
  });

  it('メイン回路の名前は見ない (なくても、あっても通す)', () => {
    expect(checkProject(project([mod(MAIN_ID, [], { name: 1 })]))).toBeUndefined();
  });

  it('メイン回路は並びのどこにあってもよく、フォルダにも入れられる', () => {
    expect(checkProject(project([mod('m'), mod(MAIN_ID)]))).toBeUndefined();
    expect(
      checkProject({
        ...project([]),
        folders: ['a'],
        circuits: [{ path: 'a', circuit: mod(MAIN_ID) }],
      }),
    ).toBeUndefined();
  });

  it('部品の ID は見ない (保存しないので、重なっていても、なくてもよい)', () => {
    const { id: _, ...noId } = comp('x', 'or');
    expect(
      checkProject(
        withModule([comp('a', 'and'), comp('a', 'or')], [comp('a', 'or'), comp('m', 'or')]),
      ),
    ).toBeUndefined();
    expect(checkProject(main([noId]))).toBeUndefined();
  });

  it('配線の ID は見ない (保存しないので、重なっていても、なくてもよい)', () => {
    const wire = (id?: string) => ({
      ...(id ? { id } : {}),
      kind: 'wire',
      points: [点(0, 0), 点(1, 0)],
    });
    expect(checkProject(main([comp('a', 'and')], [wire('a'), wire('a'), wire()]))).toBeUndefined();
  });

  // biome-ignore format: 表形式を維持するため
  const 重なるもの: [string, unknown, string][] = [
    ['モジュールどうし', project([mod(MAIN_ID), mod('m'), mod('m', [], { name: 'N' })]), 'm'],
    ['メイン回路が 2 つ', project([mod(MAIN_ID), mod(MAIN_ID)]), MAIN_ID],
  ];
  for (const [name, value, id] of 重なるもの) {
    it(`ID の重なりを弾く: ${name}`, () => {
      expect(checkProject(value)).toEqual({ code: 'DUPLICATE_ID', id });
    });
  }

  describe('名前', () => {
    it('同じフォルダの中で名前が重なるものを弾く', () => {
      const data = project([
        mod(MAIN_ID),
        mod('a', [], { name: 'X' }),
        mod('b', [], { name: 'X' }),
      ]);
      expect(checkProject(data)).toEqual({ code: 'DUPLICATE_NAME', name: 'X', folder: '' });
    });

    it('違うフォルダなら、同じ名前でもよい。大文字と小文字は区別する', () => {
      const data = {
        ...project([]),
        folders: ['f'],
        circuits: [
          { path: '', circuit: mod(MAIN_ID) },
          { path: '', circuit: mod('a', [], { name: 'X' }) },
          { path: 'f', circuit: mod('b', [], { name: 'X' }) },
          { path: '', circuit: mod('c', [], { name: 'x' }) },
        ],
      };
      expect(checkProject(data)).toBeUndefined();
    });

    it('メイン回路以外で、名前が空 (空白だけを含む) のものを弾く', () => {
      for (const name of ['', '  ']) {
        expect(checkProject(project([mod(MAIN_ID), mod('m', [], { name })]))).toMatchObject({
          code: 'EMPTY_NAME',
          circuitId: 'm',
        });
      }
    });
  });

  describe('フォルダとパス', () => {
    function inFolders(folders: unknown, path = '') {
      return { ...project([]), folders, circuits: [{ path, circuit: mod(MAIN_ID) }] };
    }

    it('正しいフォルダの一覧と、そこにあるパスを通す', () => {
      expect(checkProject(inFolders(['a', 'a/b', '日本語 のフォルダ'], 'a/b'))).toBeUndefined();
    });

    // biome-ignore format: 表形式を維持するため
    const 正しくない一覧: [string, unknown, unknown][] = [
      ['一覧がない', undefined, { code: 'NO_FOLDERS' }],
      ['文字列でない', [1], { code: 'NO_FOLDERS' }],
      ['空文字', [''], { code: 'BAD_FOLDER', folder: '' }],
      ['先頭の /', ['/a'], { code: 'BAD_FOLDER', folder: '/a' }],
      ['末尾の /', ['a/'], { code: 'BAD_FOLDER', folder: 'a/' }],
      ['空の部分', ['a', 'a//b'], { code: 'BAD_FOLDER', folder: 'a//b' }],
      ['.', ['.'], { code: 'BAD_FOLDER', folder: '.' }],
      ['..', ['a', 'a/..'], { code: 'BAD_FOLDER', folder: 'a/..' }],
      ['重なり', ['a', 'a'], { code: 'BAD_FOLDER', folder: 'a' }],
      ['親が一覧にない', ['a/b'], { code: 'BAD_FOLDER', folder: 'a/b' }],
    ];
    for (const [name, folders, error] of 正しくない一覧) {
      it(`フォルダの一覧を弾く: ${name}`, () => {
        expect(checkProject(inFolders(folders))).toEqual(error);
      });
    }

    it('一覧にないフォルダを指す要素を弾く', () => {
      expect(checkProject(inFolders(['a'], 'b'))).toEqual({ code: 'MISSING_FOLDER', folder: 'b' });
    });

    it('パスが文字列でない要素を弾く', () => {
      expect(checkProject({ ...project([]), circuits: [{ circuit: mod(MAIN_ID) }] })).toEqual({
        code: 'BAD_ENTRY',
      });
    });
  });

  describe('ポート番号', () => {
    it('入力どうし・出力どうしで重ならなければ通す (入力と出力で同じ番号はよい)', () => {
      expect(
        checkProject(main([port('a', 'input', 1), port('b', 'input', 2), port('c', 'output', 1)])),
      ).toBeUndefined();
    });

    it('重なりを弾く', () => {
      expect(checkProject(main([port('a', 'input', 1), port('b', 'input', 1)]))).toEqual({
        code: 'DUPLICATE_PORT_NUMBER',
        circuit: '',
        circuitId: MAIN_ID,
      });
    });

    it('INPUT / OUTPUT にポート番号がないものを弾く', () => {
      expect(checkProject(main([comp('a', 'input')]))).toMatchObject({ code: 'BAD_ELEMENT' });
      expect(checkProject(main([comp('a', 'output')]))).toMatchObject({ code: 'BAD_ELEMENT' });
    });
  });

  // biome-ignore format: 表形式を維持するため
  const 壊れたもの: [string, unknown, string][] = [
    ['オブジェクトでない', [1, 2], 'NOT_PROJECT'],
    ['format がない', { ...empty, format: undefined }, 'NOT_PROJECT'],
    ['format がモジュール', { ...empty, format: 'sazanka-circuit' }, 'NOT_PROJECT'],
    ['版がない', { ...empty, version: undefined }, 'NOT_PROJECT'],
    ['一体の形式', { circuits: [{ id: MAIN_ID, elements: [] }] }, 'NOT_PROJECT'],
    ['モジュールの一覧がない', { ...empty, circuits: undefined }, 'NO_CIRCUITS'],
    ['要素がオブジェクトでない', { ...empty, circuits: [1] }, 'BAD_ENTRY'],
    ['メイン回路がない', project([mod('m')]), 'NO_MAIN'],
    ['モジュールに名前がない', project([mod(MAIN_ID), mod('m', [], { name: undefined })]), 'NO_CIRCUIT_ID_OR_NAME'],
    ['モジュールの format がない', project([mod(MAIN_ID, [], { format: undefined })]), 'NOT_CIRCUIT'],
    ['モジュールの版が整数でない', project([mod(MAIN_ID, [], { version: 1.5 })]), 'NOT_CIRCUIT'],
    ['作者名がない', project([mod(MAIN_ID, [], { author: undefined })]), 'AUTHOR_NOT_STRING'],
    ['作者名が文字列でない', project([mod(MAIN_ID, [], { author: 1 })]), 'AUTHOR_NOT_STRING'],
    ['メイン回路にパッケージがない', project([mod(MAIN_ID, [], { package: undefined })]), 'NO_PACKAGE'],
    ['シートの大きさがない', project([mod(MAIN_ID, [], { sheet: undefined })]), 'BAD_SHEET'],
    ['要素の一覧がない', project([mod(MAIN_ID, [], { elements: undefined, parts: [], wires: [] })]), 'NO_ELEMENTS'],
    ['部品の種類が不正', main([{ kind: 'FOO', x: 0, y: 0 }]), 'BAD_ELEMENT'],
    ['内部用の BUF が入っている', main([comp('a', 'buf')]), 'BAD_ELEMENT'],
    ['座標が数値でない', main([{ kind: 'and', x: '0', y: 0 }]), 'BAD_ELEMENT'],
    ['座標が整数でない (マスの途中)', main([comp('a', 'and', { x: 0.5 })]), 'BAD_ELEMENT'],
    ['配線の点が整数でない (マスの途中)', main([], [{ kind: 'wire', points: [点(0, 0.5), 点(1, 0.5)] }]), 'BAD_ELEMENT'],
    ['配線の点が 1 つ', main([], [{ kind: 'wire', points: [点(0, 0)] }]), 'BAD_ELEMENT'],
    ['配線の種類がない', main([], [{ points: [点(0, 0), 点(1, 0)] }]), 'BAD_ELEMENT'],
    ['配線の種類が知らない値', main([], [{ kind: 'bus', points: [点(0, 0), 点(1, 0)] }]), 'BAD_ELEMENT'],
    ['配線に斜めの区間がある', main([], [{ kind: 'wire', points: [点(0, 0), 点(1, 1)] }]), 'BAD_ELEMENT'],
    ['version 1 の形の配線', main([], [{ id: 'w', from: { comp: 'a', pin: 0 }, to: { comp: 'a', pin: 0 } }]), 'BAD_ELEMENT'],
    ['CLOCK に周期がない', main([comp('c', 'clock')]), 'BAD_ELEMENT'],
    ['モジュールの部品に circuitId がない', withModule([{ ...comp('u', 'module'), circuitName: 'M' }], []), 'BAD_ELEMENT'],
    ['モジュールの部品に名前の写しがない', withModule([comp('u', 'module', { circuitId: 'm' })], []), 'BAD_ELEMENT'],
    ['モジュールの部品に大きさの写しがない', withModule([{ ...comp('u', 'module', { circuitId: 'm' }), circuitName: 'M' }], []), 'BAD_ELEMENT'],
    ['大きさの写しが 0', withModule([{ ...moduleOf('u', 'm', 'M'), circuitSize: { width: 0, height: 2 } }], []), 'BAD_ELEMENT'],
    ['大きさの写しが整数でない', withModule([{ ...moduleOf('u', 'm', 'M'), circuitSize: { width: 4, height: 1.5 } }], []), 'BAD_ELEMENT'],
    ['ピン番号が整数でない', main([{ ...port('i', 'input', 1), pinNumber: 1.5 }]), 'BAD_ELEMENT'],
    ['ピン番号が数値でない', main([{ ...port('i', 'input', 1), pinNumber: '1' }]), 'BAD_ELEMENT'],
    ['向きが 90 度の倍数でない', main([{ ...comp('a', 'and'), rotation: 45 }]), 'BAD_ELEMENT'],
    ['向きが 360 度', main([{ ...comp('a', 'and'), rotation: 360 }]), 'BAD_ELEMENT'],
    ['向きが文字列', main([{ ...comp('a', 'and'), rotation: '90' }]), 'BAD_ELEMENT'],
  ];
  for (const [name, value, code] of 壊れたもの) {
    it(`壊れたデータを弾く: ${name}`, () => {
      expect(checkProject(value)).toMatchObject({ code });
    });
  }

  describe('パッケージ', () => {
    function withPackage(pkg: unknown) {
      return project([mod(MAIN_ID), mod('m', [], { package: pkg })]);
    }

    it('正しいパッケージなら undefined (メイン回路も、どの形でもよい)', () => {
      // biome-ignore format: 表形式を維持するため
      for (const f of [
        { kind: 'split' },
        { kind: 'dip', pins: 4 },
        { kind: 'dip', pins: 256 },
        { kind: 'qfp', pins: 8 },
        { kind: 'qfp', pins: 256 },
      ]) {
        expect(checkProject(withPackage(f))).toBeUndefined();
        expect(checkProject(project([mod(MAIN_ID, [], { package: f })]))).toBeUndefined();
      }
    });

    it('ない、または正しくないパッケージを弾く', () => {
      // biome-ignore format: 表形式を維持するため
      for (const f of [
        undefined,
        { kind: 'sip', pins: 8 },
        { kind: 'dip' },
        { kind: 'dip', pins: 2 },
        { kind: 'dip', pins: 7 },
        { kind: 'dip', pins: 258 },
        { kind: 'qfp', pins: 4 },
        { kind: 'qfp', pins: 10 },
        { kind: 'qfp', pins: 260 },
        { kind: 'dip', pins: 8.5 },
      ]) {
        expect(checkProject(withPackage(f))).toBeDefined();
      }
    });
  });

  describe('シートの大きさ', () => {
    function withSheet(sheet: unknown) {
      return project([mod(MAIN_ID, [], { sheet })]);
    }

    it('1 辺が 20〜1000 の整数なら undefined', () => {
      // biome-ignore format: 表形式を維持するため
      for (const s of [
        { width: 20, height: 20 },
        { width: 1000, height: 1000 },
        { width: 300, height: 200 },
      ]) {
        expect(checkProject(withSheet(s))).toBeUndefined();
      }
    });

    it('ないか、正しくない大きさを弾く', () => {
      // biome-ignore format: 表形式を維持するため
      for (const s of [
        undefined,
        null,
        { width: 300 },
        { width: 19, height: 200 },
        { width: 300, height: 1001 },
        { width: 300.5, height: 200 },
        { width: '300', height: 200 },
      ]) {
        // メイン回路は名前を持たないので、回路の名前は空文字 (画面の側が表示言語の名前にする)
        expect(checkProject(withSheet(s))).toEqual({
          code: 'BAD_SHEET',
          circuit: '',
          circuitId: MAIN_ID,
        });
      }
    });
  });
});

describe('checkCircuitName', () => {
  const project: Project = {
    circuits: [
      { id: 'main', name: '', parts: [], wires: [] },
      { id: 'a', name: 'A', parts: [], wires: [] },
      { id: 'b', name: 'B', parts: [], wires: [] },
    ],
  } as unknown as Project;

  it('空の名前は使えない', () => {
    expect(checkCircuitName(project, '', 'メイン')).toBe('EMPTY');
  });

  it('ほかの回路と同じ名前と、メイン回路の表示名は使えない', () => {
    expect(checkCircuitName(project, 'A', 'メイン')).toBe('TAKEN');
    expect(checkCircuitName(project, 'メイン', 'メイン')).toBe('TAKEN');
    expect(checkCircuitName(project, 'C', 'メイン')).toBeUndefined();
  });

  it('名前を変える回路自身の名前は、重なりに数えない', () => {
    expect(checkCircuitName(project, 'A', 'メイン', 'a')).toBeUndefined();
    expect(checkCircuitName(project, 'B', 'メイン', 'a')).toBe('TAKEN');
  });
});

describe('moveCircuit', () => {
  const project: Project = {
    circuits: ['main', 'a', 'b', 'c'].map((id) => ({
      id,
      name: id,
      parts: [],
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
        parts: [
          comp('a', 'input', { on: true, portName: 'A' }),
          comp('c', 'clock', { on: true, period: 20 }),
        ],
        wires: [],
      },
      { id: 'm', name: 'モジュール', parts: [comp('b', 'input', { on: false })], wires: [] },
    ],
  };

  it('すべての回路の INPUT / CLOCK から ON/OFF を外す', () => {
    const result = withoutSwitchStates(project);
    const comps = result.circuits.flatMap((d) => d.parts);
    expect(comps.every((c) => !('on' in c))).toBe(true);
  });

  it('ON/OFF 以外の項目は残し、元のプロジェクトは書き換えない', () => {
    const result = withoutSwitchStates(project);
    expect(result.circuits[0].parts).toEqual([
      comp('a', 'input', { portName: 'A' }),
      comp('c', 'clock', { period: 20 }),
    ]);
    expect(project.circuits[0].parts[0].on).toBe(true);
  });
});
