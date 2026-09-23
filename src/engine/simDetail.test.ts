// シミュレーションの細かい動きと、壊してはいけない不変条件のテスト。
// 基本の真理値表とフリップフロップの動きは sim.test.ts にある
import { describe, expect, it } from 'vitest';
import type { Component, ComponentKind } from './component';
import type { Circuit, Wire } from './circuit';
import { MAIN_ID, type CircuitDef, type Project } from './project';
import { step, stepCircuit, type SimResult } from './sim';

/**
 * 値が落ち着くまで (または最大 ticks まで) 時間を進める。
 * 遅延の待ち行列に値が残っていることがあるので、いちばん長い遅延 (XOR の 3) より長く変化がないことを見る
 */
function settle(circuit: Circuit, prev?: SimResult, ticks = 30): SimResult {
  let r = prev;
  for (let i = 0; i < ticks; i++) {
    r = stepCircuit(circuit, r);
    if (r.stableTicks > 3) break;
  }
  return r!;
}

/** プロジェクトを、値が落ち着くまで (または最大 ticks まで) 進める */
function settleProject(
  project: Project,
  id: string,
  prev?: SimResult,
  ticks = 30,
): SimResult {
  let r = prev;
  for (let i = 0; i < ticks; i++) {
    r = step(project, id, r);
    if (r.stableTicks > 3) break;
  }
  return r!;
}

function comp(
  id: string,
  kind: ComponentKind,
  extra: Partial<Component> = {},
): Component {
  return { id, kind, x: 0, y: 0, ...extra };
}

function wire(from: string, fromPin: number, to: string, toPin: number): Wire {
  return {
    id: `${from}${fromPin}-${to}${toPin}`,
    from: { comp: from, pin: fromPin },
    to: { comp: to, pin: toPin },
  };
}

describe('値の伝わり方', () => {
  /** in → NOT → NOT → NOT → out の直列 */
  function chain(reversed: boolean): Circuit {
    const components = [
      comp('in', 'INPUT', { on: true }),
      comp('n1', 'NOT'),
      comp('n2', 'NOT'),
      comp('n3', 'NOT'),
      comp('out', 'OUTPUT'),
    ];
    return {
      components: reversed ? [...components].reverse() : components,
      wires: [
        wire('in', 0, 'n1', 0),
        wire('n1', 0, 'n2', 0),
        wire('n2', 0, 'n3', 0),
        wire('n3', 0, 'out', 0),
      ],
    };
  }

  it('多段でも、tick を重ねれば最後まで伝わる', () => {
    expect(settle(chain(false)).values.get('out:0')).toBe(false);
  });

  it('部品の並び順を変えても結果は同じ', () => {
    const forward = settle(chain(false));
    const backward = settle(chain(true));
    for (const id of ['n1:0', 'n2:0', 'n3:0', 'out:0']) {
      expect(backward.values.get(id)).toBe(forward.values.get(id));
    }
    expect(backward.unstable).toBe(false);
  });

  it('1つの出力を複数の入力につなげる', () => {
    const r = settle({
      components: [
        comp('in', 'INPUT', { on: true }),
        comp('a', 'NOT'),
        comp('b', 'BUF'),
        comp('o', 'OUTPUT'),
      ],
      wires: [
        wire('in', 0, 'a', 0),
        wire('in', 0, 'b', 0),
        wire('in', 0, 'o', 0),
      ],
    });
    expect([
      r.values.get('a:0'),
      r.values.get('b:0'),
      r.values.get('o:0'),
    ]).toEqual([false, true, true]);
  });

  it('入力ピンにつなげる配線が2本あっても、破綻せずに計算する', () => {
    // 保存データを手で書き換えた場合など。後から来た配線が使われる
    const r = settle({
      components: [
        comp('a', 'INPUT', { on: true }),
        comp('b', 'INPUT', { on: false }),
        comp('n', 'BUF'),
      ],
      wires: [wire('a', 0, 'n', 0), wire('b', 0, 'n', 0)],
    });
    expect(r.values.get('n:0')).toBe(false);
    expect(r.unstable).toBe(false);
  });

  it('存在しない部品やピンを指す配線は無視する', () => {
    const r = settle({
      components: [comp('a', 'INPUT', { on: true }), comp('o', 'OUTPUT')],
      wires: [
        wire('ない', 0, 'o', 0),
        wire('a', 0, 'ない', 0),
        wire('a', 9, 'o', 0),
      ],
    });
    expect(r.unstable).toBe(false);
    // 存在しない出力ピンからは OFF
    expect(r.values.get('o:0')).toBe(false);
  });

  it('落ち着いた回路は発振とみなさない', () => {
    const circuit = {
      components: [
        comp('in', 'INPUT', { on: true }),
        comp('n1', 'NOT'),
        comp('n2', 'NOT'),
      ],
      wires: [wire('in', 0, 'n1', 0), wire('n1', 0, 'n2', 0)],
    };
    expect(settle(circuit).unstable).toBe(false);
    expect(settle(circuit).activeTicks).toBe(0);
  });
});

