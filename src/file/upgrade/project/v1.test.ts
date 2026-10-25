import { describe, expect, it } from 'vitest';
import { checkProject } from '../../../circuit/project';
import { upgradeProjectCircuits } from '..';
import { step } from '../../../simulation/sim';
import { fromStoredProject, type StoredProject } from '../../storage';
import { upgradeToProjectV1 } from './v1';

/** 中の回路を回路の形式の今の版にしてから確かめる (この変換が作るのは回路の形式 v1 の形で、読み込みではこのあと今の版に変えるため) */
const checkLatest = (project: unknown) => checkProject(upgradeProjectCircuits(project));

/** 一体の形式 version 4 のモジュール (名前とパッケージを持つ回路) */
function v4Module(id: string, name: unknown, elements: unknown[] = []) {
  return { id, name, package: { kind: 'split' }, elements };
}

/** 変換したプロジェクトの、要素ごとの回路の名前 (メイン回路は undefined) */
function names(project: unknown): unknown[] {
  return (project as { circuits: { circuit: { name?: unknown } }[] }).circuits.map(
    (e) => e.circuit.name,
  );
}

describe('upgradeToProjectV1', () => {
  it('回路の並びを、同じ並びのまま、フォルダなしの要素の並びにする', () => {
    const v4 = { circuits: [{ id: 'main', elements: [] }, v4Module('b', 'B'), v4Module('a', 'A')] };
    const project = upgradeToProjectV1(v4) as StoredProject;
    expect(project).toMatchObject({ format: 'sazanka-project', version: 1, folders: [] });
    expect(project.circuits.map((e) => [e.path, e.circuit.id])).toEqual([
      ['', 'main'],
      ['', 'b'],
      ['', 'a'],
    ]);
    expect(checkLatest(project)).toBeUndefined();
  });

  it('プロジェクトの作者名を、すべてのモジュール (メイン回路を含む) に写す。なければ空文字', () => {
    const circuits = [{ id: 'main', elements: [] }, v4Module('m', 'M')];
    const authors = (p: unknown) => (p as StoredProject).circuits.map((e) => e.circuit.author);
    expect(authors(upgradeToProjectV1({ author: 'さざんか', circuits }))).toEqual([
      'さざんか',
      'さざんか',
    ]);
    expect(authors(upgradeToProjectV1({ circuits }))).toEqual(['', '']);
  });

  it('名前が空の回路に「回路<n>」を付ける (ほかの名前と重ならない、いちばん小さい数)', () => {
    const v4 = {
      circuits: [
        { id: 'main', elements: [] },
        v4Module('a', ''),
        v4Module('b', '回路1'),
        v4Module('c', '  '),
      ],
    };
    expect(names(upgradeToProjectV1(v4))).toEqual([undefined, '回路2', '回路1', '回路3']);
  });

  it('同じ名前のモジュールは、2 つめ以降に (2)、(3) などを付ける。付けた名前がほかと重なるなら次の数にする', () => {
    const v4 = {
      circuits: [
        { id: 'main', elements: [] },
        v4Module('a', 'X'),
        v4Module('b', 'X'),
        v4Module('c', 'X (2)'),
        v4Module('d', 'X'),
      ],
    };
    const project = upgradeToProjectV1(v4);
    expect(names(project)).toEqual([undefined, 'X', 'X (3)', 'X (2)', 'X (4)']);
    expect(checkLatest(project)).toBeUndefined();
  });

  it('部品の名前の写しは、名前を整えた後の名前にする', () => {
    const v4 = {
      circuits: [
        {
          id: 'main',
          elements: [
            { kind: 'module', x: 0, y: 0, module: 'a' },
            { kind: 'module', x: 0, y: 5, module: 'b' },
          ],
        },
        v4Module('a', 'X'),
        v4Module('b', 'X'),
      ],
    };
    const project = upgradeToProjectV1(v4) as StoredProject;
    expect(project.circuits[0].circuit.elements).toMatchObject([
      { circuitId: 'a', circuitName: 'X' },
      { circuitId: 'b', circuitName: 'X (2)' },
    ]);
  });

  it('形の正しくないデータは、そのまま返す (検証で断る)', () => {
    expect(upgradeToProjectV1(null)).toBeNull();
    expect(upgradeToProjectV1({ circuits: 1 })).toEqual({ circuits: 1 });
    expect(checkLatest(upgradeToProjectV1({ circuits: 1 }))).toBeDefined();
    // 名前が文字列でないモジュールは、名前を付けずに残す
    const project = upgradeToProjectV1({
      circuits: [{ id: 'main', elements: [] }, v4Module('m', 1)],
    });
    expect(names(project)).toEqual([undefined, 1]);
    expect(checkLatest(project)).toBeDefined();
  });
});

describe('変換の前後で、外側の配線は同じピンにつながったまま', () => {
  // モジュール SEL (split): 入力 A (上、ポート番号 2) と B (下、ポート番号 1)、出力は A をそのまま出す。
  // 一体の形式 v4 では split のピンは位置の順なので、上の入力ピン (0 番) が A。
  // メイン回路では、HIGH を上の入力ピン (0 番) につなぐので、出力は ON になる。
  // 変換で、ポート番号を位置の順に振り直す (A が 1、B が 2) ので、ポート番号の順でも 0 番は A のまま
  // biome-ignore format: 表形式を維持するため
  const v4 = {
    circuits: [
      { id: 'main', elements: [
        { kind: 'high', x: 0, y: 0 },
        { kind: 'module', x: 10, y: 0, module: 'sel' },
        // HIGH の出力ピンの先 (3, 1) から、SEL の入力ピン 0 番の先 (9, 1) へ
        { kind: 'wire', points: [{ x: 3, y: 1 }, { x: 9, y: 1 }] },
      ] },
      { id: 'sel', name: 'SEL', package: { kind: 'split' }, elements: [
        { kind: 'input', x: 0, y: 0, portName: 'A', portNumber: 2 },
        { kind: 'input', x: 0, y: 4, portName: 'B', portNumber: 1 },
        { kind: 'output', x: 10, y: 0, portName: 'Y', portNumber: 1 },
        // A の出力ピンの先 (3, 1) から、Y の入力ピンの先 (9, 1) へ
        { kind: 'wire', points: [{ x: 3, y: 1 }, { x: 9, y: 1 }] },
      ] },
    ],
  };

  it('ポート番号を位置の順に振り直し、シミュレーションの結果が変わらない', () => {
    const stored = upgradeToProjectV1(v4) as StoredProject;
    expect(checkLatest(stored)).toBeUndefined();
    const sel = stored.circuits[1].circuit.elements;
    expect(sel.filter((e) => e.kind === 'input')).toMatchObject([
      { portName: 'A', portNumber: 1 },
      { portName: 'B', portNumber: 2 },
    ]);
    let n = 0;
    const project = fromStoredProject(stored, () => `id${++n}`);
    const module = project.circuits[0].parts.find((c) => c.kind === 'module');
    let result = step(project, 'main');
    for (let i = 0; i < 30; i++) {
      result = step(project, 'main', result);
    }
    // 最上位に置いたモジュールの出力ピンの値も values に入る
    expect(result.values.get(`${module?.id}:0`)).toBe(true);
  });
});
