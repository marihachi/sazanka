import { describe, expect, it } from 'vitest';
import {
  bodySize,
  clampMove,
  clampPosition,
  componentBounds,
  GRID,
  SHEET_HEIGHT,
  SHEET_WIDTH,
  inputPinPos,
  outputPinPos,
  snap,
  wireRoute,
} from './layout';
import type { Component, ComponentKind } from './component';
import type { Project } from './project';
import { portsOf } from './module';

describe('clampPosition', () => {
  const and: Component = { id: 'g', kind: 'AND', x: 0, y: 0 };
  const ports = { inputs: ['', ''], outputs: [''] };

  it('シートの中ならそのまま', () => {
    expect(clampPosition(and, ports, { x: 100, y: 100 })).toEqual({
      x: 100,
      y: 100,
    });
  });

  it('左上にはみ出すと、入力ピンの先端が収まる位置に戻す', () => {
    expect(clampPosition(and, ports, { x: -60, y: -40 })).toEqual({
      x: 20,
      y: 0,
    });
  });

  it('右下にはみ出すと、出力ピンの先端と本体が収まるグリッド位置に戻す', () => {
    // 幅 60 + 出力ピン 20、高さ 80
    expect(clampPosition(and, ports, { x: 99999, y: 99999 })).toEqual({
      x: SHEET_WIDTH - 80,
      y: SHEET_HEIGHT - 80,
    });
  });

  it('モジュールは本体の上の名前の分も空ける', () => {
    const mod: Component = { id: 'm', kind: 'CUSTOM', x: 0, y: 0 };
    expect(
      clampPosition(mod, { inputs: [''], outputs: [''] }, { x: 0, y: 0 }).y,
    ).toBe(20);
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
      'RSEN',
      'DLATCH',
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
      const c: Component = {
        id: 'x',
        kind,
        x: 2 * GRID,
        y: 3 * GRID,
        custom: 'mod',
      };
      const ports = portsOf(c, project);
      const pins = [
        ...ports.inputs.map((_, i) => inputPinPos(c, ports, i)),
        ...ports.outputs.map((_, i) => outputPinPos(c, ports, i)),
      ];
      for (const p of pins) {
        expect(onGrid(p.x) && onGrid(p.y), `${kind} (${p.x}, ${p.y})`).toBe(
          true,
        );
      }
    }
  });
});

describe('bodySize', () => {
  const comp = (kind: ComponentKind): Component => ({
    id: 'x',
    kind,
    x: 0,
    y: 0,
  });
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
      bodySize(comp('CUSTOM'), {
        inputs: Array(nIn).fill(''),
        outputs: Array(nOut).fill(''),
      });
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
    expect(inputPinPos(not, { inputs: [''], outputs: [''] }, 0)).toEqual({
      x: 80,
      y: 140,
    });
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

describe('clampMove', () => {
  const ports = { inputs: ['', ''], outputs: [''] };
  const items = [
    { c: { id: 'a', kind: 'AND', x: 100, y: 100 } as Component, ports },
    { c: { id: 'b', kind: 'AND', x: 200, y: 20 } as Component, ports },
  ];

  it('どれもはみ出さなければそのまま', () => {
    expect(clampMove(items, { x: 20, y: 0 })).toEqual({ x: 20, y: 0 });
  });

  it('どれか1つでも左上にはみ出すなら、全体の移動を縮める', () => {
    // b は上に 20 までしか動けない。a は左に 80 までしか動けない
    expect(clampMove(items, { x: -200, y: -100 })).toEqual({ x: -80, y: -20 });
  });
});

describe('componentBounds', () => {
  it('本体に、左右のピンの先端を含める', () => {
    const and: Component = { id: 'g', kind: 'AND', x: 100, y: 100 };
    expect(componentBounds(and, { inputs: ['', ''], outputs: [''] })).toEqual({
      left: 80,
      top: 100,
      right: 180,
      bottom: 180,
    });
  });

  it('モジュールは本体の上の名前の分も含める', () => {
    const mod: Component = { id: 'm', kind: 'CUSTOM', x: 100, y: 100 };
    expect(componentBounds(mod, { inputs: [''], outputs: [''] }).top).toBe(80);
  });
});

describe('wireRoute', () => {
  const axisAligned = (route: { x: number; y: number }[]) =>
    route.every(
      (p, i) => i === 0 || p.x === route[i - 1].x || p.y === route[i - 1].y,
    );

  it('折れる点がなければ、中間で1回折れる', () => {
    expect(wireRoute({ x: 0, y: 0 }, [], { x: 100, y: 40 })).toEqual([
      { x: 0, y: 0 },
      { x: 60, y: 0 },
      { x: 60, y: 40 },
      { x: 100, y: 40 },
    ]);
  });

  it('折れる点を順に通り、縦横の線だけでつなぐ', () => {
    const points = [
      { x: 200, y: 100 },
      { x: 60, y: 200 },
    ];
    const route = wireRoute({ x: 0, y: 0 }, points, { x: 300, y: 300 });
    expect(axisAligned(route)).toBe(true);
    // 置いた点は、どこかの区間の上を通る (曲がらない点は、点の並びからは省かれる)
    const onRoute = (p: { x: number; y: number }) =>
      route.some((q, i) => {
        if (i === 0) {
          return false;
        }
        const r = route[i - 1];
        return (
          p.x >= Math.min(q.x, r.x) &&
          p.x <= Math.max(q.x, r.x) &&
          p.y >= Math.min(q.y, r.y) &&
          p.y <= Math.max(q.y, r.y)
        );
      });
    for (const p of points) {
      expect(onRoute(p)).toBe(true);
    }
  });

  it('両端が同じ高さなら、折れずにまっすぐつなぐ', () => {
    expect(wireRoute({ x: 0, y: 40 }, [], { x: 100, y: 40 })).toEqual([
      { x: 0, y: 40 },
      { x: 100, y: 40 },
    ]);
    // 折れる点が一直線に並んでいても、長さ 0 の区間や曲がらない角を残さない
    expect(
      wireRoute({ x: 0, y: 40 }, [{ x: 60, y: 40 }], { x: 100, y: 40 }),
    ).toEqual([
      { x: 0, y: 40 },
      { x: 100, y: 40 },
    ]);
  });

  it('入力ピンへは横から入る', () => {
    const route = wireRoute({ x: 0, y: 0 }, [{ x: 200, y: 100 }], {
      x: 300,
      y: 300,
    });
    const [a, b] = route.slice(-2);
    expect(a.y).toBe(b.y);
  });
});
