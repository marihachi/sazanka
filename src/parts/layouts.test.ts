import { describe, expect, it } from 'vitest';
import { getLayout } from './layouts';
import { PART_VIEWS } from './views';

describe('getLayout', () => {
  // 置ける種類すべてと、内部用の BUF
  const kinds = [...Object.keys(PART_VIEWS), 'buf'];
  // ピンの数を変えて確かめる (モジュールはピンの数で高さが変わる)
  const pinsList = [
    { inputs: [], outputs: [] },
    { inputs: [''], outputs: [''] },
    { inputs: ['', '', ''], outputs: ['', ''] },
  ];

  it('大きさはマスの整数で、ピンは本体の高さの中の整数のマスにある', () => {
    for (const kind of kinds) {
      for (const pins of pinsList) {
        const layout = getLayout(kind, pins);
        expect(Number.isInteger(layout.w) && Number.isInteger(layout.h), kind).toBe(true);
        for (const p of [...layout.inputs, ...layout.outputs]) {
          expect(Number.isInteger(p.at) && p.at >= 0 && p.at <= layout.h, kind).toBe(true);
        }
      }
    }
  });

  it('ピンを、渡したピンの数だけ置く。入力は左、出力は右', () => {
    for (const kind of kinds) {
      const layout = getLayout(kind, { inputs: ['', ''], outputs: [''] });
      expect(
        layout.inputs.map((p) => p.side),
        kind,
      ).toEqual(['left', 'left']);
      expect(
        layout.outputs.map((p) => p.side),
        kind,
      ).toEqual(['right']);
    }
  });

  it('既定と違う配置にした種類は、その配置になる', () => {
    const none = { inputs: [], outputs: [] };
    expect(getLayout('output', none).body).toBe('circle');
    expect(getLayout('input', none).body).toBe('rounded');
    expect(getLayout('module', none).nameAbove).toBe(true);
    expect(getLayout('and', none).nameAbove).toBe(false);
  });
});

describe('モジュールの dip の配置', () => {
  // 8 ピン。入力は 1 番と 6 番、出力は 3 番。ほかは NC
  const layout = getLayout('module', {
    inputs: ['A', 'B'],
    outputs: ['Y'],
    package: { kind: 'dip', pins: 8 },
    pinNumbers: { inputs: [1, 6], outputs: [3] },
  });

  it('幅 3、高さは (ピン数 / 2 - 1) × 2 + 2 マス', () => {
    expect([layout.w, layout.h]).toEqual([3, 8]);
  });

  it('左を上から 1〜4 番、右を下から 5〜8 番に、2 マスおきに置く', () => {
    expect(layout.inputs).toEqual([
      { side: 'left', at: 1, number: 1 },
      { side: 'right', at: 5, number: 6 },
    ]);
    expect(layout.outputs).toEqual([{ side: 'left', at: 5, number: 3 }]);
    // biome-ignore format: 表形式を維持するため
    expect(layout.nc).toEqual([
      { side: 'left', at: 3, number: 2 },
      { side: 'left', at: 7, number: 4 },
      { side: 'right', at: 7, number: 5 },
      { side: 'right', at: 3, number: 7 },
      { side: 'right', at: 1, number: 8 },
    ]);
  });

  it('向きの印を付ける。split には付けない', () => {
    expect(layout.directionMarks).toBe(true);
    const split = getLayout('module', { inputs: [''], outputs: [''], package: { kind: 'split' } });
    expect(split.directionMarks).toBeFalsy();
    expect(split.nc ?? []).toEqual([]);
  });
});