describe('前回の結果の引き継ぎ', () => {
  /** D-FF 1つ。D と CLK は INPUT */
  function dff(d: boolean, clk: boolean, ffId = 'f'): Circuit {
    return {
      components: [
        comp('d', 'INPUT', { on: d }),
        comp('c', 'INPUT', { on: clk }),
        comp(ffId, 'DFF'),
      ],
      wires: [wire('d', 0, ffId, 0), wire('c', 0, ffId, 1)],
    };
  }

  it('立ち下がりでは取り込まない。CLK が ON のまま D を変えても変わらない', () => {
    let r = settle(dff(false, false));
    r = settle(dff(true, true), r); // 立ち上がりで取り込む
    expect(r.values.get('f:0')).toBe(true);
    r = settle(dff(false, true), r); // CLK は ON のまま
    expect(r.values.get('f:0')).toBe(true);
    r = settle(dff(false, false), r); // 立ち下がり
    expect(r.values.get('f:0')).toBe(true);
    r = settle(dff(false, true), r); // 次の立ち上がりで取り込む
    expect(r.values.get('f:0')).toBe(false);
  });

  it('部品 ID が変わると、状態は引き継がれない', () => {
    let r = settle(dff(false, false));
    r = settle(dff(true, true), r); // 取り込んで Q が ON
    r = settle(dff(true, false), r); // CLK を戻す
    expect(r.values.get('f:0')).toBe(true);
    // 同じ形でも ID が違えば別の部品。Q は OFF から始まる
    const other = settle(dff(true, false, 'g'), r);
    expect(other.values.get('g:0')).toBe(false);
  });

  it('前回の結果がない部品は、その時点で CLK が ON なら1回取り込む', () => {
    // 前回の CLK を OFF として扱うため、立ち上がりとみなされる
    const r = settle(dff(true, true, 'g'));
    expect(r.values.get('g:0')).toBe(true);
  });

  it('Q と Q̄ は常に逆', () => {
    let r: SimResult | undefined;
    for (const [d, clk] of [
      [false, false],
      [true, true],
      [true, false],
      [false, true],
    ]) {
      r = settle(dff(d, clk), r);
      expect(r.values.get('f:1')).toBe(!r.values.get('f:0'));
    }
  });
});

