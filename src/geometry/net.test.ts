import { describe, expect, it } from 'vitest';
import type { Part } from '../circuit/part';
import type { Wire } from '../circuit/circuit';
import type { Project } from '../circuit/project';
import { computeNets, isConflict, isOnWire, netLinks } from './net';

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
          footprint: { kind: 'dip', pins: 4 },
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
