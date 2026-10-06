import { describe, expect, it } from 'vitest';
import type { Part, FlipFlopKind, GateKind } from '../circuit/part';
import { MAIN_ID, type CircuitDef, type Project } from '../circuit/project';
import { dependsOn, pinoutOf } from '../circuit/module';
import { stepCircuit, step, type Link, type Netlist, type SimResult } from './sim';
import { link, wired } from './testCircuits';
import { mustGet } from '../util';

/**
 * 値が落ち着くまで (または最大 ticks まで) 時間を進める。
 * 遅延の待ち行列に値が残っていることがあるので、いちばん長い遅延 (XOR の 3) より長く変化がないことを見る
 */
function settle(circuit: Netlist, prev?: SimResult, ticks = 30): SimResult {
  let r = stepCircuit(circuit, prev);
  for (let i = 1; i < ticks; i++) {
    if (r.stableTicks > 3) {
      break;
    }
    r = stepCircuit(circuit, r);
  }
  return r;
}

/** プロジェクトを、値が落ち着くまで (または最大 ticks まで) 進める */
function settleProject(project: Project, id: string, prev?: SimResult, ticks = 30): SimResult {
  let r = step(project, id, prev);
  for (let i = 1; i < ticks; i++) {
    if (r.stableTicks > 3) {
      break;
    }
    r = step(project, id, r);
  }
  return r;
}

function twoInput(kind: GateKind, a: boolean, b: boolean): boolean {
  // biome-ignore format: 表形式を維持するため
  const comps: Part[] = [
    { id: 'a', kind: 'input', x: 0, y: 0, on: a },
    { id: 'b', kind: 'input', x: 0, y: 0, on: b },
    { id: 'g', kind, x: 0, y: 0 },
    { id: 'o', kind: 'output', x: 0, y: 0 },
  ];
  const circuit: Netlist = {
    parts: comps,
    // biome-ignore format: 表形式を維持するため
    links: [
      { from: { comp: 'a', pin: 0 }, to: { comp: 'g', pin: 0 } },
      { from: { comp: 'b', pin: 0 }, to: { comp: 'g', pin: 1 } },
      { from: { comp: 'g', pin: 0 }, to: { comp: 'o', pin: 0 } },
    ],
  };
  return mustGet(settle(circuit).values, 'o:0');
}