describe('モジュール', () => {
  /** D-FF を1つ持つモジュール。入力 D, CLK / 出力 Q */
  const reg: CircuitDef = {
    id: 'reg',
    name: 'Reg',
    components: [
      { ...comp('d', 'INPUT'), y: 0 },
      { ...comp('clk', 'INPUT'), y: 40 },
      comp('ff', 'DFF'),
      comp('q', 'OUTPUT'),
    ],
    wires: [
      wire('d', 0, 'ff', 0),
      wire('clk', 0, 'ff', 1),
      wire('ff', 0, 'q', 0),
    ],
  };

  /** 同じモジュールを2つ置いたメイン回路 */
  function main(
    d1: boolean,
    clk1: boolean,
    d2: boolean,
    clk2: boolean,
  ): CircuitDef {
    return {
      id: MAIN_ID,
      name: 'メイン',
      components: [
        comp('d1', 'INPUT', { on: d1 }),
        comp('c1', 'INPUT', { on: clk1 }),
        comp('d2', 'INPUT', { on: d2 }),
        comp('c2', 'INPUT', { on: clk2 }),
        comp('u1', 'CUSTOM', { custom: 'reg' }),
        comp('u2', 'CUSTOM', { custom: 'reg' }),
      ],
      wires: [
        wire('d1', 0, 'u1', 0),
        wire('c1', 0, 'u1', 1),
        wire('d2', 0, 'u2', 0),
        wire('c2', 0, 'u2', 1),
      ],
    };
  }

  it('同じモジュールを2つ置くと、それぞれ別の状態を持つ', () => {
    const project = (m: CircuitDef): Project => ({ circuits: [m, reg] });
    let r = settleProject(project(main(false, false, false, false)), MAIN_ID);
    // 1つ目だけ立ち上げる
    r = settleProject(project(main(true, true, false, false)), MAIN_ID, r);
    expect(r.values.get('u1:0')).toBe(true);
    expect(r.values.get('u2:0')).toBe(false);
    // 2つ目も立ち上げる
    r = settleProject(project(main(true, true, true, true)), MAIN_ID, r);
    expect([r.values.get('u1:0'), r.values.get('u2:0')]).toEqual([true, true]);
  });

  it('モジュールの外から中へ、中から外へ値が通る', () => {
    const project: Project = {
      circuits: [main(true, true, false, false), reg],
    };
    const r = settleProject(project, MAIN_ID);
    // 外の INPUT → モジュールの入力ピン → 中の D-FF → 出力ピン
    expect(r.values.get('u1:0')).toBe(true);
  });

  it('モジュールのタブを開くと、その回路だけを計算する', () => {
    const project: Project = {
      circuits: [main(true, true, false, false), reg],
    };
    const r = settleProject(project, 'reg');
    // 中の INPUT は OFF のままなので、取り込む値も OFF
    expect(r.values.get('q:0')).toBe(false);
    // 外の回路の部品は計算に含まれない
    expect(r.values.get('u1:0')).toBeUndefined();
  });

  it('自分自身を含むモジュールは展開せず、発振もしない', () => {
    const self: CircuitDef = {
      id: 'self',
      name: '自分',
      components: [
        comp('u', 'CUSTOM', { custom: 'self' }),
        comp('o', 'OUTPUT'),
      ],
      wires: [wire('u', 0, 'o', 0)],
    };
    const project: Project = {
      circuits: [
        {
          id: MAIN_ID,
          name: 'メイン',
          components: [comp('u', 'CUSTOM', { custom: 'self' })],
          wires: [],
        },
        self,
      ],
    };
    expect(() => settleProject(project, MAIN_ID)).not.toThrow();
    expect(settleProject(project, MAIN_ID).unstable).toBe(false);
  });

  it('ない回路を指定すると、空の結果を返す', () => {
    const r = settleProject(
      { circuits: [main(true, true, false, false), reg] },
      'ない',
    );
    expect(r.values.size).toBe(0);
    expect(r.unstable).toBe(false);
  });
});

