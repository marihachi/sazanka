import { describe, expect, it } from 'vitest';
import {
  bodySize,
  clampMove,
  clampPosition,
  partBounds,
  partsInRect,
  GRID,
  SHEET_HEIGHT,
  SHEET_WIDTH,
  inputPinPos,
  calcMarginAroundBody,
  outputPinPos,
  placeOffset,
  toSheetPin,
  simplifyWire,
  snap,
  wiresInRect,
  wireStepTo,
} from './layout';
import type { Part, PartKind } from '../circuit/part';
import type { Project } from '../circuit/project';
import { getPinout } from '../circuit/module';
import type { PartLayout } from '../parts/layout';

describe('clampPosition', () => {
  const and: Part = { id: 'g', kind: 'and', x: 0, y: 0 };
  const pinout = { inputs: ['', ''], outputs: [''] };

  it('シートの中ならそのまま', () => {
    expect(clampPosition(and, pinout, { x: 100, y: 100 })).toEqual({
      x: 100,
      y: 100,
    });
  });

  it('左上にはみ出すと、入力ピンの先端が収まる位置に戻す', () => {
    expect(clampPosition(and, pinout, { x: -60, y: -40 })).toEqual({
      x: 20,
      y: 0,
    });
  });

  it('右下にはみ出すと、出力ピンの先端と本体が収まるグリッド位置に戻す', () => {
    // 幅 60 + 出力ピン 20、高さ 80
    expect(clampPosition(and, pinout, { x: 99999, y: 99999 })).toEqual({
      x: SHEET_WIDTH - 80,
      y: SHEET_HEIGHT - 80,
    });
  });

  it('モジュールは本体の上の名前の分も空ける', () => {
    const mod: Part = { id: 'm', kind: 'module', x: 0, y: 0 };
    expect(clampPosition(mod, { inputs: [''], outputs: [''] }, { x: 0, y: 0 }).y).toBe(20);
  });
});

describe('ピンの位置', () => {
  it('部品がグリッド上にあれば、すべてのピンの先端もグリッド上に来る', () => {
    const kinds: PartKind[] = [
      'and',
      'or',
      'not',
      'nand',
      'nor',
      'xor',
      'buf',
      'rsLatch',
      'rsEnLatch',
      'dLatch',
      'dFlipFlop',
      'tFlipFlop',
      'jkFlipFlop',
      'input',
      'clock',
      'high',
      'output',
      'module',
    ];
    // ピンが 3 入力 2 出力のモジュール
    const project: Project = {
      circuits: [
        {
          id: 'mod',
          name: 'M',
          wires: [],
          // biome-ignore format: 表形式を維持するため
          parts: [
            { id: 'a', kind: 'input', x: 0, y: 0 },
            { id: 'b', kind: 'input', x: 0, y: 40 },
            { id: 'c', kind: 'input', x: 0, y: 80 },
            { id: 'p', kind: 'output', x: 0, y: 0 },
            { id: 'q', kind: 'output', x: 0, y: 40 },
          ],
        },
      ],
    };
    const onGrid = (v: number) => v % GRID === 0;
    for (const kind of kinds) {
      const c: Part = {
        id: 'x',
        kind,
        x: 2 * GRID,
        y: 3 * GRID,
        module: 'mod',
      };
      const pinout = getPinout(c, project);
      const pins = [
        ...pinout.inputs.map((_, i) => inputPinPos(c, pinout, i)),
        ...pinout.outputs.map((_, i) => outputPinPos(c, pinout, i)),
      ];
      for (const p of pins) {
        expect(onGrid(p.x) && onGrid(p.y), `${kind} (${p.x}, ${p.y})`).toBe(true);
      }
    }
  });
});

