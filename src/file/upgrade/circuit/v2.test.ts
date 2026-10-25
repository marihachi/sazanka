import { describe, expect, it } from 'vitest';
import { upgradeToCircuitV2 } from './v2';

type Point = { x: number; y: number };

/**
 * NOT のピンの先 (形式の文書の「ピンの先の位置」の式)。回す前の本体の幅 w、高さ h、回す前のピンの先 (px, py) から求める。
 * 今のアプリの配置には頼らない (変換と同じく、形式の文書だけで確かめるため)
 */
function tip(
  part: { x: number; y: number; rotation?: number },
  w: number,
  h: number,
  p: Point,
): Point {
  const { x, y } = part;
  switch (part.rotation ?? 0) {
    case 90:
      return { x: x + h - p.y, y: y + p.x };
    case 180:
      return { x: x + w - p.x, y: y + h - p.y };
    case 270:
      return { x: x + p.y, y: y + w - p.x };
    default:
      return { x: x + p.x, y: y + p.y };
  }
}

/** version 1 の NOT (3×4) の入力と出力のピンの先 */
function tipsV1(part: { x: number; y: number; rotation?: number }): Point[] {
  return [tip(part, 3, 4, { x: -1, y: 2 }), tip(part, 3, 4, { x: 4, y: 2 })];
}

/** version 2 の NOT (3×2) の入力と出力のピンの先 */
function tipsV2(part: { x: number; y: number; rotation?: number }): Point[] {
  return [tip(part, 3, 2, { x: -1, y: 1 }), tip(part, 3, 2, { x: 4, y: 1 })];
}

describe('upgradeToCircuitV2', () => {
  it('版を 2 にする', () => {
    expect(upgradeToCircuitV2({ format: 'sazanka-circuit', version: 1, elements: [] })).toEqual({
      format: 'sazanka-circuit',
      version: 2,
      elements: [],
    });
  });

  it('NOT をずらして、どの向きでも入力と出力のピンの先を元の場所に残す', () => {
    for (const rotation of [undefined, 0, 90, 180, 270]) {
      const before = { kind: 'not', x: 10, y: 20, ...(rotation === undefined ? {} : { rotation }) };
      const after = (
        upgradeToCircuitV2({ version: 1, elements: [before] }) as { elements: (typeof before)[] }
      ).elements[0];
      expect(tipsV2(after)).toEqual(tipsV1(before));
    }
  });

  it('向きが 0 と 180 なら y を、90 と 270 なら x を 1 増やす', () => {
    const shifted = (rotation?: number) =>
      (
        upgradeToCircuitV2({ elements: [{ kind: 'not', x: 10, y: 20, rotation }] }) as {
          elements: unknown[];
        }
      ).elements[0];
    expect(shifted(undefined)).toMatchObject({ x: 10, y: 21 });
    expect(shifted(180)).toMatchObject({ x: 10, y: 21 });
    expect(shifted(90)).toMatchObject({ x: 11, y: 20 });
    expect(shifted(270)).toMatchObject({ x: 11, y: 20 });
  });

  it('NOT 以外の要素と、位置や向きが正しくない NOT は変えない', () => {
    const elements = [
      { kind: 'and', x: 1, y: 2 },
      { kind: 'wire', points: [{ x: 0, y: 0 }] },
      { kind: 'not', x: '1', y: 2 },
      { kind: 'not', x: 1, y: 2, rotation: 45 },
      'x',
    ];
    expect(upgradeToCircuitV2({ version: 1, elements })).toEqual({ version: 2, elements });
  });

  it('回路でないものと、要素の一覧がない回路は、そのまま (版だけ変える)', () => {
    expect(upgradeToCircuitV2('x')).toBe('x');
    expect(upgradeToCircuitV2({ version: 1 })).toEqual({ version: 2 });
  });
});
