import { describe, expect, it } from 'vitest';
import { clampPosition, GRID, inputPinPos, outputPinPos } from './layout';
import type { Component, ComponentKind } from './circuit';
import { portsOf, type Project } from './project';

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
    // 幅 60 + 出力ピン 20、高さ 80
    expect(clampPosition(and, ports, { x: 1000, y: 1000 }, 410, 310)).toEqual({ x: 320, y: 220 });
  });

  it('モジュールは本体の上の名前の分も空ける', () => {
    const mod: Component = { id: 'm', kind: 'CUSTOM', x: 0, y: 0 };
    expect(clampPosition(mod, { inputs: [''], outputs: [''] }, { x: 0, y: 0 }, 400, 300).y).toBe(20);
  });
});

describe('ピンの位置', () => {
  it('部品がグリッド上にあれば、すべてのピンの先端もグリッド上に来る', () => {
    const kinds: ComponentKind[] = [
      'AND',
      'OR',
      'NOT',
      'NAND',
      'NOR',
      'XOR',
      'BUF',
      'RS',
      'DFF',
      'TFF',
      'JKFF',
      'INPUT',
      'CLOCK',
      'HIGH',
      'OUTPUT',
      'CUSTOM',
    ];
    // ピンが 3 入力 2 出力のモジュール
    const project: Project = {
      circuits: [
        {
          id: 'mod',
          name: 'M',
          wires: [],
          components: [
            { id: 'a', kind: 'INPUT', x: 0, y: 0 },
            { id: 'b', kind: 'INPUT', x: 0, y: 40 },
            { id: 'c', kind: 'INPUT', x: 0, y: 80 },
            { id: 'p', kind: 'OUTPUT', x: 0, y: 0 },
            { id: 'q', kind: 'OUTPUT', x: 0, y: 40 },
          ],
        },
      ],
    };
    const onGrid = (v: number) => v % GRID === 0;
    for (const kind of kinds) {
      const c: Component = { id: 'x', kind, x: 2 * GRID, y: 3 * GRID, custom: 'mod' };
      const ports = portsOf(c, project);
      const pins = [
        ...ports.inputs.map((_, i) => inputPinPos(c, ports, i)),
        ...ports.outputs.map((_, i) => outputPinPos(c, ports, i)),
      ];
      for (const p of pins) expect(onGrid(p.x) && onGrid(p.y), `${kind} (${p.x}, ${p.y})`).toBe(true);
    }
  });
});
