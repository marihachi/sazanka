import { describe, expect, it } from 'vitest';
import { getPinout } from '../../../circuit/module';
import { checkProject } from '../../../circuit/project';
import { upgradeProjectCircuits } from '..';
import { inputPinPos, outputPinPos } from '../../../geometry/layout';
import { fromStoredProject, type StoredProject } from '../../storage';
import { upgradeToProjectV1 } from '../project/v1';
import { upgradeV1 } from './upgradeV1';
import { upgradeV2 } from './upgradeV2';
import { upgradeV3 } from './upgradeV3';

/** 中の回路を回路の形式の今の版にしてから確かめる (この変換が作るのは回路の形式 v1 の形で、読み込みではこのあと今の版に変えるため) */
const checkLatest = (project: unknown) => checkProject(upgradeProjectCircuits(project));

describe('upgradeV2', () => {
  it('部品の一覧を parts に、モジュールの参照を module に移し、種類の名前を変える', () => {
    const v2 = {
      author: 'さざんか',
      circuits: [
        {
          id: 'main',
          name: 'メイン',
          // biome-ignore format: 表形式を維持するため
          components: [
            { id: 'a', kind: 'INPUT', x: 0, y: 0, label: 'A' },
            { id: 'm', kind: 'CUSTOM', x: 100, y: 0, custom: 'mod' },
            { id: 'c', kind: 'CLOCK', x: 0, y: 100, period: 10 },
          ],
          // biome-ignore format: 表形式を維持するため
          wires: [{ id: 'w', points: [{ x: 60, y: 20 }, { x: 80, y: 20 }] }],
        },
        { id: 'mod', name: 'M', components: [], wires: [] },
      ],
    };
    expect(upgradeV2(v2)).toEqual({
      author: 'さざんか',
      circuits: [
        {
          id: 'main',
          name: 'メイン',
          // biome-ignore format: 表形式を維持するため
          parts: [
            { id: 'a', kind: 'input', x: 0, y: 0, label: 'A', portNumber: 1 },
            { id: 'm', kind: 'module', x: 100, y: 0, module: 'mod' },
            { id: 'c', kind: 'clock', x: 0, y: 100, period: 10 },
          ],
          // 配線は書き換えない
          // biome-ignore format: 表形式を維持するため
          wires: [{ id: 'w', points: [{ x: 60, y: 20 }, { x: 80, y: 20 }] }],
        },
        // モジュールの回路にだけ、version 2 までのモジュールの形を書き込む
        { id: 'mod', name: 'M', package: { kind: 'split' }, parts: [], wires: [] },
      ],
    });
  });

  it('INPUT / OUTPUT に、入力と出力で別々に、中の位置の順でポート番号を書き込む', () => {
    // biome-ignore format: 表形式を維持するため
    const v2 = { circuits: [{ id: 'main', name: 'メイン', wires: [], components: [
      { id: 'i2', kind: 'INPUT', x: 0, y: 100 },
      { id: 'o1', kind: 'OUTPUT', x: 200, y: 0 },
      { id: 'i3', kind: 'INPUT', x: 100, y: 100 },
      { id: 'i1', kind: 'INPUT', x: 50, y: 0 },
      { id: 'n', kind: 'NOT', x: 0, y: 0 },
    ] }] };
    const v3 = upgradeV2(v2) as { circuits: { parts: { id: string; portNumber?: number }[] }[] };
    expect(v3.circuits[0].parts.map((p) => [p.id, p.portNumber])).toEqual([
      ['i2', 2],
      ['o1', 1],
      ['i3', 3],
      ['i1', 1],
      ['n', undefined],
    ]);
  });

  it('種類の名前をすべて変える', () => {
    // biome-ignore format: 表形式を維持するため
    const names: [string, string][] = [
      ['INPUT', 'input'], ['OUTPUT', 'output'], ['CLOCK', 'clock'], ['HIGH', 'high'],
      ['AND', 'and'], ['OR', 'or'], ['NOT', 'not'], ['NAND', 'nand'], ['NOR', 'nor'],
      ['XOR', 'xor'], ['XNOR', 'xnor'], ['RS', 'rsLatch'], ['RSEN', 'rsEnLatch'],
      ['DLATCH', 'dLatch'], ['DFF', 'dFlipFlop'], ['TFF', 'tFlipFlop'], ['JKFF', 'jkFlipFlop'],
      ['CUSTOM', 'module'],
    ];
    const v2 = {
      circuits: [
        {
          id: 'main',
          name: 'メイン',
          components: names.map(([kind], i) => ({ id: `p${i}`, kind, x: 0, y: 0 })),
          wires: [],
        },
      ],
    };
    const v3 = upgradeV2(v2) as { circuits: { parts: { kind: string }[] }[] };
    expect(v3.circuits[0].parts.map((p) => p.kind)).toEqual(names.map(([, kind]) => kind));
  });

  it('形の正しくないデータは、分かるところだけを変えて返す (検証で断る)', () => {
    expect(upgradeV2(null)).toBeNull();
    expect(upgradeV2({})).toEqual({});
    expect(upgradeV2({ circuits: [1, { id: 'm' }] })).toEqual({
      circuits: [1, { id: 'm', package: { kind: 'split' } }],
    });
    // 表にない種類の名前は、そのまま残す
    const unknown = { circuits: [{ id: 'main', components: [{ kind: 'FOO' }], wires: [] }] };
    expect(upgradeV2(unknown)).toEqual({
      circuits: [{ id: 'main', parts: [{ kind: 'FOO' }], wires: [] }],
    });
    expect(
      checkLatest(upgradeToProjectV1(upgradeV3(upgradeV2(unknown), () => 'id'))),
    ).toBeDefined();
  });
});

