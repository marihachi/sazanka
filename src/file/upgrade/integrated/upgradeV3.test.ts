import { describe, expect, it } from 'vitest';
import { getPinout } from '../../../circuit/module';
import { checkProject } from '../../../circuit/project';
import { inputPinPos, outputPinPos } from '../../../geometry/layout';
import { fromStoredProject, type StoredProject } from '../../storage';
import { upgradeToProjectV1 } from '../project/v1';
import { upgradeV3 } from './upgradeV3';

/** 呼ぶたびに id1, id2, … を返す ID の作り方 (テスト用) */
function counter(): () => string {
  let n = 0;
  return () => `id${++n}`;
}

describe('upgradeV3', () => {
  it('部品と配線を 1 つの一覧にし、位置をマスにし、回路の ID を付け直し、label を portName に移し、メイン回路の名前と部品と配線の ID を消す', () => {
    const v3 = {
      author: 'さざんか',
      circuits: [
        {
          id: 'main',
          name: 'メイン',
          sheet: { width: 40, height: 30 },
          // biome-ignore format: 表形式を維持するため
          parts: [
            { id: 'part-1', kind: 'input', x: 0, y: 20, label: 'A', portNumber: 1 },
            { id: 'part-2', kind: 'module', x: 100, y: 0, module: 'k3f9' },
          ],
          // biome-ignore format: 表形式を維持するため
          wires: [{ id: 'wire-1', points: [{ x: 60, y: 40 }, { x: 80, y: 40 }] }],
        },
        {
          id: 'k3f9',
          name: 'M',
          package: { kind: 'split' },
          parts: [{ id: 'part-1', kind: 'output', x: 40, y: 60, label: 'Q', portNumber: 1 }],
          wires: [],
        },
      ],
    };
    // 新しい ID を作るのは、モジュールの回路だけ。部品と配線は ID を持たず、配線は種類を持つ
    expect(upgradeV3(v3, counter())).toEqual({
      author: 'さざんか',
      circuits: [
        {
          id: 'main',
          sheet: { width: 40, height: 30 },
          // biome-ignore format: 表形式を維持するため
          elements: [
            { kind: 'input', x: 0, y: 1, portName: 'A', portNumber: 1 },
            { kind: 'module', x: 5, y: 0, module: 'id1' },
            { kind: 'wire', points: [{ x: 3, y: 2 }, { x: 4, y: 2 }] },
          ],
        },
        {
          id: 'id1',
          name: 'M',
          package: { kind: 'split' },
          elements: [{ kind: 'output', x: 2, y: 3, portName: 'Q', portNumber: 1 }],
        },
      ],
    });
  });

  it('version 3 の書き出しで回路をまたいで重なっていた ID も、重ならなくなる', () => {
    const circuit = (id: string, name: string) => ({
      id,
      name,
      package: { kind: 'split' },
      parts: [{ id: 'part-1', kind: 'and', x: 0, y: 0 }],
      wires: [
        {
          id: 'wire-1',
          points: [
            { x: 0, y: 0 },
            { x: 20, y: 0 },
          ],
        },
      ],
    });
    const v4 = upgradeV3({ circuits: [circuit('main', 'メイン'), circuit('m', 'M')] }, counter());
    // 検証は今の形 (プロジェクトの形式) で行うので、今の形まで変えてから確かめる
    expect(checkProject(upgradeToProjectV1(v4))).toBeUndefined();
  });

  it('20 の倍数でない位置は、いちばん近いマスに丸める (ちょうど中間なら大きい方)', () => {
    // biome-ignore format: 表形式を維持するため
    const v3 = { circuits: [{ id: 'main', name: 'メイン', wires: [], parts: [
      { id: 'a', kind: 'and', x: 9, y: 10 },
      { id: 'b', kind: 'and', x: 29, y: 31 },
    ] }] };
    const v4 = upgradeV3(v3, counter()) as {
      circuits: { elements: { x?: number; y?: number }[] }[];
    };
    expect(v4.circuits[0].elements.map((c) => ('x' in c ? [c.x, c.y] : []))).toEqual([
      [0, 1],
      [1, 2],
    ]);
  });

  it('重なっていた回路の ID と、モジュールが使う main は、重なったまま残す (検証で断る)', () => {
    const module = (id: string) => ({
      id,
      name: id,
      package: { kind: 'split' },
      parts: [],
      wires: [],
    });
    const main = { id: 'main', name: 'メイン', parts: [], wires: [] };
    for (const v3 of [
      { circuits: [main, module('m'), module('m')] },
      { circuits: [main, module('main')] },
    ]) {
      expect(checkProject(upgradeToProjectV1(upgradeV3(v3, counter())))).toMatchObject({
        code: 'DUPLICATE_ID',
      });
    }
  });

  it('形の正しくないデータは、分かるところだけを変えて返す', () => {
    expect(upgradeV3(null, counter())).toBeNull();
    expect(upgradeV3({ circuits: 1 }, counter())).toEqual({ circuits: 1 });
    // biome-ignore format: 表形式を維持するため
    const broken = { circuits: [{ id: 'main', name: 'メイン', parts: [1, { id: 2, kind: 'and', x: '0', y: 0 }], wires: 'w' }] };
    // 部品か配線の一覧が配列でなければ、まとめずにそのまま残す
    expect(upgradeV3(broken, counter())).toEqual({
      circuits: [{ id: 'main', parts: [1, { id: 2, kind: 'and', x: '0', y: 0 }], wires: 'w' }],
    });
    // biome-ignore format: 表形式を維持するため
    const badItems = { circuits: [{ id: 'main', name: 'メイン', parts: [1, { id: 2, kind: 'and', x: '0', y: 0 }], wires: [null] }] };
    expect(upgradeV3(badItems, counter())).toEqual({
      circuits: [{ id: 'main', elements: [1, { kind: 'and', x: '0', y: 0 }, null] }],
    });
  });

  it('配線の端は、px に戻しても部品のピンの先に重なったまま', () => {
    // INPUT の出力ピンの先 (60, 20) から、OUTPUT の入力ピンの先 (180, 20) へ
    // biome-ignore format: 表形式を維持するため
    const v3 = { circuits: [{ id: 'main', name: 'メイン',
      parts: [
        { id: 'a', kind: 'input', x: 0, y: 0 },
        { id: 'q', kind: 'output', x: 200, y: 0 },
      ],
      wires: [{ id: 'w', points: [{ x: 60, y: 20 }, { x: 180, y: 20 }] }],
    }] };
    const current = upgradeToProjectV1(upgradeV3(v3, counter()));
    expect(checkProject(current)).toBeUndefined();
    const project = fromStoredProject(current as StoredProject, counter());
    const [a, q] = project.circuits[0].parts;
    const [w] = project.circuits[0].wires;
    expect(w.points[0]).toEqual(outputPinPos(a, getPinout(a, project), 0));
    expect(w.points[1]).toEqual(inputPinPos(q, getPinout(q, project), 0));
  });
});