describe('保持と、段をつないだときの動き', () => {
  function latch(set: boolean, reset: boolean): Circuit {
    return {
      components: [
        comp('s', 'INPUT', { on: set }),
        comp('r', 'INPUT', { on: reset }),
        comp('l', 'RS'),
      ],
      wires: [wire('s', 0, 'l', 0), wire('r', 0, 'l', 1)],
    };
  }

  it('RS ラッチは S=R=1 で OFF になり、両方 OFF に戻すとその値を保つ', () => {
    let r = settle(latch(true, false));
    expect(r.values.get('l:0')).toBe(true);
    r = settle(latch(true, true), r); // 両方 ON はリセット優先
    expect(r.values.get('l:0')).toBe(false);
    r = settle(latch(false, false), r); // 保持
    expect(r.values.get('l:0')).toBe(false);
  });

  function rsen(set: boolean, en: boolean, reset: boolean): Circuit {
    return {
      components: [
        comp('s', 'INPUT', { on: set }),
        comp('e', 'INPUT', { on: en }),
        comp('r', 'INPUT', { on: reset }),
        comp('l', 'RSEN'),
      ],
      wires: [wire('s', 0, 'l', 0), wire('e', 0, 'l', 1), wire('r', 0, 'l', 2)],
    };
  }

  it('EN 付きの RS ラッチは、EN が ON の間だけ S / R が効く', () => {
    let r = settle(rsen(true, false, false)); // EN が OFF なので S は効かない
    expect(r.values.get('l:0')).toBe(false);
    r = settle(rsen(true, true, false), r);
    expect(r.values.get('l:0')).toBe(true);
    r = settle(rsen(false, false, true), r); // EN が OFF の間は R も効かず、値を保つ
    expect(r.values.get('l:0')).toBe(true);
    r = settle(rsen(true, true, true), r); // 両方 ON はリセット優先
    expect(r.values.get('l:0')).toBe(false);
  });

  function dLatch(d: boolean, en: boolean): Circuit {
    return {
      components: [
        comp('d', 'INPUT', { on: d }),
        comp('e', 'INPUT', { on: en }),
        comp('l', 'DLATCH'),
      ],
      wires: [wire('d', 0, 'l', 0), wire('e', 0, 'l', 1)],
    };
  }

  it('D ラッチは EN が ON の間 D に追従し、OFF にすると直前の値を保つ', () => {
    let r = settle(dLatch(true, true));
    expect(r.values.get('l:0')).toBe(true);
    expect(r.values.get('l:1')).toBe(false); // Q̄
    r = settle(dLatch(false, true), r); // EN が ON の間は追従する (D-FF と違い、エッジを待たない)
    expect(r.values.get('l:0')).toBe(false);
    r = settle(dLatch(true, true), r);
    r = settle(dLatch(true, false), r); // EN を OFF にして保持
    r = settle(dLatch(false, false), r); // EN が OFF の間は D を変えても出力は変わらない
    expect(r.values.get('l:0')).toBe(true);
  });

  function tff(t: boolean, clk: boolean): Circuit {
    return {
      components: [
        comp('t', 'INPUT', { on: t }),
        comp('c', 'INPUT', { on: clk }),
        comp('f', 'TFF'),
      ],
      wires: [wire('t', 0, 'f', 0), wire('c', 0, 'f', 1)],
    };
  }

  it('T-FF は T が OFF なら立ち上がりでも変わらない', () => {
    let r = settle(tff(true, false));
    r = settle(tff(true, true), r); // 反転して ON
    expect(r.values.get('f:0')).toBe(true);
    r = settle(tff(false, false), r);
    r = settle(tff(false, true), r); // T が OFF なので変わらない
    expect(r.values.get('f:0')).toBe(true);
  });

  it('T-FF をつないだ非同期カウンタは、段ごとに遅れて反転する', () => {
    // 2段目の CLK に1段目の Q をつなぐ。1段目の Q は遅れて出るので、2段目はその次の tick で動く
    function counter(clk: boolean): Circuit {
      return {
        components: [
          comp('c', 'INPUT', { on: clk }),
          comp('h', 'HIGH'),
          comp('f1', 'TFF'),
          comp('f2', 'TFF'),
        ],
        wires: [
          wire('h', 0, 'f1', 0),
          wire('c', 0, 'f1', 1),
          wire('h', 0, 'f2', 0),
          wire('f1', 0, 'f2', 1),
        ],
      };
    }
    let r = settle(counter(false));
    expect([r.values.get('f1:0'), r.values.get('f2:0')]).toEqual([
      false,
      false,
    ]);
    // CLK の立ち上がりで1段目が反転し、その Q の立ち上がりで2段目が反転する (2進カウンタ)
    r = settle(counter(true), r);
    expect([r.values.get('f1:0'), r.values.get('f2:0')]).toEqual([true, true]);
    r = settle(counter(false), r);
    r = settle(counter(true), r);
    expect([r.values.get('f1:0'), r.values.get('f2:0')]).toEqual([false, true]);
  });
});

