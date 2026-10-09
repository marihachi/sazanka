import { describe, expect, it } from 'vitest';
import type { Part } from '../circuit/part';
import type { Wire } from '../circuit/circuit';
import type { Project } from '../circuit/project';
import { computeNets, isConflict, isOnWire, mergeWiresAt, netLinks } from './net';

const project: Project = { circuits: [] };

/** 点を (x, y) の組で並べた配線 */
function wire(id: string, ...points: [number, number][]): Wire {
  return { id, points: points.map(([x, y]) => ({ x, y })) };
}

// INPUT a の出力ピンの先は (60, 20)、INPUT b は (60, 220)。
// OUTPUT o の入力ピンの先は (380, 20)、OUTPUT p は (380, 220)
// biome-ignore format: 表形式を維持するため
const comps: Part[] = [
  { id: 'a', kind: 'input', x: 0, y: 0 },
  { id: 'b', kind: 'input', x: 0, y: 200 },
  { id: 'o', kind: 'output', x: 400, y: 0 },
  { id: 'p', kind: 'output', x: 400, y: 200 },
];

function nets(...wires: Wire[]) {
  return computeNets({ parts: comps, wires }, project);
}

describe('isOnWire', () => {
  const w = wire('w', [0, 0], [100, 0], [100, 100]);

  it('端・折れる点・途中は配線の上', () => {
    expect(isOnWire({ x: 0, y: 0 }, w)).toBe(true);
    expect(isOnWire({ x: 100, y: 0 }, w)).toBe(true);
    expect(isOnWire({ x: 50, y: 0 }, w)).toBe(true);
    expect(isOnWire({ x: 100, y: 60 }, w)).toBe(true);
  });

  it('線の延長や外れた点は配線の上ではない', () => {
    expect(isOnWire({ x: 120, y: 0 }, w)).toBe(false);
    expect(isOnWire({ x: 50, y: 20 }, w)).toBe(false);
  });
});

describe('computeNets', () => {
  it('配線の両端がピンの先にあれば、そのピンがつながる', () => {
    const {
      nets: [net],
    } = nets(wire('w', [60, 20], [380, 20]));
    expect(net.outputs).toEqual([{ comp: 'a', pin: 0 }]);
    expect(net.inputs).toEqual([{ comp: 'o', pin: 0 }]);
    expect(net.wires).toEqual(['w']);
  });

  it('配線の端が別の配線の途中にあれば、そこから分岐してつながり、分岐の印を描く', () => {
    const r = nets(
      wire('w1', [60, 20], [380, 20]),
      // w1 の途中 (200, 20) から下へ分岐して p へ
      wire('w2', [200, 20], [200, 220], [380, 220]),
    );
    expect(r.nets).toHaveLength(1);
    expect(r.nets[0].inputs).toEqual([
      { comp: 'o', pin: 0 },
      { comp: 'p', pin: 0 },
    ]);
    expect(r.junctions.map((j) => j.at)).toEqual([{ x: 200, y: 20 }]);
  });

  it('配線の途中どうしが交わるだけなら、つながらない (交差)', () => {
    const r = nets(
      wire('w1', [60, 20], [200, 20], [200, 220], [380, 220]),
      wire('w2', [60, 220], [100, 220], [100, 120], [300, 120], [300, 20], [380, 20]),
    );
    // w2 の横線 y=120 は、w1 の縦線 x=200 と (200, 120) で交わるが、どちらの端でもない
    expect(r.nets).toHaveLength(2);
    expect(r.wireNet.get('w1')?.inputs).toEqual([{ comp: 'p', pin: 0 }]);
    expect(r.wireNet.get('w2')?.inputs).toEqual([{ comp: 'o', pin: 0 }]);
    expect(r.junctions).toEqual([]);
  });

  it('配線の端が別の配線の折れる点にあれば、つながる', () => {
    const r = nets(wire('w1', [60, 20], [200, 20], [200, 220]), wire('w2', [200, 220], [380, 220]));
    expect(r.nets).toHaveLength(1);
    expect(r.nets[0].inputs).toEqual([{ comp: 'p', pin: 0 }]);
    // 配線の端どうしが 1 点で会うだけ (2 本) なので、分岐の印は描かない
    expect(r.junctions).toEqual([]);
  });

  it('配線の途中がピンの先を通るだけなら、そのピンにはつながらない', () => {
    // (380, 20) は o の入力ピンの先。配線はその上を通り過ぎる
    const {
      nets: [net],
    } = nets(wire('w', [60, 20], [500, 20]));
    expect(net.inputs).toEqual([]);
  });

  it('どこにもつながらない配線も、それだけでネットになる', () => {
    const { nets: list } = nets(wire('w', [600, 600], [700, 600]));
    expect(list).toEqual([{ outputs: [], inputs: [], wires: ['w'] }]);
  });

  it('同じピンに 2 本の配線の端があっても、ピンは 1 回だけ数え、ピンと 2 本で分岐の印を描く', () => {
    const r = nets(wire('w1', [60, 20], [380, 20]), wire('w2', [60, 20], [60, 100]));
    expect(r.nets[0].outputs).toEqual([{ comp: 'a', pin: 0 }]);
    expect(r.junctions.map((j) => j.at)).toEqual([{ x: 60, y: 20 }]);
  });
});

