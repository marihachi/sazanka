import { describe, expect, it } from 'vitest';
import {
  bodySize,
  clampMove,
  clampPosition,
  componentBounds,
  componentsInRect,
  GRID,
  SHEET_HEIGHT,
  SHEET_WIDTH,
  inputPinPos,
  outputPinPos,
  placeOffset,
  simplifyWire,
  snap,
  wiresInRect,
  wireStepTo,
} from './layout';
import type { Component, ComponentKind } from '../circuit/component';
import type { Project } from '../circuit/project';
import { portsOf } from '../circuit/module';

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
    expect(clampPosition(mod, { inputs: [''], outputs: [''] }, { x: 0, y: 0 }).y).toBe(20);
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
          // biome-ignore format: 表形式を維持するため
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
        expect(onGrid(p.x) && onGrid(p.y), `${kind} (${p.x}, ${p.y})`).toBe(true);
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
  // biome-ignore format: 表形式を維持するため
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

describe('componentsInRect', () => {
  const ports = { inputs: ['', ''], outputs: [''] };
  // AND の本体は 60×80
  // biome-ignore format: 表形式を維持するため
  const items = [
    { c: { id: 'a', kind: 'AND', x: 100, y: 100 } as Component, ports },
    { c: { id: 'b', kind: 'AND', x: 300, y: 100 } as Component, ports },
  ];

  it('本体の全体が収まる部品だけを選ぶ', () => {
    expect(componentsInRect(items, { x: 100, y: 100 }, { x: 160, y: 180 })).toEqual(['a']);
  });

  it('一部がかかっただけの部品は選ばない', () => {
    expect(componentsInRect(items, { x: 100, y: 100 }, { x: 159, y: 180 })).toEqual([]);
  });

  it('範囲の向き (どの角から始めたか) によらない', () => {
    expect(componentsInRect(items, { x: 400, y: 200 }, { x: 90, y: 90 })).toEqual(['a', 'b']);
  });
});

describe('placeOffset', () => {
  const ports = { inputs: ['', ''], outputs: [''] };

  it('全体の中心が指定した点に来るよう、グリッドに合わせて動かす', () => {
    // 範囲は左右のピンを含めて x: 80〜180、y: 100〜180 なので、中心は (130, 140)
    const items = [{ c: { id: 'a', kind: 'AND', x: 100, y: 100 } as Component, ports }];
    expect(placeOffset(items, [], { x: 530, y: 345 })).toEqual({ x: 400, y: 200 });
  });

  it('シートからはみ出す位置なら縮める', () => {
    const items = [{ c: { id: 'a', kind: 'AND', x: 100, y: 100 } as Component, ports }];
    expect(placeOffset(items, [], { x: 0, y: 0 })).toEqual({ x: -80, y: -100 });
  });
});

describe('placeOffset と配線の点', () => {
  it('配線の点も全体の範囲に含める', () => {
    // 点の範囲は x: 100〜300、y: 100 なので、中心は (200, 100)
    // biome-ignore format: 表形式を維持するため
    const points = [
      { x: 100, y: 100 },
      { x: 300, y: 100 },
    ];
    expect(placeOffset([], points, { x: 500, y: 300 })).toEqual({ x: 300, y: 200 });
  });

  it('配線の点がシートからはみ出す位置なら縮める', () => {
    expect(placeOffset([], [{ x: 100, y: 100 }], { x: -500, y: 50 })).toEqual({ x: -100, y: -40 });
  });
});

describe('clampMove と配線の点', () => {
  it('点がシートの端を越えないように縮める', () => {
    expect(clampMove([], { x: -60, y: 40 }, [{ x: 40, y: 0 }])).toEqual({ x: -40, y: 40 });
    expect(clampMove([], { x: 100, y: 0 }, [{ x: SHEET_WIDTH - 20, y: 0 }])).toEqual({
      x: 20,
      y: 0,
    });
  });
});

describe('wiresInRect', () => {
  // biome-ignore format: 表形式を維持するため
  const wires = [
    { id: 'a', points: [{ x: 100, y: 100 }, { x: 200, y: 100 }] },
    { id: 'b', points: [{ x: 100, y: 100 }, { x: 100, y: 300 }] },
  ];

  it('すべての点が範囲に収まる配線だけを選ぶ', () => {
    expect(wiresInRect(wires, { x: 90, y: 90 }, { x: 210, y: 110 })).toEqual(['a']);
    expect(wiresInRect(wires, { x: 210, y: 310 }, { x: 90, y: 90 })).toEqual(['a', 'b']);
  });
});

describe('wireStepTo', () => {
  it('最後の点から、動いた量の大きい方の向きにだけ伸ばす', () => {
    expect(wireStepTo({ x: 0, y: 0 }, { x: 100, y: 40 })).toEqual({ x: 100, y: 0 });
    expect(wireStepTo({ x: 0, y: 0 }, { x: 40, y: -100 })).toEqual({ x: 0, y: -100 });
  });

  it('同じだけ動いたときは横に伸ばす', () => {
    expect(wireStepTo({ x: 0, y: 0 }, { x: 40, y: 40 })).toEqual({ x: 40, y: 0 });
  });
});

describe('simplifyWire', () => {
  const pts = (...xy: [number, number][]) => xy.map(([x, y]) => ({ x, y }));

  it('同じ点が続くところと、まっすぐ進む途中の点を省く', () => {
    expect(simplifyWire(pts([0, 0], [40, 0], [40, 0], [80, 0], [80, 40]))).toEqual(
      pts([0, 0], [80, 0], [80, 40]),
    );
  });

  it('折り返す点は残す', () => {
    expect(simplifyWire(pts([0, 0], [80, 0], [40, 0]))).toEqual(pts([0, 0], [80, 0], [40, 0]));
  });
});
