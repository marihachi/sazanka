import { describe, expect, it } from 'vitest';
import type { Part } from './part';
import { emptyProject, MAIN_ID, type Project } from './project';
import {
  applyModuleSettings,
  assignInOrder,
  assignPinNumbers,
  assignPortNumbers,
  fillPortNumbers,
  findDuplicateLabels,
  calcFittingPins,
  listPortsInPositionOrder,
  circuitsUsing,
  dependsOn,
  getPortsInPinOrder,
  findUnexposedPorts,
  getPinout,
} from './module';
import type { CircuitDef } from './project';

function comp(id: string, kind: Part['kind'], extra: Partial<Part> = {}): Part {
  return { id, kind, x: 0, y: 0, ...extra };
}

describe('circuitsUsing', () => {
  it('モジュールを直接置いている回路を返す', () => {
    const project: Project = {
      circuits: [
        {
          id: MAIN_ID,
          name: 'メイン',
          parts: [comp('m', 'module', { module: 'a' })],
          wires: [],
        },
        {
          id: 'a',
          name: 'A',
          parts: [comp('n', 'module', { module: 'b' })],
          wires: [],
        },
        { id: 'b', name: 'B', parts: [], wires: [] },
      ],
    };
    expect(circuitsUsing(project, 'a').map((d) => d.id)).toEqual([MAIN_ID]);
    expect(circuitsUsing(project, 'b').map((d) => d.id)).toEqual(['a']);
    expect(circuitsUsing(project, MAIN_ID)).toEqual([]);
  });
});

describe('モジュールのピン', () => {
  it('ピンになるのは INPUT / OUTPUT で、上から順、同じ高さなら左から', () => {
    const def = {
      // biome-ignore format: 表形式を維持するため
      parts: [
        { id: 'b', kind: 'input' as const, x: 100, y: 40 },
        { id: 'a', kind: 'input' as const, x: 0, y: 40 },
        { id: 'c', kind: 'input' as const, x: 0, y: 0 },
        { id: 'g', kind: 'and' as const, x: 0, y: 0 },
        { id: 'o', kind: 'output' as const, x: 0, y: 0 },
      ],
      wires: [],
    };
    const { inputs, outputs } = getPortsInPinOrder(def);
    expect(inputs.map((k) => k.id)).toEqual(['c', 'a', 'b']);
    expect(outputs.map((k) => k.id)).toEqual(['o']);
  });

  it('パッケージを持たないモジュール (テストで作るもの) は split として扱う', () => {
    const project: Project = {
      circuits: [
        { id: MAIN_ID, name: 'メイン', parts: [], wires: [] },
        { id: 'm', name: 'M', parts: [], wires: [] },
      ],
    };
    expect(getPinout(comp('u', 'module', { module: 'm' }), project).package).toEqual({
      kind: 'split',
    });
    // モジュール以外の部品は持たない
    expect(getPinout(comp('g', 'and'), project).package).toBeUndefined();
  });

  it('モジュールのピン名は中の INPUT / OUTPUT のラベル。ラベルなしは空文字', () => {
    const project: Project = {
      circuits: [
        { id: MAIN_ID, name: 'メイン', parts: [], wires: [] },
        {
          id: 'm',
          name: 'M',
          package: { kind: 'split' },
          // biome-ignore format: 表形式を維持するため
          parts: [
            comp('i', 'input', { label: 'A' }),
            { ...comp('j', 'input'), y: 40 },
            comp('o', 'output', { label: 'S' }),
          ],
          wires: [],
        },
      ],
    };
    expect(getPinout(comp('u', 'module', { module: 'm' }), project)).toEqual({
      inputs: ['A', ''],
      outputs: ['S'],
      package: { kind: 'split' },
    });
    // 参照先がなければピンなし
    expect(getPinout(comp('u', 'module', { module: 'ない' }), project)).toEqual({
      inputs: [],
      outputs: [],
      package: { kind: 'split' },
    });
  });

  it('モジュール以外のピン名は種類で決まる', () => {
    const project = emptyProject();
    expect(getPinout(comp('g', 'and'), project)).toEqual({
      inputs: ['', ''],
      outputs: [''],
    });
    expect(getPinout(comp('n', 'not'), project)).toEqual({
      inputs: [''],
      outputs: [''],
    });
    expect(getPinout(comp('f', 'jkFlipFlop'), project)).toEqual({
      inputs: ['J', '>', 'K'],
      outputs: ['Q', 'Q̄'],
    });
    expect(getPinout(comp('i', 'input'), project)).toEqual({
      inputs: [],
      outputs: [''],
    });
    expect(getPinout(comp('o', 'output'), project)).toEqual({
      inputs: [''],
      outputs: [],
    });
  });
});

