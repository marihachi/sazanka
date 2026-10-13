import { describe, expect, it } from 'vitest';
import { gateLayout, type PartLayout, ROTATIONS, rotateLayout, rotateSide } from './layout';
import { getLayout } from './layouts';

/** ピンを「辺 + 位置」の文字にする (比べやすくするため) */
function pinsOf(layout: PartLayout) {
  const name = (p: { side: string; at: number }) => `${p.side}${p.at}`;
  return {
    inputs: layout.inputs.map(name),
    outputs: layout.outputs.map(name),
    nc: (layout.nc ?? []).map(name),
  };
}

describe('rotateSide', () => {
  it('時計回りに回した辺', () => {
    expect(rotateSide('left', 0)).toBe('left');
    expect(rotateSide('left', 90)).toBe('top');
    expect(rotateSide('top', 90)).toBe('right');
    expect(rotateSide('top', 180)).toBe('bottom');
    expect(rotateSide('top', 270)).toBe('left');
  });
});

describe('rotateLayout', () => {
  // AND: 幅 3、高さ 4。入力は左の 1 と 3、出力は右の 2
  const and = gateLayout({ inputs: ['', ''], outputs: [''] });

  it('0 度なら変えない', () => {
    expect(rotateLayout(and, 0)).toEqual(and);
  });

  it('90 度で幅と高さが入れ替わり、左のピンは上、右のピンは下へ移る', () => {
    const r = rotateLayout(and, 90);
    expect([r.w, r.h]).toEqual([4, 3]);
    // 左の辺の上端から 1 マスめは、上の辺の左端から 4 − 1 = 3 マスめ
    expect(pinsOf(r)).toEqual({ inputs: ['top3', 'top1'], outputs: ['bottom2'], nc: [] });
  });

  it('180 度で左右が入れ替わり、上下の並びも逆になる', () => {
    const r = rotateLayout(and, 180);
    expect([r.w, r.h]).toEqual([3, 4]);
    expect(pinsOf(r)).toEqual({ inputs: ['right3', 'right1'], outputs: ['left2'], nc: [] });
  });

  it('270 度で左のピンは下、右のピンは上へ移る', () => {
    const r = rotateLayout(and, 270);
    expect([r.w, r.h]).toEqual([4, 3]);
    expect(pinsOf(r)).toEqual({ inputs: ['bottom1', 'bottom3'], outputs: ['top2'], nc: [] });
  });

  it('90 度を 4 回くり返すと元に戻る (上下の辺のピンと NC も)', () => {
    const qfp = getLayout('module', {
      inputs: ['', '', ''],
      outputs: [''],
      package: { kind: 'qfp', pins: 8 },
      pinNumbers: { inputs: [1, 3, 6], outputs: [8] },
    });
    for (const layout of [and, qfp]) {
      let r = layout;
      for (let i = 0; i < 4; i++) {
        r = rotateLayout(r, 90);
      }
      expect(r).toEqual(layout);
    }
  });

  it('90 度を 2 回、3 回くり返すと、180 度、270 度と同じ', () => {
    expect(rotateLayout(rotateLayout(and, 90), 90)).toEqual(rotateLayout(and, 180));
    expect(rotateLayout(rotateLayout(and, 180), 90)).toEqual(rotateLayout(and, 270));
  });

  it('回しても、ピンは辺の長さの中の整数のマスにある', () => {
    const seg = getLayout('sevenSegment', {
      inputs: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'DP'],
      outputs: [],
    });
    for (const rotation of ROTATIONS) {
      const r = rotateLayout(seg, rotation);
      for (const p of r.inputs) {
        const length = p.side === 'left' || p.side === 'right' ? r.h : r.w;
        expect(Number.isInteger(p.at) && p.at >= 0 && p.at <= length).toBe(true);
      }
    }
  });
});