describe('ゲート遅延', () => {
  /**
   * in → 部品 → out。in を ON にしたあと、出力が変わるまでの遅れ (tick) を数える。
   * 入力が伝わる tick は数えない (入力そのものに遅延はない)
   */
  /** もう一方の入力に与える値。ゲートの出力が入力で変わるように選ぶ */
  function delayTicks(kind: ComponentKind, other?: boolean): number {
    const circuit: Circuit = {
      components: [
        comp('in', 'INPUT', { on: false }),
        comp('g', kind),
        comp('out', 'OUTPUT'),
        ...(other === undefined ? [] : [comp('o', 'INPUT', { on: other })]),
      ],
      wires: [
        wire('in', 0, 'g', 0),
        wire('g', 0, 'out', 0),
        ...(other === undefined ? [] : [wire('o', 0, 'g', 1)]),
      ],
    };
    // まず落ち着かせてから、入力を ON にする
    let r = settle(circuit);
    const before = r.values.get('out:0');
    const on: Circuit = {
      ...circuit,
      components: circuit.components.map((c) =>
        c.id === 'in' ? { ...c, on: true } : c,
      ),
    };
    for (let t = 0; t <= 10; t++) {
      r = stepCircuit(on, r);
      if (r.values.get('out:0') !== before) return t;
    }
    return -1;
  }

  it('NOT・NAND・NOR は 1 tick、AND・OR は 2 tick、XOR は 3 tick 遅れる', () => {
    expect(delayTicks('NOT')).toBe(1);
    // AND / NAND はもう一方を ON、OR / NOR は OFF にしないと、入力で出力が変わらない
    expect(delayTicks('NAND', true)).toBe(1);
    expect(delayTicks('NOR', false)).toBe(1);
    expect(delayTicks('AND', true)).toBe(2);
    expect(delayTicks('OR', false)).toBe(2);
    expect(delayTicks('XOR', false)).toBe(3);
  });

  it('BUF は遅れない (モジュールのピンで時間を食わない)', () => {
    expect(delayTicks('BUF')).toBe(0);
  });

  it('直列につなぐと、段数のぶんだけ遅れる', () => {
    const chain: Circuit = {
      components: [
        comp('in', 'INPUT', { on: false }),
        comp('n1', 'NOT'),
        comp('n2', 'NOT'),
        comp('n3', 'NOT'),
      ],
      wires: [
        wire('in', 0, 'n1', 0),
        wire('n1', 0, 'n2', 0),
        wire('n2', 0, 'n3', 0),
      ],
    };
    let r = settle(chain);
    const on: Circuit = {
      ...chain,
      components: chain.components.map((c) =>
        c.id === 'in' ? { ...c, on: true } : c,
      ),
    };
    const seen: string[] = [];
    for (let t = 0; t < 4; t++) {
      r = stepCircuit(on, r);
      seen.push(
        [r.values.get('n1:0'), r.values.get('n2:0'), r.values.get('n3:0')]
          .map((v) => (v ? '1' : '0'))
          .join(''),
      );
    }
    // 1 tick ごとに 1 段ずつ変わっていく
    expect(seen).toEqual(['101', '001', '011', '010']);
  });

  it('モジュールにしても、中の部品の遅延だけで伝わる', () => {
    const inner: CircuitDef = {
      id: 'inv',
      name: 'INV',
      components: [comp('i', 'INPUT'), comp('n', 'NOT'), comp('o', 'OUTPUT')],
      wires: [wire('i', 0, 'n', 0), wire('n', 0, 'o', 0)],
    };
    function main(on: boolean): CircuitDef {
      return {
        id: MAIN_ID,
        name: 'メイン',
        components: [
          comp('in', 'INPUT', { on }),
          comp('u', 'CUSTOM', { custom: 'inv' }),
          comp('out', 'OUTPUT'),
        ],
        wires: [wire('in', 0, 'u', 0), wire('u', 0, 'out', 0)],
      };
    }
    let r = settleProject({ circuits: [main(false), inner] }, MAIN_ID);
    expect(r.values.get('out:0')).toBe(true);
    // モジュールのピン (BUF) では遅れず、中の NOT 1つぶんだけ遅れる
    const project = { circuits: [main(true), inner] };
    r = step(project, MAIN_ID, r);
    expect(r.values.get('out:0')).toBe(true);
    r = step(project, MAIN_ID, r);
    expect(r.values.get('out:0')).toBe(false);
  });
});

describe('遅延より短い入力の変化', () => {
  /** in → AND (遅延 2、もう一方は ON) → out。in を ticks の間だけ ON にする */
  function pulse(ticks: number): boolean {
    const circuit: Circuit = {
      components: [
        comp('in', 'INPUT'),
        comp('hi', 'HIGH'),
        comp('g', 'AND'),
        comp('out', 'OUTPUT'),
      ],
      wires: [
        wire('in', 0, 'g', 0),
        wire('hi', 0, 'g', 1),
        wire('g', 0, 'out', 0),
      ],
    };
    const withInput = (on: boolean): Circuit => ({
      ...circuit,
      components: circuit.components.map((c) =>
        c.id === 'in' ? { ...c, on } : c,
      ),
    });
    let r = settle(withInput(false));
    let arrived = false;
    // 指定した tick だけ ON にする
    for (let t = 0; t < ticks; t++) {
      r = stepCircuit(withInput(true), r);
      arrived ||= !!r.values.get('out:0');
    }
    // OFF に戻したあとも、しばらく様子を見る
    for (let t = 0; t < 6; t++) {
      r = stepCircuit(withInput(false), r);
      arrived ||= !!r.values.get('out:0');
    }
    return arrived;
  }

  it('遅延より短いパルスは出力に現れない', () => {
    // AND の遅延は 2。1 tick だけの入力は消える
    expect(pulse(1)).toBe(false);
  });

  it('遅延のぶん続いた入力は出力に現れる', () => {
    expect(pulse(2)).toBe(true);
    expect(pulse(3)).toBe(true);
  });
});