describe('古い版から順に変えたときのつながり', () => {
  // INPUT → モジュール (中は INPUT → NOT → OUTPUT が 2 組) → OUTPUT。
  // モジュールの 2 本目の入力ピンと出力ピンにもつなぎ、ピンの位置がずれていないかを見る
  const inner = [
    { id: 'i1', kind: 'INPUT', x: 2800, y: 1900 },
    { id: 'i2', kind: 'INPUT', x: 2800, y: 2000 },
    { id: 'o1', kind: 'OUTPUT', x: 3000, y: 1900 },
    { id: 'o2', kind: 'OUTPUT', x: 3000, y: 2000 },
  ];
  // biome-ignore format: 表形式を維持するため
  const outer = [
    { id: 'a', kind: 'INPUT', x: 2700, y: 1920 },
    { id: 'm', kind: 'CUSTOM', custom: 'mod', x: 2900, y: 1900 },
    { id: 'q', kind: 'OUTPUT', x: 3100, y: 1940 },
  ];
  const v1 = {
    circuits: [
      {
        id: 'main',
        name: 'メイン',
        components: outer,
        // biome-ignore format: 表形式を維持するため
        wires: [
          { id: 'w1', from: { comp: 'a', pin: 0 }, to: { comp: 'm', pin: 1 } },
          { id: 'w2', from: { comp: 'm', pin: 1 }, to: { comp: 'q', pin: 0 } },
        ],
      },
      { id: 'mod', name: 'M', components: inner, wires: [] },
    ],
  };

  it('version 1 のデータを読むと、配線の端がピンの先に重なったまま version 3 の形になる', () => {
    const v3 = upgradeV2(upgradeV1(v1));
    // 検証とピンの位置は今の形 (プロジェクトの形式) で求めるので、今の形まで変えてから確かめる
    let n = 0;
    const newId = () => `id${++n}`;
    const current = upgradeProjectCircuits(upgradeToProjectV1(upgradeV3(v3, newId)));
    expect(checkLatest(current)).toBeUndefined();
    const project = fromStoredProject(current as StoredProject, newId);
    const [a, m, q] = project.circuits[0].parts;
    const pinout = (p: (typeof project.circuits)[0]['parts'][0]) => getPinout(p, project);
    const [w1, w2] = project.circuits[0].wires;
    expect(w1.points[0]).toEqual(outputPinPos(a, pinout(a), 0));
    expect(w1.points.at(-1)).toEqual(inputPinPos(m, pinout(m), 1));
    expect(w2.points[0]).toEqual(outputPinPos(m, pinout(m), 1));
    expect(w2.points.at(-1)).toEqual(inputPinPos(q, pinout(q), 0));
  });
});