describe('出力のぶつかり', () => {
  const r = nets(
    wire('w1', [60, 20], [200, 20], [200, 220], [60, 220]),
    wire('w2', [200, 120], [380, 120], [380, 20]),
  );

  it('出力ピンが 2 つつながったネットはエラー', () => {
    expect(r.nets).toHaveLength(1);
    expect(isConflict(r.nets[0])).toBe(true);
  });

  it('エラーのネットの入力ピンは、どの出力ピンにもつながない (OFF になる)', () => {
    expect(netLinks(r.nets)).toEqual([]);
  });
});

describe('netLinks', () => {
  it('出力ピンが 1 つのネットでは、すべての入力ピンをその出力ピンにつなぐ', () => {
    const r = nets(wire('w1', [60, 20], [380, 20]), wire('w2', [200, 20], [200, 220], [380, 220]));
    expect(netLinks(r.nets)).toEqual([
      { from: { comp: 'a', pin: 0 }, to: { comp: 'o', pin: 0 } },
      { from: { comp: 'a', pin: 0 }, to: { comp: 'p', pin: 0 } },
    ]);
  });

  it('出力ピンのないネットからは何も作らない', () => {
    const r = nets(wire('w', [380, 20], [380, 220]));
    expect(netLinks(r.nets)).toEqual([]);
  });
});

describe('NC のピン', () => {
  it('NC のピンの先に配線の端があっても、つながらない', () => {
    // 4 ピンの dip のモジュール。1 番だけが入力 (A)、2〜4 番は NC
    const project: Project = {
      circuits: [
        { id: 'main', name: 'メイン', parts: [], wires: [] },
        {
          id: 'm',
          name: 'M',
          package: { kind: 'dip', pins: 4 },
          parts: [{ id: 'a', kind: 'input', x: 0, y: 0, pinNumber: 1 }],
          wires: [],
        },
      ],
    };
    // モジュールを (200, 200) に置くと、1 番の先は (180, 220)、2 番 (NC) の先は (180, 260)
    const parts: Part[] = [
      { id: 'u', kind: 'module', module: 'm', x: 200, y: 200 },
      { id: 'b', kind: 'input', x: 0, y: 200 },
    ];
    const toPin1 = computeNets({ parts, wires: [wire('w', [60, 220], [180, 220])] }, project);
    expect(toPin1.nets.find((n) => n.wires.includes('w'))?.inputs).toEqual([{ comp: 'u', pin: 0 }]);
    const toNc = computeNets({ parts, wires: [wire('w', [60, 220], [180, 260])] }, project);
    expect(toNc.nets.find((n) => n.wires.includes('w'))?.inputs).toEqual([]);
  });
});

describe('上下の辺のピン', () => {
  it('qfp のモジュールの上と下のピンの先に配線の端があれば、つながる', () => {
    // 8 ピンの qfp (1 辺 6 マス)。8 番 (上の辺の左から 2 マスめ) が入力、3 番 (下の辺の左から 2 マスめ) が出力
    const project: Project = {
      circuits: [
        { id: 'main', name: 'メイン', parts: [], wires: [] },
        {
          id: 'm',
          name: 'M',
          package: { kind: 'qfp', pins: 8 },
          // biome-ignore format: 表形式を維持するため
          parts: [
            { id: 'a', kind: 'input', x: 0, y: 0, pinNumber: 8 },
            { id: 'q', kind: 'output', x: 100, y: 0, pinNumber: 3 },
          ],
          wires: [],
        },
      ],
    };
    // モジュールを (200, 200) に置くと、8 番の先は (240, 180)、3 番の先は (240, 340)。
    // INPUT b の出力ピンの先は (60, 20)、OUTPUT o の入力ピンの先は (380, 320)
    const parts: Part[] = [
      { id: 'u', kind: 'module', module: 'm', x: 200, y: 200 },
      { id: 'b', kind: 'input', x: 0, y: 0 },
      { id: 'o', kind: 'output', x: 400, y: 300 },
    ];
    const result = computeNets(
      {
        parts,
        // biome-ignore format: 表形式を維持するため
        wires: [
          wire('top', [60, 20], [240, 20], [240, 180]),
          wire('bottom', [240, 340], [380, 340], [380, 320]),
        ],
      },
      project,
    );
    expect(result.nets.find((n) => n.wires.includes('top'))?.inputs).toEqual([
      { comp: 'u', pin: 0 },
    ]);
    expect(result.nets.find((n) => n.wires.includes('bottom'))?.outputs).toEqual([
      { comp: 'u', pin: 0 },
    ]);
  });
});

