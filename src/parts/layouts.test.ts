import { describe, expect, it } from 'vitest';
import { layoutOf } from './layouts';
import { PART_VIEWS } from './views';

describe('layoutOf', () => {
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
        const layout = layoutOf(kind, pins);
        expect(Number.isInteger(layout.w) && Number.isInteger(layout.h), kind).toBe(true);
        for (const p of [...layout.inputs, ...layout.outputs]) {
          expect(Number.isInteger(p.at) && p.at >= 0 && p.at <= layout.h, kind).toBe(true);
        }
      }
    }
  });

  it('ピンを、渡したピンの数だけ置く。入力は左、出力は右', () => {
    for (const kind of kinds) {
      const layout = layoutOf(kind, { inputs: ['', ''], outputs: [''] });
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
    expect(layoutOf('output', none).body).toBe('circle');
    expect(layoutOf('input', none).body).toBe('rounded');
    expect(layoutOf('module', none).nameAbove).toBe(true);
    expect(layoutOf('and', none).nameAbove).toBe(false);
  });
});
