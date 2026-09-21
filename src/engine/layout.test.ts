import { describe, expect, it } from 'vitest';
import { bodySize, clampPosition, GRID, inputPinPos, outputPinPos, snap } from './layout';
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

describe('bodySize', () => {
  const comp = (kind: ComponentKind): Component => ({ id: 'x', kind, x: 0, y: 0 });
  const none = { inputs: [], outputs: [] };

  it('入出力の部品は正方形、ゲートとフリップフロップは同じ高さ', () => {
    expect(bodySize(comp('INPUT'), none)).toEqual({ w: 40, h: 40 });
    expect(bodySize(comp('HIGH'), none)).toEqual({ w: 40, h: 40 });
    expect(bodySize(comp('OUTPUT'), none)).toEqual({ w: 40, h: 40 });
    expect(bodySize(comp('AND'), none)).toEqual({ w: 60, h: 80 });
    expect(bodySize(comp('DFF'), none)).toEqual({ w: 60, h: 80 });
  });

  it('モジュールはピンの多いほうに合わせて高くなる', () => {
    const size = (nIn: number, nOut: number) =>
      bodySize(comp('CUSTOM'), { inputs: Array(nIn).fill(''), outputs: Array(nOut).fill('') });
    expect(size(0, 0)).toEqual({ w: 80, h: 2 * GRID });
    expect(size(1, 1)).toEqual({ w: 80, h: 2 * GRID });
    expect(size(3, 1)).toEqual({ w: 80, h: 4 * GRID });
    expect(size(1, 4)).toEqual({ w: 80, h: 5 * GRID });
  });
});

describe('ピンの位置', () => {
  it('2入力のゲートは上下端から1グリッド内側、出力は中央', () => {
    const and: Component = { id: 'g', kind: 'AND', x: 100, y: 100 };
    const ports = { inputs: ['', ''], outputs: [''] };
    expect(inputPinPos(and, ports, 0)).toEqual({ x: 80, y: 120 });
    expect(inputPinPos(and, ports, 1)).toEqual({ x: 80, y: 160 });
    expect(outputPinPos(and, ports, 0)).toEqual({ x: 180, y: 140 });
  });

  it('1入力のゲートは入力も中央', () => {
    const not: Component = { id: 'n', kind: 'NOT', x: 100, y: 100 };
    expect(inputPinPos(not, { inputs: [''], outputs: [''] }, 0)).toEqual({ x: 80, y: 140 });
  });

  it('フリップフロップは入力が上から順、Q と Q̄ は上下端から1グリッド内側', () => {
    const ff: Component = { id: 'f', kind: 'DFF', x: 100, y: 100 };
    const ports = { inputs: ['D', '>'], outputs: ['Q', 'Q̄'] };
    expect(inputPinPos(ff, ports, 0).y).toBe(120);
    expect(inputPinPos(ff, ports, 1).y).toBe(140);
    expect(outputPinPos(ff, ports, 0).y).toBe(120);
    expect(outputPinPos(ff, ports, 1).y).toBe(160);
  });
});

describe('snap', () => {
  it('一番近いグリッドに寄せる', () => {
    expect([snap(0), snap(9), snap(11), snap(-11)]).toEqual([0, 0, 20, -20]);
    // -9 は -0 になるため、値として比べる
    expect(snap(-9) === 0).toBe(true);
  });
});