describe('mergeWiresAt', () => {
  function merge(points: [number, number][], ...wires: Wire[]) {
    const at = points.map(([x, y]) => ({ x, y }));
    return mergeWiresAt({ parts: comps, wires }, project, at);
  }

  /** 配線ごとに「ID: x,y x,y ...」の文字列にする (点の並びを 1 行で比べるため) */
  function shapes(result: ReturnType<typeof merge>): string[] {
    return result.circuit.wires.map(
      (w) => `${w.id}: ${w.points.map((p) => `${p.x},${p.y}`).join(' ')}`,
    );
  }

  it('まっすぐ続く 2 本は、途中の点を省いた 1 本にする', () => {
    const r = merge(
      [[100, 100]],
      wire('a', [0, 100], [100, 100]),
      wire('b', [100, 100], [200, 100]),
    );
    expect(shapes(r)).toEqual(['a: 0,100 200,100']);
    expect(r.replaced).toEqual(new Map([['b', 'a']]));
  });

  it('直角につながる 2 本は、折れる点のある 1 本にする', () => {
    const r = merge(
      [[100, 100]],
      wire('a', [0, 100], [100, 100]),
      wire('b', [100, 100], [100, 200]),
    );
    expect(shapes(r)).toEqual(['a: 0,100 100,100 100,200']);
  });

  it('先にある配線の ID と向きを引き継ぐ (向きが逆の配線もつなぐ)', () => {
    // a は (100,100) から始まる。a の向きを保つので、b → a の順になる
    const r = merge(
      [[100, 100]],
      wire('a', [100, 100], [200, 100]),
      wire('b', [0, 100], [100, 100]),
    );
    expect(shapes(r)).toEqual(['a: 0,100 200,100']);
    const r2 = merge(
      [[100, 100]],
      wire('a', [100, 100], [200, 100]),
      wire('b', [100, 100], [0, 100]),
    );
    expect(shapes(r2)).toEqual(['a: 0,100 200,100']);
  });

  it('渡した点でなければ結合しない', () => {
    const r = merge([[0, 100]], wire('a', [0, 100], [100, 100]), wire('b', [100, 100], [200, 100]));
    expect(r.circuit.wires).toHaveLength(2);
    expect(r.replaced.size).toBe(0);
  });

  it('分岐の点 (3 本以上の端、途中を通る配線) では結合しない', () => {
    const a = wire('a', [0, 100], [100, 100]);
    const b = wire('b', [100, 100], [200, 100]);
    const three = merge([[100, 100]], a, b, wire('c', [100, 100], [100, 200]));
    expect(three.circuit.wires).toHaveLength(3);
    // c の途中を通る点に、a と b の端がある
    const through = merge([[100, 100]], a, b, wire('c', [100, 0], [100, 200]));
    expect(through.circuit.wires).toHaveLength(3);
  });

  it('ピンの先では結合しない', () => {
    // (60, 20) は INPUT a の出力ピンの先
    const r = merge(
      [[60, 20]],
      wire('a', [0, 60], [60, 60], [60, 20]),
      wire('b', [60, 20], [200, 20]),
    );
    expect(r.circuit.wires).toHaveLength(2);
  });

  it('同じ配線の両端の点や、同じ向きに出て重なる 2 本は結合しない', () => {
    const loop = merge([[0, 0]], wire('a', [0, 0], [100, 0], [100, 100], [0, 100], [0, 0]));
    expect(loop.circuit.wires).toHaveLength(1);
    const overlap = merge(
      [[100, 100]],
      wire('a', [0, 100], [100, 100]),
      wire('b', [100, 100], [40, 100]),
    );
    expect(overlap.circuit.wires).toHaveLength(2);
  });

  it('続けて結合したときは、最後に残った配線を指す', () => {
    // b を a に結合し、そのあと a を c に結合する (c が先にあるので c が残る)
    const c = wire('c', [-100, 100], [0, 100]);
    const a = wire('a', [0, 100], [100, 100]);
    const b = wire('b', [100, 100], [200, 100]);
    const r = merge(
      [
        [100, 100],
        [0, 100],
      ],
      c,
      a,
      b,
    );
    expect(shapes(r)).toEqual(['c: -100,100 200,100']);
    expect(r.replaced).toEqual(
      new Map([
        ['b', 'c'],
        ['a', 'c'],
      ]),
    );
  });

  it('結合の前後でネットは変わらない', () => {
    // INPUT a の出力 (60, 20) から OUTPUT o の入力 (380, 20) へ、2 本をつないで引いた配線
    const wires = [wire('w1', [60, 20], [200, 20]), wire('w2', [200, 20], [380, 20])];
    const r = merge([[200, 20]], ...wires);
    const before = nets(...wires).nets.map((n) => [n.outputs, n.inputs]);
    const after = computeNets(r.circuit, project).nets.map((n) => [n.outputs, n.inputs]);
    expect(r.circuit.wires).toHaveLength(1);
    expect(after).toEqual(before);
  });
});
