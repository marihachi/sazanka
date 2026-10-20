import { describe, expect, it } from 'vitest';
import { upgradeToCircuitV1 } from './v1';

const options = { author: 'さざんか', name: 'M', circuitNames: new Map([['sub', 'サブ']]) };

/** 要素の INPUT / OUTPUT のポート番号を、並びの順に取り出す */
function portNumbers(module: unknown): unknown[] {
  return (module as { elements: { kind: string; portNumber?: unknown }[] }).elements
    .filter((e) => e.kind === 'input' || e.kind === 'output')
    .map((e) => e.portNumber);
}

describe('upgradeToCircuitV1', () => {
  it('format と version を先頭に書き、作者名と名前を書く。sheet と CLOCK の period がなければ書き込む', () => {
    const v4 = {
      id: 'm',
      name: '古い名前',
      package: { kind: 'dip', pins: 4 },
      elements: [{ kind: 'clock', x: 0, y: 0 }],
    };
    const module = upgradeToCircuitV1(v4, options);
    expect(module).toEqual({
      format: 'sazanka-circuit',
      version: 1,
      id: 'm',
      name: 'M',
      author: 'さざんか',
      package: { kind: 'dip', pins: 4 },
      sheet: { width: 300, height: 200 },
      elements: [{ kind: 'clock', x: 0, y: 0, period: 100 }],
    });
    expect(Object.keys(module as object).slice(0, 2)).toEqual(['format', 'version']);
  });

  it('シートの大きさと CLOCK の周期があれば、そのまま残す', () => {
    const v4 = {
      id: 'm',
      package: { kind: 'split' },
      sheet: { width: 40, height: 30 },
      elements: [{ kind: 'clock', x: 0, y: 0, period: 20 }],
    };
    expect(upgradeToCircuitV1(v4, options)).toMatchObject({
      sheet: { width: 40, height: 30 },
      elements: [{ kind: 'clock', period: 20 }],
    });
  });

  it('メイン回路には split を書き込み、名前は書かない', () => {
    const module = upgradeToCircuitV1({ id: 'main', name: 'メイン', elements: [] }, options);
    expect(module).toMatchObject({ id: 'main', package: { kind: 'split' }, author: 'さざんか' });
    expect(module).not.toHaveProperty('name');
  });

  it('モジュールの部品の module を circuitId に移し、指す回路の名前を circuitName に写す', () => {
    const v4 = {
      id: 'main',
      elements: [
        { kind: 'module', x: 0, y: 0, module: 'sub' },
        { kind: 'module', x: 0, y: 5, module: 'ない' },
      ],
    };
    expect((upgradeToCircuitV1(v4, options) as { elements: unknown[] }).elements).toEqual([
      { kind: 'module', x: 0, y: 0, circuitId: 'sub', circuitName: 'サブ' },
      // 指す先の回路がないモジュールは、写す名前がない (検証で断る)
      { kind: 'module', x: 0, y: 5, circuitId: 'ない', circuitName: '' },
    ]);
  });

  describe('ポート番号', () => {
    // biome-ignore format: 表形式を維持するため
    const ports = [
      { kind: 'input', x: 0, y: 4, portNumber: 1 },
      { kind: 'input', x: 0, y: 0, portNumber: 3 },
      { kind: 'input', x: 0, y: 8, portNumber: 4 },
      { kind: 'output', x: 9, y: 0, portNumber: 2 },
    ];

    it('split のモジュールは、入力と出力で別々に、1 から位置の順に振り直す (飛びは詰まる)', () => {
      const v4 = { id: 'm', package: { kind: 'split' }, elements: ports };
      // 位置の順は、入力が y = 0 (3)、y = 4 (1)、y = 8 (4)。出力は 1 つ
      expect(portNumbers(upgradeToCircuitV1(v4, options))).toEqual([2, 1, 3, 1]);
    });

    it('メイン回路も、位置の順に振り直す', () => {
      expect(portNumbers(upgradeToCircuitV1({ id: 'main', elements: ports }, options))).toEqual([
        2, 1, 3, 1,
      ]);
    });

    it('位置の順と番号の順がそろっていて飛びもなければ、番号は変わらない', () => {
      // biome-ignore format: 表形式を維持するため
      const sorted = [
        { kind: 'input', x: 0, y: 0, portNumber: 1 },
        { kind: 'input', x: 5, y: 0, portNumber: 2 },
        { kind: 'input', x: 0, y: 4, portNumber: 3 },
      ];
      const v4 = { id: 'm', package: { kind: 'split' }, elements: sorted };
      expect(portNumbers(upgradeToCircuitV1(v4, options))).toEqual([1, 2, 3]);
    });

    it('dip / qfp のモジュールは振り直さない', () => {
      for (const pkg of [
        { kind: 'dip', pins: 4 },
        { kind: 'qfp', pins: 8 },
      ]) {
        const v4 = { id: 'm', package: pkg, elements: ports };
        expect(portNumbers(upgradeToCircuitV1(v4, options))).toEqual([1, 3, 4, 2]);
      }
    });

    it('dip / qfp のモジュールでは、ないものと、位置の順で後ろの重なるものに、空いているいちばん小さい番号を付ける', () => {
      // biome-ignore format: 表形式を維持するため
      const elements = [
        { kind: 'input', x: 0, y: 5, portNumber: 1 },
        { kind: 'input', x: 0, y: 0, portNumber: 1 },
        { kind: 'input', x: 0, y: 10 },
        { kind: 'output', x: 0, y: 0 },
      ];
      const v4 = { id: 'm', package: { kind: 'dip', pins: 4 }, elements };
      expect(portNumbers(upgradeToCircuitV1(v4, options))).toEqual([2, 1, 3, 1]);
    });

    it('正しくない番号 (0 や文字列) は、付け直さずに残す (検証で断る)', () => {
      const elements = [
        { kind: 'input', x: 0, y: 0, portNumber: 0 },
        { kind: 'input', x: 0, y: 5, portNumber: '2' },
      ];
      const v4 = { id: 'm', package: { kind: 'dip', pins: 4 }, elements };
      expect(portNumbers(upgradeToCircuitV1(v4, options))).toEqual([0, '2']);
    });
  });

  it('形の正しくないデータは、分かるところだけを変えて返す', () => {
    expect(upgradeToCircuitV1(null, options)).toBeNull();
    expect(upgradeToCircuitV1(1, options)).toBe(1);
    expect(
      upgradeToCircuitV1({ id: 'm', package: { kind: 'split' }, elements: 'x' }, options),
    ).toMatchObject({ elements: 'x' });
    expect(
      upgradeToCircuitV1(
        { id: 'm', package: { kind: 'split' }, elements: [null, 1, { kind: 'input', x: 'a' }] },
        options,
      ),
    ).toMatchObject({ elements: [null, 1, { kind: 'input', x: 'a', portNumber: 1 }] });
  });
});
