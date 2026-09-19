import { describe, expect, it } from 'vitest';
import { dependsOn, MAIN_ID, portsOf, simulateCircuit, type CircuitDef, type Project } from './project';
import type { Component, SimResult, Wire } from './sim';

function comp(id: string, kind: Component['kind'], y = 0, extra: Partial<Component> = {}): Component {
  return { id, kind, x: 0, y, ...extra };
}

function wire(from: string, fromPin: number, to: string, toPin: number): Wire {
  return { id: `${from}.${fromPin}-${to}.${toPin}`, from: { comp: from, pin: fromPin }, to: { comp: to, pin: toPin } };
}

/** 半加算器: 入力 A, B / 出力 S, C */
const halfAdder: CircuitDef = {
  id: 'ha',
  name: 'HalfAdder',
  components: [
    comp('a', 'INPUT', 0, { label: 'A' }),
    comp('b', 'INPUT', 40, { label: 'B' }),
    comp('x', 'XOR'),
    comp('n', 'AND'),
    comp('s', 'OUTPUT', 0, { label: 'S' }),
    comp('c', 'OUTPUT', 40, { label: 'C' }),
  ],
  wires: [
    wire('a', 0, 'x', 0),
    wire('b', 0, 'x', 1),
    wire('a', 0, 'n', 0),
    wire('b', 0, 'n', 1),
    wire('x', 0, 's', 0),
    wire('n', 0, 'c', 0),
  ],
};

/** 全加算器: 半加算器2つと OR。入力 A, B, Cin / 出力 S, Cout */
const fullAdder: CircuitDef = {
  id: 'fa',
  name: 'FullAdder',
  components: [
    comp('a', 'INPUT', 0),
    comp('b', 'INPUT', 20),
    comp('ci', 'INPUT', 40),
    comp('h1', 'CUSTOM', 0, { custom: 'ha' }),
    comp('h2', 'CUSTOM', 0, { custom: 'ha' }),
    comp('or', 'OR'),
    comp('s', 'OUTPUT', 0),
    comp('co', 'OUTPUT', 20),
  ],
  wires: [
    wire('a', 0, 'h1', 0),
    wire('b', 0, 'h1', 1),
    wire('h1', 0, 'h2', 0),
    wire('ci', 0, 'h2', 1),
    wire('h2', 0, 's', 0),
    wire('h1', 1, 'or', 0),
    wire('h2', 1, 'or', 1),
    wire('or', 0, 'co', 0),
  ],
};

function mainWith(custom: string, nIn: number, nOut: number, ins: boolean[]): CircuitDef {
  return {
    id: MAIN_ID,
    name: 'メイン',
    components: [
      ...ins.map((on, i) => comp(`i${i}`, 'INPUT', i * 20, { on })),
      comp('u', 'CUSTOM', 0, { custom }),
      ...Array.from({ length: nOut }, (_, j) => comp(`o${j}`, 'OUTPUT', j * 20)),
    ],
    wires: [
      ...Array.from({ length: nIn }, (_, i) => wire(`i${i}`, 0, 'u', i)),
      ...Array.from({ length: nOut }, (_, j) => wire('u', j, `o${j}`, 0)),
    ],
  };
}

describe('モジュール', () => {
  it('ピン名は INPUT / OUTPUT のラベルを上から順に並べたもの', () => {
    const project: Project = { circuits: [mainWith('ha', 2, 2, [false, false]), halfAdder] };
    expect(portsOf(comp('u', 'CUSTOM', 0, { custom: 'ha' }), project)).toEqual({ inputs: ['A', 'B'], outputs: ['S', 'C'] });
  });

  it('半加算器', () => {
    for (const [a, b] of [
      [false, false],
      [false, true],
      [true, false],
      [true, true],
    ]) {
      const project: Project = { circuits: [mainWith('ha', 2, 2, [a, b]), halfAdder] };
      const r = simulateCircuit(project, MAIN_ID);
      expect([r.values.get('o0:0'), r.values.get('o1:0')]).toEqual([a !== b, a && b]);
      // 最上位のモジュールの出力ピンにも値が入る
      expect(r.values.get('u:1')).toBe(a && b);
    }
  });

  it('入れ子のモジュール (全加算器)', () => {
    for (let n = 0; n < 8; n++) {
      const ins = [!!(n & 1), !!(n & 2), !!(n & 4)];
      const project: Project = { circuits: [mainWith('fa', 3, 2, ins), halfAdder, fullAdder] };
      const r = simulateCircuit(project, MAIN_ID);
      const sum = ins.filter(Boolean).length;
      expect([r.values.get('o0:0'), r.values.get('o1:0')]).toEqual([sum % 2 === 1, sum >= 2]);
    }
  });

  it('モジュールの中のフリップフロップが状態を保つ', () => {
    const reg: CircuitDef = {
      id: 'reg',
      name: 'Reg',
      components: [comp('d', 'INPUT', 0), comp('clk', 'INPUT', 20), comp('ff', 'DFF'), comp('q', 'OUTPUT')],
      wires: [wire('d', 0, 'ff', 0), wire('clk', 0, 'ff', 1), wire('ff', 0, 'q', 0)],
    };
    let r: SimResult | undefined;
    const step = (d: boolean, clk: boolean) => {
      r = simulateCircuit({ circuits: [mainWith('reg', 2, 1, [d, clk]), reg] }, MAIN_ID, r);
      return r.values.get('o0:0');
    };
    expect(step(true, false)).toBe(false);
    expect(step(true, true)).toBe(true);
    expect(step(false, false)).toBe(true);
    expect(step(false, true)).toBe(false);
  });

  it('循環参照は展開しない', () => {
    const a: CircuitDef = { id: 'a', name: 'A', components: [comp('s', 'CUSTOM', 0, { custom: 'b' })], wires: [] };
    const b: CircuitDef = { id: 'b', name: 'B', components: [comp('s', 'CUSTOM', 0, { custom: 'a' })], wires: [] };
    const project: Project = { circuits: [mainWith('a', 0, 0, []), a, b] };
    expect(dependsOn(project, 'a', 'b')).toBe(true);
    expect(dependsOn(project, 'b', 'a')).toBe(true);
    expect(dependsOn(project, 'a', MAIN_ID)).toBe(false);
    expect(() => simulateCircuit(project, MAIN_ID)).not.toThrow();
  });
});
