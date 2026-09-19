import { describe, expect, it } from 'vitest';
import { simulate, type Circuit, type Component, type FlipFlopKind, type GateKind, type SimResult } from './sim';

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
  return simulate(circuit).values.get('o:0')!;
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
    const r = simulate({
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
    const r = simulate({
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
    const r = simulate({
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
    const r = simulate({ components: [{ id: 'k', kind: 'CLOCK', x: 0, y: 0, on: true }], wires: [] });
    expect(r.values.get('k:0')).toBe(true);
  });

  it('NOT の発振ループを検出する', () => {
    const r = simulate({
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
    let r = simulate(build(true, false));
    expect(r.values.get('q:0')).toBe(true);
    r = simulate(build(false, false), r);
    expect(r.values.get('q:0')).toBe(true);
    r = simulate(build(false, true), r);
    expect(r.values.get('q:0')).toBe(false);
    r = simulate(build(false, false), r);
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
        r = simulate(build(kind, ins), r);
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