describe('dip のモジュールのピン番号', () => {
  /** 8 ピンの dip のモジュール */
  function dip(parts: Part[]): CircuitDef {
    return { id: 'm', name: 'M', package: { kind: 'dip', pins: 8 }, parts, wires: [] };
  }

  it('外側のピンは、入力か出力かを問わずピン番号の順に並ぶ', () => {
    // biome-ignore format: 表形式を維持するため
    const def = dip([
      comp('a', 'input', { pinNumber: 3, label: 'A' }),
      comp('b', 'input', { pinNumber: 1, label: 'B' }),
      comp('s', 'output', { pinNumber: 8, label: 'S' }),
      comp('c', 'output', { pinNumber: 2, label: 'C' }),
    ]);
    const { inputs, outputs } = getPortsInPinOrder(def);
    expect(inputs.map((c) => c.id)).toEqual(['b', 'a']);
    expect(outputs.map((c) => c.id)).toEqual(['c', 's']);
    const project: Project = { circuits: [emptyProject().circuits[0], def] };
    expect(getPinout(comp('u', 'module', { module: 'm' }), project)).toEqual({
      inputs: ['B', 'A'],
      outputs: ['C', 'S'],
      package: { kind: 'dip', pins: 8 },
      pinNumbers: { inputs: [1, 3], outputs: [2, 8] },
    });
  });

  it('番号がない・範囲外・重なるポートは、外側のピンに出さない', () => {
    // biome-ignore format: 表形式を維持するため
    const def = dip([
      comp('ok', 'input', { pinNumber: 1 }),
      comp('none', 'input'),
      comp('big', 'input', { pinNumber: 9 }),
      comp('zero', 'output', { pinNumber: 0 }),
      comp('d1', 'input', { pinNumber: 4 }),
      comp('d2', 'output', { pinNumber: 4 }),
      comp('g', 'and', { pinNumber: 5 }),
    ]);
    expect(findUnexposedPorts(def)).toEqual(
      new Map([
        ['none', 'unassigned'],
        ['big', 'outOfRange'],
        ['zero', 'outOfRange'],
        ['d1', 'duplicate'],
        ['d2', 'duplicate'],
      ]),
    );
    const { inputs, outputs } = getPortsInPinOrder(def);
    expect(inputs.map((c) => c.id)).toEqual(['ok']);
    expect(outputs).toEqual([]);
  });

  it('split のモジュールには、外側のピンに出せないポートはない', () => {
    const def: CircuitDef = { ...dip([comp('a', 'input')]), package: { kind: 'split' } };
    expect(findUnexposedPorts(def).size).toBe(0);
  });
});