describe('bodySize', () => {
  const comp = (kind: PartKind): Part => ({
    id: 'x',
    kind,
    x: 0,
    y: 0,
  });
  const none = { inputs: [], outputs: [] };

  it('入出力の部品は正方形、ゲートとフリップフロップは同じ高さ', () => {
    expect(bodySize(comp('input'), none)).toEqual({ w: 40, h: 40 });
    expect(bodySize(comp('high'), none)).toEqual({ w: 40, h: 40 });
    expect(bodySize(comp('output'), none)).toEqual({ w: 40, h: 40 });
    expect(bodySize(comp('and'), none)).toEqual({ w: 60, h: 80 });
    expect(bodySize(comp('dFlipFlop'), none)).toEqual({ w: 60, h: 80 });
  });

  it('モジュールはピンの多いほうに合わせて高くなる', () => {
    const size = (nIn: number, nOut: number) =>
      bodySize(comp('module'), {
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
    const and: Part = { id: 'g', kind: 'and', x: 100, y: 100 };
    const pinout = { inputs: ['', ''], outputs: [''] };
    expect(inputPinPos(and, pinout, 0)).toEqual({ x: 80, y: 120 });
    expect(inputPinPos(and, pinout, 1)).toEqual({ x: 80, y: 160 });
    expect(outputPinPos(and, pinout, 0)).toEqual({ x: 180, y: 140 });
  });

  it('1入力のゲートは入力も中央', () => {
    const not: Part = { id: 'n', kind: 'not', x: 100, y: 100 };
    expect(inputPinPos(not, { inputs: [''], outputs: [''] }, 0)).toEqual({
      x: 80,
      y: 140,
    });
  });

  it('フリップフロップは入力が上から順、Q と Q̄ は上下端から1グリッド内側', () => {
    const ff: Part = { id: 'f', kind: 'dFlipFlop', x: 100, y: 100 };
    const pinout = { inputs: ['D', '>'], outputs: ['Q', 'Q̄'] };
    expect(inputPinPos(ff, pinout, 0).y).toBe(120);
    expect(inputPinPos(ff, pinout, 1).y).toBe(140);
    expect(outputPinPos(ff, pinout, 0).y).toBe(120);
    expect(outputPinPos(ff, pinout, 1).y).toBe(160);
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
  const pinout = { inputs: ['', ''], outputs: [''] };
  // biome-ignore format: 表形式を維持するため
  const items = [
    { c: { id: 'a', kind: 'and', x: 100, y: 100 } as Part, pinout },
    { c: { id: 'b', kind: 'and', x: 200, y: 20 } as Part, pinout },
  ];

  it('どれもはみ出さなければそのまま', () => {
    expect(clampMove(items, { x: 20, y: 0 })).toEqual({ x: 20, y: 0 });
  });

  it('どれか1つでも左上にはみ出すなら、全体の移動を縮める', () => {
    // b は上に 20 までしか動けない。a は左に 80 までしか動けない
    expect(clampMove(items, { x: -200, y: -100 })).toEqual({ x: -80, y: -20 });
  });
});

describe('partBounds', () => {
  it('本体に、左右のピンの先端を含める', () => {
    const and: Part = { id: 'g', kind: 'and', x: 100, y: 100 };
    expect(partBounds(and, { inputs: ['', ''], outputs: [''] })).toEqual({
      left: 80,
      top: 100,
      right: 180,
      bottom: 180,
    });
  });

  it('モジュールは本体の上の名前の分も含める', () => {
    const mod: Part = { id: 'm', kind: 'module', x: 100, y: 100 };
    expect(partBounds(mod, { inputs: [''], outputs: [''] }).top).toBe(80);
  });
});

describe('ピンの辺', () => {
  // 幅 3、高さ 4 マスの本体の、4 つの辺に 1 本ずつピンを置いた配置
  const layout: PartLayout = {
    w: 3,
    h: 4,
    body: 'rect',
    inputs: [
      { side: 'left', at: 1 },
      { side: 'top', at: 2 },
    ],
    outputs: [
      { side: 'right', at: 3 },
      { side: 'bottom', at: 1 },
    ],
    nameAbove: false,
  };
  const c: Part = { id: 'x', kind: 'module', x: 100, y: 100 };

  it('根元は辺の上、先端は辺から 1 マス外に来る', () => {
    // biome-ignore format: 表形式を維持するため
    expect([...layout.inputs, ...layout.outputs].map((p) => toSheetPin(c, layout, p))).toEqual([
      { side: 'left', base: { x: 100, y: 120 }, tip: { x: 80, y: 120 } },
      { side: 'top', base: { x: 140, y: 100 }, tip: { x: 140, y: 80 } },
      { side: 'right', base: { x: 160, y: 160 }, tip: { x: 180, y: 160 } },
      { side: 'bottom', base: { x: 120, y: 180 }, tip: { x: 120, y: 200 } },
    ]);
  });

  it('上下は、その辺にピンがあるときだけ外の幅を取る', () => {
    expect(calcMarginAroundBody(layout)).toEqual({ left: 20, top: 20, right: 20, bottom: 20 });
    const sides: PartLayout = {
      ...layout,
      inputs: [layout.inputs[0]],
      outputs: [layout.outputs[0]],
    };
    expect(calcMarginAroundBody(sides)).toEqual({ left: 20, top: 0, right: 20, bottom: 0 });
  });
});

describe('partsInRect', () => {
  const pinout = { inputs: ['', ''], outputs: [''] };
  // AND の本体は 60×80
  // biome-ignore format: 表形式を維持するため
  const items = [
    { c: { id: 'a', kind: 'and', x: 100, y: 100 } as Part, pinout },
    { c: { id: 'b', kind: 'and', x: 300, y: 100 } as Part, pinout },
  ];

  it('本体の全体が収まる部品だけを選ぶ', () => {
    expect(partsInRect(items, { x: 100, y: 100 }, { x: 160, y: 180 })).toEqual(['a']);
  });

  it('一部がかかっただけの部品は選ばない', () => {
    expect(partsInRect(items, { x: 100, y: 100 }, { x: 159, y: 180 })).toEqual([]);
  });

  it('範囲の向き (どの角から始めたか) によらない', () => {
    expect(partsInRect(items, { x: 400, y: 200 }, { x: 90, y: 90 })).toEqual(['a', 'b']);
  });
});

describe('placeOffset', () => {
  const pinout = { inputs: ['', ''], outputs: [''] };

  it('全体の中心が指定した点に来るよう、グリッドに合わせて動かす', () => {
    // 範囲は左右のピンを含めて x: 80〜180、y: 100〜180 なので、中心は (130, 140)
    const items = [{ c: { id: 'a', kind: 'and', x: 100, y: 100 } as Part, pinout }];
    expect(placeOffset(items, [], { x: 530, y: 345 })).toEqual({ x: 400, y: 200 });
  });

  it('シートからはみ出す位置なら縮める', () => {
    const items = [{ c: { id: 'a', kind: 'and', x: 100, y: 100 } as Part, pinout }];
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
