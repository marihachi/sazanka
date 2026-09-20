import { describe, expect, it } from 'vitest';
import {
  dependsOn,
  MAIN_ID,
  portsOf,
  type CircuitDef,
  type Project,
  type Circuit,
  type Component,
  type Wire,
  type FlipFlopKind,
  type GateKind,
} from './project';
import { simulateCore, simulate, type SimResult } from './sim';

function twoInput(kind: GateKind, a: boolean, b: boolean): boolean {
  const comps: Component[] = [
    { id: 'a', kind: 'INPUT', x: 0, y: 0, on: a },
    { id: 'b', kind: 'INPUT', x: 0, y: 0, on: b },
    { id: 'g', kind, x: 0, y: 0 },
    { id: 'o', kind: 'OUTPUT', x: 0, y: 0 },
  ];
  const circuit: Circuit = {
    components: comps,
    wires: [
      { id: 'w1', from: { comp: 'a', pin: 0 }, to: { comp: 'g', pin: 0 } },
      { id: 'w2', from: { comp: 'b', pin: 0 }, to: { comp: 'g', pin: 1 } },
      { id: 'w3', from: { comp: 'g', pin: 0 }, to: { comp: 'o', pin: 0 } },
    ],
  };
  return simulateCore(circuit).values.get('o:0')!;
}