describe('assignPinNumbers', () => {
  function dip(parts: Part[], pins = 8): CircuitDef {
    return { id: 'm', name: 'M', package: { kind: 'dip', pins }, parts, wires: [] };
  }
  const numbers = (def: CircuitDef) => def.parts.map((c) => c.pinNumber);

  it('置いたポートに、空いているいちばん小さい番号を入れる', () => {
    const def = dip([comp('a', 'input', { pinNumber: 1 }), comp('b', 'output', { pinNumber: 3 })]);
    const added = { ...def, parts: [...def.parts, comp('c', 'input'), comp('d', 'output')] };
    expect(numbers(assignPinNumbers(added, new Set(['c', 'd'])))).toEqual([1, 3, 2, 4]);
  });

  it('貼り付けたポートは、空いている番号ならそのまま、重なるか範囲外なら付け直す', () => {
    // biome-ignore format: 表形式を維持するため
    const def = dip([
      comp('a', 'input', { pinNumber: 1 }),
      comp('p', 'input', { pinNumber: 5 }),
      comp('q', 'input', { pinNumber: 1 }),
      comp('r', 'output', { pinNumber: 5 }),
      comp('s', 'output', { pinNumber: 20 }),
    ]);
    expect(numbers(assignPinNumbers(def, new Set(['p', 'q', 'r', 's'])))).toEqual([1, 5, 2, 3, 4]);
  });

  it('前からある重なりは直さず、その番号を新しいポートに使わない', () => {
    // biome-ignore format: 表形式を維持するため
    const def = dip([
      comp('a', 'input', { pinNumber: 1 }),
      comp('b', 'input', { pinNumber: 1 }),
      comp('c', 'input'),
    ]);
    expect(numbers(assignPinNumbers(def, new Set(['c'])))).toEqual([1, 1, 2]);
  });

  it('空きがなければ番号を外す', () => {
    // biome-ignore format: 表形式を維持するため
    const def = dip([
      comp('a', 'input', { pinNumber: 1 }), comp('b', 'input', { pinNumber: 2 }),
      comp('c', 'input', { pinNumber: 3 }), comp('d', 'input', { pinNumber: 4 }),
      comp('e', 'input', { pinNumber: 1 }),
    ], 4);
    expect(numbers(assignPinNumbers(def, new Set(['e'])))).toEqual([1, 2, 3, 4, undefined]);
    expect(assignPinNumbers(def, new Set(['e'])).parts[4]).not.toHaveProperty('pinNumber');
  });

  it('メイン回路と split のモジュールでは、置いたポートの番号を外す', () => {
    const main = { ...emptyProject().circuits[0], parts: [comp('a', 'input', { pinNumber: 2 })] };
    expect(assignPinNumbers(main, new Set(['a'])).parts[0]).not.toHaveProperty('pinNumber');
    const split: CircuitDef = { ...main, id: 'm', package: { kind: 'split' } };
    expect(assignPinNumbers(split, new Set(['a'])).parts[0]).not.toHaveProperty('pinNumber');
  });

  it('ポート以外の部品と、前からあるポートは変えない', () => {
    const def = dip([comp('g', 'and'), comp('a', 'input', { pinNumber: 9 })]);
    expect(assignPinNumbers(def, new Set(['g']))).toBe(def);
    expect(assignPinNumbers(def, new Set(['x'])).parts[1].pinNumber).toBe(9);
  });
});

describe('assignPortNumbers', () => {
  const main = (parts: Part[]) => ({ ...emptyProject().circuits[0], parts });
  const numbers = (def: { parts: Part[] }) => def.parts.map((c) => c.portNumber);

  it('置いたポートに、入力と出力で別々に、空いているいちばん小さい番号を付ける', () => {
    // biome-ignore format: 表形式を維持するため
    const def = main([
      comp('a', 'input', { portNumber: 1 }), comp('b', 'input', { portNumber: 3 }),
      comp('c', 'output', { portNumber: 1 }),
      comp('d', 'input'), comp('e', 'output'),
    ]);
    expect(numbers(assignPortNumbers(def, new Set(['d', 'e'])))).toEqual([1, 3, 1, 2, 2]);
  });

  it('貼り付けたポートは、空いている番号ならそのまま、重なれば中の位置の順に付け直す', () => {
    // biome-ignore format: 表形式を維持するため
    const def = main([
      comp('a', 'input', { portNumber: 1 }),
      comp('p', 'input', { portNumber: 5 }),
      comp('q', 'input', { portNumber: 1, y: 100 }),
      comp('r', 'input', { portNumber: 1, y: 50 }),
    ]);
    expect(numbers(assignPortNumbers(def, new Set(['p', 'q', 'r'])))).toEqual([1, 5, 3, 2]);
  });

  it('ポート以外の部品だけなら、回路をそのまま返す', () => {
    const def = main([comp('g', 'and'), comp('a', 'input', { portNumber: 4 })]);
    expect(assignPortNumbers(def, new Set(['g']))).toBe(def);
  });
});

describe('fillPortNumbers', () => {
  it('ないものと重なるものに番号を付け、重なりでは中の位置の順で先のポートが番号を持ち続ける', () => {
    // biome-ignore format: 表形式を維持するため
    const def = { ...emptyProject().circuits[0], parts: [
      comp('a', 'input', { portNumber: 2, y: 100 }),
      comp('b', 'input', { portNumber: 2, y: 0 }),
      comp('c', 'input'),
      comp('d', 'output', { portNumber: 2 }),
    ] };
    expect(fillPortNumbers(def).parts.map((c) => c.portNumber)).toEqual([3, 2, 1, 2]);
  });
});