describe('simulate', () => {
  // biome-ignore format: 表形式を維持するため
  const table: [GateKind, boolean[]][] = [
    ['and', [false, false, false, true]],
    ['or', [false, true, true, true]],
    ['nand', [true, true, true, false]],
    ['nor', [true, false, false, false]],
    ['xor', [false, true, true, false]],
    ['xnor', [true, false, false, true]],
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
  function oneInput(kind: 'not' | 'buf', a: boolean): boolean {
    const r = settle({
      // biome-ignore format: 表形式を維持するため
      parts: [
        { id: 'a', kind: 'input', x: 0, y: 0, on: a },
        { id: 'g', kind, x: 0, y: 0 },
      ],
      links: [{ from: { comp: 'a', pin: 0 }, to: { comp: 'g', pin: 0 } }],
    });
    return mustGet(r.values, 'g:0');
  }

  it('NOT は反転し、BUF はそのまま出す', () => {
    expect([oneInput('not', false), oneInput('not', true)]).toEqual([true, false]);
    expect([oneInput('buf', false), oneInput('buf', true)]).toEqual([false, true]);
  });

  it('何もつながっていない入力ピンは OFF として扱う', () => {
    const r = settle({
      // biome-ignore format: 表形式を維持するため
      parts: [
        { id: 'n', kind: 'not', x: 0, y: 0 },
        { id: 'o', kind: 'output', x: 0, y: 0 },
      ],
      links: [],
    });
    expect(r.values.get('n:0')).toBe(true);
    // OUTPUT は入力の値を pin 0 に持つ
    expect(r.values.get('o:0')).toBe(false);
  });

  it('HIGH は何もつながなくても常に ON を出す', () => {
    const r = settle({
      // biome-ignore format: 表形式を維持するため
      parts: [
        { id: 'h', kind: 'high', x: 0, y: 0 },
        { id: 'n', kind: 'not', x: 0, y: 0 },
      ],
      links: [{ from: { comp: 'h', pin: 0 }, to: { comp: 'n', pin: 0 } }],
    });
    expect(r.values.get('h:0')).toBe(true);
    expect(r.values.get('n:0')).toBe(false);
  });

  it('CLOCK は on の値をそのまま出す', () => {
    const r = settle({
      parts: [{ id: 'k', kind: 'clock', x: 0, y: 0, on: true }],
      links: [],
    });
    expect(r.values.get('k:0')).toBe(true);
  });

  it('NOT の発振ループを検出する', () => {
    // 遅延があるので毎 tick 反転し続ける。しばらく続いたところで発振とみなす
    const r = settle(
      {
        parts: [{ id: 'n', kind: 'not', x: 0, y: 0 }],
        links: [{ from: { comp: 'n', pin: 0 }, to: { comp: 'n', pin: 0 } }],
      },
      undefined,
      80,
    );
    expect(r.unstable).toBe(true);
    // 落ち着かなくても、その時点の値は返す
    expect(r.values.get('n:0')).toBeTypeOf('boolean');
  });

  it('NOR で組んだ RS ラッチが状態を保持する', () => {
    const build = (s: boolean, r: boolean): Netlist => ({
      // biome-ignore format: 表形式を維持するため
      parts: [
        { id: 's', kind: 'input', x: 0, y: 0, on: s },
        { id: 'r', kind: 'input', x: 0, y: 0, on: r },
        { id: 'q', kind: 'nor', x: 0, y: 0 },
        { id: 'qn', kind: 'nor', x: 0, y: 0 },
      ],
      // biome-ignore format: 表形式を維持するため
      links: [
        { from: { comp: 'r', pin: 0 }, to: { comp: 'q', pin: 0 } },
        { from: { comp: 'qn', pin: 0 }, to: { comp: 'q', pin: 1 } },
        { from: { comp: 's', pin: 0 }, to: { comp: 'qn', pin: 0 } },
        { from: { comp: 'q', pin: 0 }, to: { comp: 'qn', pin: 1 } },
      ],
    });
    let r = settle(build(true, false));
    expect(r.values.get('q:0')).toBe(true);
    r = settle(build(false, false), r);
    expect(r.values.get('q:0')).toBe(true);
    r = settle(build(false, true), r);
    expect(r.values.get('q:0')).toBe(false);
    r = settle(build(false, false), r);
    expect(r.values.get('q:0')).toBe(false);
  });

  it('NOR で組んだ RS ラッチを S=R=0 のまま前回の結果なしで始めると発振し、S を入れると落ち着く', () => {
    // 2 つの NOR が同じ値から同じ遅延で動くので、そろって ON と OFF を繰り返す (実物の準安定と同じ)
    const build = (s: boolean): Netlist => ({
      // biome-ignore format: 表形式を維持するため
      parts: [
        { id: 's', kind: 'input', x: 0, y: 0, on: s },
        { id: 'r', kind: 'input', x: 0, y: 0 },
        { id: 'q', kind: 'nor', x: 0, y: 0 },
        { id: 'qn', kind: 'nor', x: 0, y: 0 },
      ],
      // biome-ignore format: 表形式を維持するため
      links: [
        { from: { comp: 'r', pin: 0 }, to: { comp: 'q', pin: 0 } },
        { from: { comp: 'qn', pin: 0 }, to: { comp: 'q', pin: 1 } },
        { from: { comp: 's', pin: 0 }, to: { comp: 'qn', pin: 0 } },
        { from: { comp: 'q', pin: 0 }, to: { comp: 'qn', pin: 1 } },
      ],
    });
    let r = settle(build(false), undefined, 80);
    expect(r.unstable).toBe(true);
    expect(r.values.get('q:0')).toBe(r.values.get('qn:0'));
    r = settle(build(true), r);
    expect(r.unstable).toBe(false);
    expect(r.values.get('q:0')).toBe(true);
    r = settle(build(false), r);
    expect(r.unstable).toBe(false);
    expect(r.values.get('q:0')).toBe(true);
  });

  describe('フリップフロップ', () => {
    /** 入力スイッチ in0..inN を部品 f の各入力ピンにつないだ回路 */
    function build(kind: FlipFlopKind, ins: boolean[]): Netlist {
      return {
        parts: [
          ...ins.map(
            (on, i): Part => ({
              id: `in${i}`,
              kind: 'input',
              x: 0,
              y: 0,
              on,
            }),
          ),
          { id: 'f', kind, x: 0, y: 0 },
        ],
        links: ins.map((_, i) => ({
          from: { comp: `in${i}`, pin: 0 },
          to: { comp: 'f', pin: i },
        })),
      };
    }

    /** 入力を順に与え、各ステップ後の Q を返す */
    function run(kind: FlipFlopKind, steps: boolean[][]): boolean[] {
      let r: SimResult | undefined;
      return steps.map((ins) => {
        r = settle(build(kind, ins), r);
        expect(r.values.get('f:1')).toBe(!r.values.get('f:0'));
        return mustGet(r.values, 'f:0');
      });
    }

    const H = true;
    const L = false;

    it('D-FF は立ち上がりエッジで D を取り込む', () => {
      // [D, CLK]
      expect(
        // biome-ignore format: 表形式を維持するため
        run('dFlipFlop', [
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
        // biome-ignore format: 表形式を維持するため
        run('tFlipFlop', [
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
        run('jkFlipFlop', [
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
      expect(run('dFlipFlop', [[H, H]])).toEqual([H]);
    });

    it('RS ラッチはクロックなしで、S / R の変化だけで動く', () => {
      // [S, R]
      expect(
        // biome-ignore format: 表形式を維持するため
        run('rsLatch', [
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

function comp(id: string, kind: Part['kind'], extra: Partial<Part> = {}): Part {
  return { id, kind, x: 0, y: 0, ...extra };
}

/** 半加算器: 入力 A, B / 出力 S, C */
const halfAdder = wired({
  id: 'ha',
  name: 'HalfAdder',
  // biome-ignore format: 表形式を維持するため
  parts: [
    comp('a', 'input', { label: 'A' }),
    comp('b', 'input', { label: 'B' }),
    comp('x', 'xor'),
    comp('n', 'and'),
    comp('s', 'output', { label: 'S' }),
    comp('c', 'output', { label: 'C' }),
  ],
  // biome-ignore format: 表形式を維持するため
  links: [
    link('a', 0, 'x', 0),
    link('b', 0, 'x', 1),
    link('a', 0, 'n', 0),
    link('b', 0, 'n', 1),
    link('x', 0, 's', 0),
    link('n', 0, 'c', 0),
  ],
});

/** 全加算器: 半加算器2つと OR。入力 A, B, Cin / 出力 S, Cout */
const fullAdder = wired({
  id: 'fa',
  name: 'FullAdder',
  // biome-ignore format: 表形式を維持するため
  parts: [
    comp('a', 'input'),
    comp('b', 'input'),
    comp('ci', 'input'),
    comp('h1', 'module', { module: 'ha' }),
    comp('h2', 'module', { module: 'ha' }),
    comp('or', 'or'),
    comp('s', 'output'),
    comp('co', 'output'),
  ],
  // biome-ignore format: 表形式を維持するため
  links: [
    link('a', 0, 'h1', 0),
    link('b', 0, 'h1', 1),
    link('h1', 0, 'h2', 0),
    link('ci', 0, 'h2', 1),
    link('h2', 0, 's', 0),
    link('h1', 1, 'or', 0),
    link('h2', 1, 'or', 1),
    link('or', 0, 'co', 0),
  ],
});

/**
 * モジュール module を 1 つ置き、入力ピンに INPUT (値は ins)、出力ピンに OUTPUT をつないだメイン回路。
 * extra の部品とつながりも足す
 */
function mainWith(
  module: string,
  nIn: number,
  nOut: number,
  ins: boolean[],
  extra: { parts: Part[]; links: Link[] } = { parts: [], links: [] },
): CircuitDef {
  return wired({
    id: MAIN_ID,
    name: 'メイン',
    parts: [
      ...ins.map((on, i) => comp(`i${i}`, 'input', { on })),
      comp('u', 'module', { module }),
      ...Array.from({ length: nOut }, (_, j) => comp(`o${j}`, 'output')),
      ...extra.parts,
    ],
    links: [
      ...Array.from({ length: nIn }, (_, i) => link(`i${i}`, 0, 'u', i)),
      ...Array.from({ length: nOut }, (_, j) => link('u', j, `o${j}`, 0)),
      ...extra.links,
    ],
  });
}

describe('モジュール', () => {
  it('ピン名は INPUT / OUTPUT のラベルを上から順に並べたもの', () => {
    const project: Project = {
      circuits: [mainWith('ha', 2, 2, [false, false]), halfAdder],
    };
    expect(pinoutOf(comp('u', 'module', { module: 'ha' }), project)).toEqual({
      inputs: ['A', 'B'],
      outputs: ['S', 'C'],
      package: { kind: 'split' },
    });
  });

  it('dip のモジュールは、ピン番号の順に中の INPUT / OUTPUT とつながる', () => {
    // 外側のピン番号: B が 1、C が 2、A が 3、S が 8。PinRef.pin の並びは、入力が B, A、出力が C, S
    const ha: CircuitDef = {
      ...halfAdder,
      package: { kind: 'dip', pins: 8 },
      parts: halfAdder.parts.map((c) => {
        const numbers: Record<string, number> = { a: 3, b: 1, c: 2, s: 8 };
        return c.id in numbers ? { ...c, pinNumber: numbers[c.id] } : c;
      }),
    };
    // biome-ignore format: 表形式を維持するため
    for (const [b, a] of [
      [false, false],
      [true, false],
      [true, true],
    ]) {
      const main = wired(
        {
          id: MAIN_ID,
          name: 'メイン',
          // biome-ignore format: 表形式を維持するため
          parts: [
            comp('i0', 'input', { on: b }),
            comp('i1', 'input', { on: a }),
            comp('u', 'module', { module: 'ha' }),
            comp('o0', 'output'),
            comp('o1', 'output'),
          ],
          // biome-ignore format: 表形式を維持するため
          links: [
            link('i0', 0, 'u', 0),
            link('i1', 0, 'u', 1),
            link('u', 0, 'o0', 0),
            link('u', 1, 'o1', 0),
          ],
        },
        { circuits: [ha] },
      );
      const r = settleProject({ circuits: [main, ha] }, MAIN_ID);
      // o0 は C (2 番)、o1 は S (8 番)
      expect([r.values.get('o0:0'), r.values.get('o1:0')]).toEqual([a && b, a !== b]);
    }
  });

  it('半加算器', () => {
    // biome-ignore format: 表形式を維持するため
    for (const [a, b] of [
      [false, false],
      [false, true],
      [true, false],
      [true, true],
    ]) {
      const project: Project = {
        circuits: [mainWith('ha', 2, 2, [a, b]), halfAdder],
      };
      const r = settleProject(project, MAIN_ID);
      expect([r.values.get('o0:0'), r.values.get('o1:0')]).toEqual([
        a !== b,
        a && b,
      ]);
      // 最上位のモジュールの出力ピンにも値が入る
      expect(r.values.get('u:1')).toBe(a && b);
    }
  });

  it('入れ子のモジュール (全加算器)', () => {
    for (let n = 0; n < 8; n++) {
      const ins = [!!(n & 1), !!(n & 2), !!(n & 4)];
      const project: Project = {
        circuits: [mainWith('fa', 3, 2, ins), halfAdder, fullAdder],
      };
      const r = settleProject(project, MAIN_ID);
      const sum = ins.filter(Boolean).length;
      expect([r.values.get('o0:0'), r.values.get('o1:0')]).toEqual([sum % 2 === 1, sum >= 2]);
    }
  });

  it('モジュールの中のフリップフロップが状態を保つ', () => {
    const reg = wired({
      id: 'reg',
      name: 'Reg',
      // biome-ignore format: 表形式を維持するため
      parts: [
        comp('d', 'input'),
        comp('clk', 'input'),
        comp('ff', 'dFlipFlop'),
        comp('q', 'output'),
      ],
      // biome-ignore format: 表形式を維持するため
      links: [
        link('d', 0, 'ff', 0),
        link('clk', 0, 'ff', 1),
        link('ff', 0, 'q', 0),
      ],
    });
    let r: SimResult | undefined;
    const step = (d: boolean, clk: boolean) => {
      r = settleProject({ circuits: [mainWith('reg', 2, 1, [d, clk]), reg] }, MAIN_ID, r);
      return r.values.get('o0:0');
    };
    expect(step(true, false)).toBe(false);
    expect(step(true, true)).toBe(true);
    expect(step(false, false)).toBe(true);
    expect(step(false, true)).toBe(false);
  });

  it('モジュールのピンが減っても、存在しないピンへの配線は無視して計算する', () => {
    // 半加算器の出力は2本。3本目 (pin 2) があった位置からの配線は、どのピンにもつながらない
    const main = mainWith('ha', 2, 2, [true, true], {
      parts: [comp('o2', 'output')],
      links: [link('u', 2, 'o2', 0)],
    });
    const project: Project = { circuits: [main, halfAdder] };
    const r = settleProject(project, MAIN_ID);
    expect(r.values.get('o1:0')).toBe(true);
    expect(r.values.get('o2:0')).toBe(false);
  });

  it('循環参照は展開しない', () => {
    const a: CircuitDef = {
      id: 'a',
      name: 'A',
      parts: [comp('s', 'module', { module: 'b' })],
      wires: [],
    };
    const b: CircuitDef = {
      id: 'b',
      name: 'B',
      parts: [comp('s', 'module', { module: 'a' })],
      wires: [],
    };
    const project: Project = { circuits: [mainWith('a', 0, 0, []), a, b] };
    expect(dependsOn(project, 'a', 'b')).toBe(true);
    expect(dependsOn(project, 'b', 'a')).toBe(true);
    expect(dependsOn(project, 'a', MAIN_ID)).toBe(false);
    expect(() => settleProject(project, MAIN_ID)).not.toThrow();
  });
});
