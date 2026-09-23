import { describe, expect, it } from 'vitest';
import type { Component } from '../engine/component';
import { SHEET_HEIGHT, SHEET_WIDTH } from '../engine/layout';
import { MAIN_ID, type Project } from '../engine/project';
import {
  centerView,
  fitView,
  isView,
  MAX_SCALE,
  MIN_SCALE,
  overview,
  toScreen,
  toWorld,
  zoomAt,
} from './view';

describe('座標の変換', () => {
  it('画面の座標と回路の座標は行き来できる', () => {
    const v = { x: 30, y: -50, scale: 2 };
    expect(toWorld(v, toScreen(v, { x: 10, y: 20 }))).toEqual({ x: 10, y: 20 });
    expect(toScreen(v, { x: 10, y: 20 })).toEqual({ x: 50, y: -10 });
  });
});

describe('zoomAt', () => {
  it('指定した画面の位置にある点は、倍率を変えても動かない', () => {
    const v = { x: 30, y: 40, scale: 1 };
    const at = { x: 200, y: 100 };
    const before = toWorld(v, at);
    const zoomed = zoomAt(v, at, 2);
    expect(zoomed.scale).toBe(2);
    expect(toWorld(zoomed, at)).toEqual(before);
  });

  it('倍率は上限と下限に収める', () => {
    expect(zoomAt(centerView(400, 300), { x: 0, y: 0 }, 100).scale).toBe(
      MAX_SCALE,
    );
    expect(zoomAt(centerView(400, 300), { x: 0, y: 0 }, 0.001).scale).toBe(
      MIN_SCALE,
    );
  });
});

describe('fitView', () => {
  it('左上から離れた範囲は、全体が画面の真ん中に入る', () => {
    const v = fitView(
      { left: 400, top: 300, right: 1600, bottom: 900 },
      400,
      300,
    );
    const topLeft = toScreen(v, { x: 400, y: 300 });
    const bottomRight = toScreen(v, { x: 1600, y: 900 });
    expect(topLeft.x).toBeGreaterThanOrEqual(0);
    expect(topLeft.y).toBeGreaterThanOrEqual(0);
    expect(bottomRight.x).toBeLessThanOrEqual(400);
    expect(bottomRight.y).toBeLessThanOrEqual(300);
    expect((topLeft.x + bottomRight.x) / 2).toBeCloseTo(200);
  });

  it('右下の端に寄った回路でも、シートの外は映さない', () => {
    const v = fitView(
      {
        left: SHEET_WIDTH - 100,
        top: SHEET_HEIGHT - 80,
        right: SHEET_WIDTH,
        bottom: SHEET_HEIGHT,
      },
      400,
      300,
    );
    const end = toScreen(v, { x: SHEET_WIDTH, y: SHEET_HEIGHT });
    expect(end.x).toBeGreaterThanOrEqual(400);
    expect(end.y).toBeGreaterThanOrEqual(300);
  });

  it('左上の端に寄った回路でも、シートの外は映さない', () => {
    const v = fitView({ left: 0, top: 0, right: 100, bottom: 80 }, 400, 300);
    const origin = toScreen(v, { x: 0, y: 0 });
    expect(origin.x).toBeLessThanOrEqual(0);
    expect(origin.y).toBeLessThanOrEqual(0);
    // 回路は画面に収まったまま
    const bottomRight = toScreen(v, { x: 100, y: 80 });
    expect(bottomRight.x).toBeLessThanOrEqual(400);
    expect(bottomRight.y).toBeLessThanOrEqual(300);
  });

  it('小さな回路は等倍より大きくしない', () => {
    expect(
      fitView({ left: 0, top: 0, right: 40, bottom: 40 }, 400, 300).scale,
    ).toBe(1);
  });
});

describe('isView', () => {
  it('数値がそろい、倍率が範囲内なら使える', () => {
    expect(isView({ x: 0, y: 0, scale: 1 })).toBe(true);
    expect(isView({ x: 0, y: 0, scale: 100 })).toBe(false);
    expect(isView({ x: '0', y: 0, scale: 1 })).toBe(false);
    expect(isView(null)).toBe(false);
  });
});

describe('overview', () => {
  const project = (components: Component[]): Project => ({
    circuits: [{ id: MAIN_ID, name: 'メイン', components, wires: [] }],
  });

  it('部品のない回路は、シートの中央を画面の真ん中に置いた等倍の表示', () => {
    const p = project([]);
    const v = overview(p.circuits[0], p, 400, 300);
    expect(v.scale).toBe(1);
    expect(toScreen(v, { x: SHEET_WIDTH / 2, y: SHEET_HEIGHT / 2 })).toEqual({
      x: 200,
      y: 150,
    });
  });

  it('部品のある回路は、部品が画面に入る表示', () => {
    const p = project([{ id: 'g', kind: 'AND', x: 100, y: 80 }]);
    const v = overview(p.circuits[0], p, 400, 300);
    const at = toScreen(v, { x: 100, y: 80 });
    expect(at.x).toBeGreaterThanOrEqual(0);
    expect(at.y).toBeGreaterThanOrEqual(0);
    expect(at.x).toBeLessThan(400);
    expect(at.y).toBeLessThan(300);
  });
});