describe('applyModuleSettings の名前', () => {
  const def: CircuitDef = {
    id: 'm',
    name: 'M',
    package: { kind: 'split' },
    wires: [],
    parts: [
      comp('a', 'input', { label: 'A' }),
      comp('b', 'output'),
      comp('c', 'input', { label: 'C' }),
    ],
  };

  it('名前を変え、空白だけなら名前なしにし、labels にないポートは変えない', () => {
    const result = applyModuleSettings(
      def,
      { kind: 'split' },
      new Map(),
      new Map([
        ['a', ' X '],
        ['b', 'Y'],
        ['c', '  '],
      ]),
    );
    expect(result.parts.map((c) => c.label)).toEqual(['X', 'Y', undefined]);
    expect(result.parts[2]).not.toHaveProperty('label');
    expect(
      applyModuleSettings(def, { kind: 'split' }, new Map(), new Map([['b', 'Y']])).parts[0],
    ).toBe(def.parts[0]);
  });
});

describe('findDuplicateLabels', () => {
  it('入力と出力をまたいで重なりを見る。名前なしと前後の空白は数えない', () => {
    const labels = new Map([
      ['a', 'A'],
      ['b', ' A'],
      ['c', ''],
      ['d', '  '],
      ['e', 'E'],
    ]);
    expect(findDuplicateLabels(labels)).toEqual(new Set(['a', 'b']));
  });
});

describe('dependsOn', () => {
  // biome-ignore format: 表形式を維持するため
  const project: Project = {
    circuits: [
      { id: MAIN_ID, name: 'メイン', parts: [comp('u', 'module', { module: 'a' })], wires: [] },
      { id: 'a', name: 'A', parts: [comp('u', 'module', { module: 'b' })], wires: [] },
      { id: 'b', name: 'B', parts: [], wires: [] },
    ],
  };

  it('間接的に含む場合も true', () => {
    expect(dependsOn(project, MAIN_ID, 'b')).toBe(true);
    expect(dependsOn(project, 'a', 'b')).toBe(true);
    expect(dependsOn(project, 'b', 'a')).toBe(false);
  });
});

describe('モジュール設定の計算', () => {
  // biome-ignore format: 表形式を維持するため
  const parts: Part[] = [
    { ...comp('o1', 'output'), y: 0 },
    { ...comp('i2', 'input'), y: 40 },
    { ...comp('i1', 'input'), y: 0 },
    { ...comp('g', 'and'), y: 0 },
  ];
  const def: CircuitDef = { id: 'm', name: 'M', package: { kind: 'split' }, parts, wires: [] };

  it('ポートを、入力を上から、続けて出力を上から並べる', () => {
    expect(listPortsInPositionOrder(def).map((c) => c.id)).toEqual(['i1', 'i2', 'o1']);
  });

  it('並びの先頭から番号を割り当てる。番号が足りなければ残りは割り当てない', () => {
    const ports = listPortsInPositionOrder(def);
    expect(assignInOrder(ports, 8)).toEqual(
      new Map([
        ['i1', 1],
        ['i2', 2],
        ['o1', 3],
      ]),
    );
    expect(assignInOrder(ports, 2)).toEqual(
      new Map([
        ['i1', 1],
        ['i2', 2],
      ]),
    );
  });

  it('ポートが収まるいちばん小さいピン数', () => {
    expect([0, 3, 4, 5, 9].map((n) => calcFittingPins('dip', n))).toEqual([4, 4, 4, 6, 10]);
    expect([0, 8, 9, 13].map((n) => calcFittingPins('qfp', n))).toEqual([8, 8, 12, 16]);
    expect(calcFittingPins('qfp', 1000)).toBe(256);
  });

  it('パッケージとピン番号を当てはめる。範囲外と、numbers にないポートの番号は外す', () => {
    const numbered: CircuitDef = {
      ...def,
      parts: [...parts.slice(0, 3).map((c) => ({ ...c, pinNumber: 9 })), parts[3]],
    };
    const result = applyModuleSettings(
      numbered,
      { kind: 'dip', pins: 4 },
      new Map([
        ['i1', 1],
        ['o1', 5],
      ]),
    );
    expect(result.package).toEqual({ kind: 'dip', pins: 4 });
    expect(result.parts.map((c) => c.pinNumber)).toEqual([undefined, undefined, 1, undefined]);
    expect(result.parts[0]).not.toHaveProperty('pinNumber');
  });

  it('split にすると、ポートのピン番号を外す', () => {
    const numbered: CircuitDef = { ...def, parts: [{ ...parts[0], pinNumber: 1 }] };
    const result = applyModuleSettings(numbered, { kind: 'split' }, new Map([['o1', 1]]));
    expect(result.parts[0]).not.toHaveProperty('pinNumber');
  });
});
