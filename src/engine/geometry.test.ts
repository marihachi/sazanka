import { describe, expect, it } from 'vitest';
import { clampPosition } from './geometry';
import type { Component } from './sim';

describe('clampPosition', () => {
  const and: Component = { id: 'g', kind: 'AND', x: 0, y: 0 };
  const ports = { inputs: ['', ''], outputs: [''] };

  it('領域内ならそのまま', () => {
    expect(clampPosition(and, ports, { x: 100, y: 100 }, 400, 300)).toEqual({ x: 100, y: 100 });
  });

  it('左上にはみ出すと、入力ピンの先端が収まる位置に戻す', () => {
    expect(clampPosition(and, ports, { x: -60, y: -40 }, 400, 300)).toEqual({ x: 20, y: 0 });
  });

  it('右下にはみ出すと、出力ピンの先端と本体が収まるグリッド位置に戻す', () => {
    // 幅 60 + 出力ピン 20、高さ 60
    expect(clampPosition(and, ports, { x: 1000, y: 1000 }, 410, 310)).toEqual({ x: 320, y: 240 });
  });

  it('モジュールは本体の上の名前の分も空ける', () => {
    const mod: Component = { id: 'm', kind: 'CUSTOM', x: 0, y: 0 };
    expect(clampPosition(mod, { inputs: [''], outputs: [''] }, { x: 0, y: 0 }, 400, 300).y).toBe(20);
  });
});