describe('simulate', () => {
  const table: [GateKind, boolean[]][] = [
    ['AND', [false, false, false, true]],
    ['OR', [false, true, true, true]],
    ['NAND', [true, true, true, false]],
    ['NOR', [true, false, false, false]],
    ['XOR', [false, true, true, false]],
  ];
  for (const [kind, expected] of table) {
    it(`${kind} の真理値表`, () => {
      const got = [
        twoInput(kind, false, false),
        twoInput(kind, false, true),
        twoInput(kind, true, false),
        twoInput(kind, true, true),
      ];
      expect(got).toEqual(expected);
    });
  }

  /** 入力スイッチ a の値を部品 g の pin 0 に入れたときの g の出力 */
  function oneInput(kind: 'NOT' | 'BUF', a: boolean): boolean {
    const r = simulateCore({
      components: [
        { id: 'a', kind: 'INPUT', x: 0, y: 0, on: a },
        { id: 'g', kind, x: 0, y: 0 },
      ],
      wires: [{ id: 'w', from: { comp: 'a', pin: 0 }, to: { comp: 'g', pin: 0 } }],
    });
    return r.values.get('g:0')!;
  }

  it('NOT は反転し、BUF はそのまま出す', () => {
    expect([oneInput('NOT', false), oneInput('NOT', true)]).toEqual([true, false]);
    expect([oneInput('BUF', false), oneInput('BUF', true)]).toEqual([false, true]);
  });

  it('何もつながっていない入力ピンは OFF として扱う', () => {
    const r = simulateCore({
      components: [
        { id: 'n', kind: 'NOT', x: 0, y: 0 },
        { id: 'o', kind: 'OUTPUT', x: 0, y: 0 },
      ],
      wires: [],
    });
    expect(r.values.get('n:0')).toBe(true);
    // OUTPUT は入力の値を pin 0 に持つ
    expect(r.values.get('o:0')).toBe(false);
  });

  it('HIGH は何もつながなくても常に ON を出す', () => {
    const r = simulateCore({
      components: [
        { id: 'h', kind: 'HIGH', x: 0, y: 0 },
        { id: 'n', kind: 'NOT', x: 0, y: 0 },
      ],
      wires: [{ id: 'w', from: { comp: 'h', pin: 0 }, to: { comp: 'n', pin: 0 } }],
    });
    expect(r.values.get('h:0')).toBe(true);
    expect(r.values.get('n:0')).toBe(false);
  });

  it('CLOCK は on の値をそのまま出す', () => {
    const r = simulateCore({ components: [{ id: 'k', kind: 'CLOCK', x: 0, y: 0, on: true }], wires: [] });
    expect(r.values.get('k:0')).toBe(true);
  });

  it('NOT の発振ループを検出する', () => {
    const r = simulateCore({
      components: [{ id: 'n', kind: 'NOT', x: 0, y: 0 }],
      wires: [{ id: 'w', from: { comp: 'n', pin: 0 }, to: { comp: 'n', pin: 0 } }],
    });
    expect(r.unstable).toBe(true);
  });

  it('NOR で組んだ RS ラッチが状態を保持する', () => {
    const build = (s: boolean, r: boolean): Circuit => ({
      components: [
        { id: 's', kind: 'INPUT', x: 0, y: 0, on: s },
        { id: 'r', kind: 'INPUT', x: 0, y: 0, on: r },
        { id: 'q', kind: 'NOR', x: 0, y: 0 },
        { id: 'qn', kind: 'NOR', x: 0, y: 0 },
      ],
      wires: [
        { id: '1', from: { comp: 'r', pin: 0 }, to: { comp: 'q', pin: 0 } },
        { id: '2', from: { comp: 'qn', pin: 0 }, to: { comp: 'q', pin: 1 } },
        { id: '3', from: { comp: 's', pin: 0 }, to: { comp: 'qn', pin: 0 } },
        { id: '4', from: { comp: 'q', pin: 0 }, to: { comp: 'qn', pin: 1 } },
      ],
    });
    let r = simulateCore(build(true, false));
    expect(r.values.get('q:0')).toBe(true);
    r = simulateCore(build(false, false), r);
    expect(r.values.get('q:0')).toBe(true);
    r = simulateCore(build(false, true), r);
    expect(r.values.get('q:0')).toBe(false);
    r = simulateCore(build(false, false), r);
    expect(r.values.get('q:0')).toBe(false);
  });

  describe('フリップフロップ', () => {
    /** 入力スイッチ in0..inN を部品 f の各入力ピンにつないだ回路 */
    function build(kind: FlipFlopKind, ins: boolean[]): Circuit {
      return {
        components: [
          ...ins.map((on, i): Component => ({ id: `in${i}`, kind: 'INPUT', x: 0, y: 0, on })),
          { id: 'f', kind, x: 0, y: 0 },
        ],
        wires: ins.map((_, i) => ({ id: `w${i}`, from: { comp: `in${i}`, pin: 0 }, to: { comp: 'f', pin: i } })),
      };
    }

    /** 入力を順に与え、各ステップ後の Q を返す */
    function run(kind: FlipFlopKind, steps: boolean[][]): boolean[] {
      let r: SimResult | undefined;
      return steps.map((ins) => {
        r = simulateCore(build(kind, ins), r);
        expect(r.values.get('f:1')).toBe(!r.values.get('f:0'));
        return r.values.get('f:0')!;
      });
    }

    const H = true;
    const L = false;

    it('D-FF は立ち上がりエッジで D を取り込む', () => {
      // [D, CLK]
      expect(
        run('DFF', [
          [H, L],
          [H, H],
          [L, H],
          [L, L],
          [L, H],
        ]),
      ).toEqual([L, H, H, H, L]);
    });

    it('T-FF は T=1 のとき立ち上がりエッジで反転する', () => {
      // [T, CLK]
      expect(
        run('TFF', [
          [H, H],
          [H, L],
          [H, H],
          [L, L],
          [L, H],
        ]),
      ).toEqual([H, H, L, L, L]);
    });

    it('JK-FF の動作', () => {
      // [J, CLK, K]
      expect(
        run('JKFF', [
          [H, H, L], // セット
          [L, L, L],
          [L, H, L], // 保持
          [H, L, H],
          [H, H, H], // 反転
          [L, L, H],
          [L, H, H], // リセット (既に 0)
          [H, L, H],
          [H, H, H], // 反転
        ]),
      ).toEqual([H, H, H, H, L, L, L, L, H]);
    });

    it('前回の結果がないときに CLK が ON なら、立ち上がりとみなして1回動く', () => {
      // [D, CLK]
      expect(run('DFF', [[H, H]])).toEqual([H]);
    });

    it('RS ラッチはクロックなしで入力にすぐ反応する', () => {
      // [S, R]
      expect(
        run('RS', [
          [H, L],
          [L, L],
          [L, H],
          [L, L],
          [H, H],
        ]),
      ).toEqual([H, H, L, L, L]);
    });
  });
});

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
    expect(portsOf(comp('u', 'CUSTOM', 0, { custom: 'ha' }), project)).toEqual({
      inputs: ['A', 'B'],
      outputs: ['S', 'C'],
    });
  });

  it('半加算器', () => {
    for (const [a, b] of [
      [false, false],
      [false, true],
      [true, false],
      [true, true],
    ]) {
      const project: Project = { circuits: [mainWith('ha', 2, 2, [a, b]), halfAdder] };
      const r = simulate(project, MAIN_ID);
      expect([r.values.get('o0:0'), r.values.get('o1:0')]).toEqual([a !== b, a && b]);
      // 最上位のモジュールの出力ピンにも値が入る
      expect(r.values.get('u:1')).toBe(a && b);
    }
  });

  it('入れ子のモジュール (全加算器)', () => {
    for (let n = 0; n < 8; n++) {
      const ins = [!!(n & 1), !!(n & 2), !!(n & 4)];
      const project: Project = { circuits: [mainWith('fa', 3, 2, ins), halfAdder, fullAdder] };
      const r = simulate(project, MAIN_ID);
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
      r = simulate({ circuits: [mainWith('reg', 2, 1, [d, clk]), reg] }, MAIN_ID, r);
      return r.values.get('o0:0');
    };
    expect(step(true, false)).toBe(false);
    expect(step(true, true)).toBe(true);
    expect(step(false, false)).toBe(true);
    expect(step(false, true)).toBe(false);
  });

  it('モジュールのピンが減っても、存在しないピンへの配線は無視して計算する', () => {
    // 半加算器の出力は2本。3本目 (pin 2) への配線は計算から除く
    const main = mainWith('ha', 2, 2, [true, true]);
    main.components.push(comp('o2', 'OUTPUT', 40));
    main.wires.push(wire('u', 2, 'o2', 0));
    const project: Project = { circuits: [main, halfAdder] };
    const r = simulate(project, MAIN_ID);
    expect(r.values.get('o1:0')).toBe(true);
    expect(r.values.get('o2:0')).toBe(false);
  });

  it('循環参照は展開しない', () => {
    const a: CircuitDef = { id: 'a', name: 'A', components: [comp('s', 'CUSTOM', 0, { custom: 'b' })], wires: [] };
    const b: CircuitDef = { id: 'b', name: 'B', components: [comp('s', 'CUSTOM', 0, { custom: 'a' })], wires: [] };
    const project: Project = { circuits: [mainWith('a', 0, 0, []), a, b] };
    expect(dependsOn(project, 'a', 'b')).toBe(true);
    expect(dependsOn(project, 'b', 'a')).toBe(true);
    expect(dependsOn(project, 'a', MAIN_ID)).toBe(false);
    expect(() => simulate(project, MAIN_ID)).not.toThrow();
  });
});
