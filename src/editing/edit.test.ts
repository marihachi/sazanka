import { describe, expect, it } from 'vitest';
import {
  addPart,
  addParts,
  addWire,
  cloneParts,
  extractParts,
  moveParts,
  remapSelection,
  removeParts,
  rotateParts,
  selectionOf,
  setClockPeriod,
  setWirePoints,
  splitWire,
  setPortName,
  toggleSwitch,
} from './edit';
import type { Circuit } from '../circuit/circuit';
import { computeNets } from '../geometry/net';
import { DEFAULT_SHEET, type CircuitDef, type Project } from '../circuit/project';
import { getPinout } from '../circuit/module';
import type { Part } from '../circuit/part';

// 配線の点は、編集で点がどう変わるかを確かめるためのもの。つながりは geometry/net.test.ts で確かめる
const base: Circuit = {
  // biome-ignore format: 表形式を維持するため
  parts: [
    { id: 'a', kind: 'input', x: 0, y: 0, on: false },
    { id: 'b', kind: 'input', x: 0, y: 40, on: false },
    { id: 'g', kind: 'and', x: 120, y: 0 },
    { id: 'o', kind: 'output', x: 240, y: 20 },
  ],
  // biome-ignore format: 表形式を維持するため
  wires: [
    { id: 'w1', points: [{ x: 60, y: 20 }, { x: 100, y: 20 }] },
    { id: 'w2', points: [{ x: 60, y: 60 }, { x: 80, y: 60 }, { x: 80, y: 80 }, { x: 100, y: 80 }] },
    { id: 'w3', points: [{ x: 200, y: 40 }, { x: 220, y: 40 }] },
  ],
};

describe('edit', () => {
  it('部品を削除しても、つながっていた配線は残る', () => {
    const c = removeParts(base, ['g'], []);
    expect(c.parts.map((k) => k.id)).toEqual(['a', 'b', 'o']);
    expect(c.wires).toEqual(base.wires);
  });

  it('部品と配線をまとめて削除する', () => {
    const c = removeParts(base, ['a', 'g'], ['w2']);
    expect(c.parts.map((x) => x.id)).toEqual(['b', 'o']);
    expect(c.wires.map((w) => w.id)).toEqual(['w1', 'w3']);
  });

  it('配線は末尾に足す', () => {
    const c = addWire(base, {
      id: 'w4',
      points: [
        { x: 0, y: 100 },
        { x: 40, y: 100 },
      ],
    });
    expect(c.wires.map((w) => w.id)).toEqual(['w1', 'w2', 'w3', 'w4']);
  });

  it('空白だけのポート名は名前未設定になる', () => {
    const named = setPortName(base, 'a', ' x ');
    expect(named.parts[0].portName).toBe('x');
    expect(setPortName(named, 'a', '  ').parts[0].portName).toBeUndefined();
  });

  it('部品を足すと末尾に並ぶ', () => {
    const added = addPart(base, { id: 'n', kind: 'not', x: 0, y: 80 });
    expect(added.parts.map((k) => k.id)).toEqual(['a', 'b', 'g', 'o', 'n']);
  });

  it('回路定義の ID や名前は編集しても残る', () => {
    const def: CircuitDef = { ...base, id: 'm', name: 'M' };
    expect(removeParts(def, ['g'], ['w1'])).toMatchObject({ id: 'm', name: 'M' });
  });

  it('スイッチの ON/OFF を切り替える', () => {
    expect(toggleSwitch(base, 'a').parts[0].on).toBe(true);
  });

  it('ない部品や配線を指しても、何も変わらない', () => {
    const c = removeParts(base, ['ない'], ['ない']);
    expect(c.parts).toEqual(base.parts);
    expect(c.wires).toEqual(base.wires);
    expect(toggleSwitch(base, 'ない').parts).toEqual(base.parts);
  });
});

describe('moveParts', () => {
  it('部品と配線をまとめて動かす。指定しないものはそのまま', () => {
    const c = moveParts(
      base,
      new Map([['a', { x: 20, y: 20 }]]),
      new Map([
        [
          'w1',
          [
            { x: 80, y: 40 },
            { x: 120, y: 40 },
          ],
        ],
      ]),
    );
    expect(c.parts.map(({ id, x, y }) => ({ id, x, y }))).toEqual([
      { id: 'a', x: 20, y: 20 },
      { id: 'b', x: 0, y: 40 },
      { id: 'g', x: 120, y: 0 },
      { id: 'o', x: 240, y: 20 },
    ]);
    expect(c.wires[0].points).toEqual([
      { x: 80, y: 40 },
      { x: 120, y: 40 },
    ]);
    expect(c.wires[1]).toBe(base.wires[1]);
  });

  it('部品だけを動かしても、配線はついてこない', () => {
    const c = moveParts(base, new Map([['a', { x: 0, y: 200 }]]));
    expect(c.wires).toEqual(base.wires);
  });
});

describe('コピーと貼り付け', () => {
  it('取り出すのは選んだ部品と配線だけ', () => {
    const fragment = extractParts(base, ['a', 'g'], ['w1']);
    expect(fragment.parts.map((c) => c.id)).toEqual(['a', 'g']);
    expect(fragment.wires.map((w) => w.id)).toEqual(['w1']);
  });

  it('配線だけでも取り出せる', () => {
    const fragment = extractParts(base, [], ['w2', 'w3']);
    expect(fragment.parts).toEqual([]);
    expect(fragment.wires.map((w) => w.id)).toEqual(['w2', 'w3']);
  });

  it('複製すると新しい ID が付き、部品も配線の点も同じだけずれる', () => {
    let n = 0;
    const clone = cloneParts(extractParts(base, ['a'], ['w1']), () => `n${++n}`, {
      x: 40,
      y: 40,
    });
    expect(clone.parts.map(({ id, x, y }) => ({ id, x, y }))).toEqual([{ id: 'n1', x: 40, y: 40 }]);
    expect(clone.wires).toEqual([
      {
        id: 'n2',
        points: [
          { x: 100, y: 60 },
          { x: 140, y: 60 },
        ],
      },
    ]);
  });

  it('貼り付けると、元の部品と配線はそのまま残る', () => {
    let n = 0;
    const clone = cloneParts(extractParts(base, ['a', 'g'], ['w1']), () => `n${++n}`, {
      x: 40,
      y: 40,
    });
    const c = addParts(base, clone);
    expect(c.parts).toHaveLength(base.parts.length + 2);
    expect(c.wires).toHaveLength(base.wires.length + 1);
    expect(c.parts.slice(0, base.parts.length)).toEqual(base.parts);
  });
});

describe('selectionOf', () => {
  it('部品も配線も空なら、選択なし (null)', () => {
    expect(selectionOf([], [])).toBeNull();
    expect(selectionOf(['a'], [])).toEqual({ comps: ['a'], wires: [] });
    expect(selectionOf([], ['w'])).toEqual({ comps: [], wires: ['w'] });
  });
});

describe('remapSelection', () => {
  it('結合で消えた配線を、結合後の配線に置き換える (重なれば 1 つにする)', () => {
    const replaced = new Map([['b', 'a']]);
    expect(remapSelection({ comps: ['c'], wires: ['b'] }, replaced)).toEqual({
      comps: ['c'],
      wires: ['a'],
    });
    expect(remapSelection({ comps: [], wires: ['a', 'b'] }, replaced)).toEqual({
      comps: [],
      wires: ['a'],
    });
    expect(remapSelection(null, replaced)).toBeNull();
  });
});

describe('setWirePoints', () => {
  /** (0, y) から (x, y) までの横線 */
  const line = (x: number, y: number) => [
    { x: 0, y },
    { x, y },
  ];

  it('指定した配線の点の並びだけを変え、元の回路は書き換えない', () => {
    const circuit: Circuit = {
      parts: [],
      wires: [
        { id: 'a', points: line(100, 0) },
        { id: 'b', points: line(100, 40) },
      ],
    };
    const next = setWirePoints(circuit, 'a', line(60, 0));
    expect(next.wires).toEqual([{ id: 'a', points: line(60, 0) }, circuit.wires[1]]);
    expect(circuit.wires[0].points).toEqual(line(100, 0));
  });
});

describe('splitWire', () => {
  /** 点を (x, y) の組で並べたもの */
  const pts = (...xy: [number, number][]) => xy.map(([x, y]) => ({ x, y }));
  const circuit: Circuit = {
    parts: [],
    wires: [
      { id: 'w', points: pts([0, 100], [100, 100], [100, 200]) },
      { id: 'x', points: pts([0, 0], [40, 0]) },
    ],
  };

  it('途中で分けると、前が元の ID、後ろが新しい ID で、元の配線のすぐ後ろに入る', () => {
    const next = splitWire(circuit, 'w', { x: 40, y: 100 }, () => 'n');
    expect(next.wires).toEqual([
      { id: 'w', points: pts([0, 100], [40, 100]) },
      { id: 'n', points: pts([40, 100], [100, 100], [100, 200]) },
      circuit.wires[1],
    ]);
  });

  it('分けたあとの 2 本は、つながったまま (ネットは 1 つ)', () => {
    const next = splitWire(circuit, 'w', { x: 40, y: 100 }, () => 'n');
    const nets = computeNets(next, { circuits: [] }).nets.filter((n) => n.wires.includes('w'));
    expect(nets).toHaveLength(1);
    expect(nets[0].wires).toEqual(['w', 'n']);
  });

  it('折れる点で分けると、折れる点が両方の端になる', () => {
    const next = splitWire(circuit, 'w', { x: 100, y: 100 }, () => 'n');
    expect(next.wires.slice(0, 2)).toEqual([
      { id: 'w', points: pts([0, 100], [100, 100]) },
      { id: 'n', points: pts([100, 100], [100, 200]) },
    ]);
  });
});

describe('setClockPeriod', () => {
  it('CLOCK の周期を変える', () => {
    const c = setClockPeriod(base, 'a', 20);
    expect(c.parts.find((x) => x.id === 'a')?.period).toBe(20);
  });
});

describe('rotateParts', () => {
  const project: Project = { circuits: [] };
  const pinoutOf = (c: Part) => getPinout(c, project);
  const pts = (...ps: [number, number][]) => ps.map(([x, y]) => ({ x, y }));

  it('部品 1 つは、本体の真ん中のあたりで回り、向きが変わる', () => {
    const circuit: Circuit = { parts: [{ id: 'g', kind: 'and', x: 100, y: 100 }], wires: [] };
    // 本体 60×80 が 80×60 になる。中心 (130, 140) は x だけが半端なので、(140, 140) の回りに回す
    expect(rotateParts(circuit, ['g'], [], 'cw', pinoutOf)?.parts).toEqual([
      { id: 'g', kind: 'and', x: 100, y: 100, rotation: 90 },
    ]);
    expect(rotateParts(circuit, ['g'], [], 'ccw', pinoutOf)?.parts).toEqual([
      { id: 'g', kind: 'and', x: 100, y: 120, rotation: 270 },
    ]);
  });

  it('配線 1 本は、点を囲む長方形の中心の回りに回る', () => {
    const circuit: Circuit = { parts: [], wires: [{ id: 'w', points: pts([0, 100], [80, 100]) }] };
    expect(rotateParts(circuit, [], ['w'], 'cw', pinoutOf)?.wires).toEqual([
      { id: 'w', points: pts([40, 60], [40, 140]) },
    ]);
  });

  it('選んでいない部品と配線は変えない', () => {
    const next = rotateParts(base, ['g'], ['w3'], 'cw', pinoutOf);
    expect(next?.parts.filter((c) => c.id !== 'g')).toEqual(base.parts.filter((c) => c.id !== 'g'));
    expect(next?.wires.filter((w) => w.id !== 'w3')).toEqual(
      base.wires.filter((w) => w.id !== 'w3'),
    );
  });

  it('部品と、それにつながる配線を一緒に回すと、つながったまま', () => {
    // w1 は AND g の入力 0 に、w3 は g の出力につながる
    const next = rotateParts(base, ['g'], ['w1', 'w3'], 'cw', pinoutOf);
    if (!next) {
      throw new Error('回せなかった');
    }
    const { wireNet } = computeNets(next, project);
    expect(wireNet.get('w1')?.inputs).toEqual([{ comp: 'g', pin: 0 }]);
    expect(wireNet.get('w3')?.outputs).toEqual([{ comp: 'g', pin: 0 }]);
  });

  // 幅と高さのマスの数の偶奇が違うもの (AND、7 セグメント) と、同じもの (INPUT)、部品と配線のまとまり
  // biome-ignore format: 表形式を維持するため
  const cases: [string, Circuit][] = [
    ['AND', { parts: [{ id: 'g', kind: 'and', x: 100, y: 100 }], wires: [] }],
    ['INPUT', { parts: [{ id: 'i', kind: 'input', x: 100, y: 100 }], wires: [] }],
    ['7 セグメント', { parts: [{ id: 's', kind: 'sevenSegment', x: 100, y: 100 }], wires: [] }],
    ['まとまり', base],
  ];
  for (const [name, circuit] of cases) {
    const ids = circuit.parts.map((c) => c.id);
    const wires = circuit.wires.map((w) => w.id);
    const turn = (c: Circuit | undefined, direction: 'cw' | 'ccw') => {
      if (!c) {
        throw new Error('回せなかった');
      }
      return rotateParts(c, ids, wires, direction, pinoutOf);
    };

    it(`4 回回すと元に戻る (ずれていかない): ${name}`, () => {
      expect(turn(turn(turn(turn(circuit, 'cw'), 'cw'), 'cw'), 'cw')).toEqual(circuit);
      expect(turn(turn(turn(turn(circuit, 'ccw'), 'ccw'), 'ccw'), 'ccw')).toEqual(circuit);
    });

    it(`時計回りと反時計回りは打ち消し合う: ${name}`, () => {
      expect(turn(turn(circuit, 'cw'), 'ccw')).toEqual(circuit);
      expect(turn(turn(circuit, 'ccw'), 'cw')).toEqual(circuit);
      // 1 回回してからでも同じ
      const once = turn(circuit, 'cw');
      expect(turn(turn(once, 'cw'), 'ccw')).toEqual(once);
    });
  }

  it('回した後にシートからはみ出すなら、回さない', () => {
    // 左端に置いた AND。回すと入力ピンが上に来て、本体が左へ 1 マスずれ、左の 1 マスが足りなくなる
    const circuit: Circuit = { parts: [{ id: 'g', kind: 'and', x: 20, y: 0 }], wires: [] };
    expect(rotateParts(circuit, ['g'], [], 'cw', pinoutOf, DEFAULT_SHEET)).toBeUndefined();
    // シートを渡さなければ、はみ出しは見ない
    expect(rotateParts(circuit, ['g'], [], 'cw', pinoutOf)).toBeDefined();
  });

  it('配線の点がシートからはみ出すなら、回さない', () => {
    const circuit: Circuit = { parts: [], wires: [{ id: 'w', points: pts([0, 0], [80, 0]) }] };
    expect(rotateParts(circuit, [], ['w'], 'cw', pinoutOf, DEFAULT_SHEET)).toBeUndefined();
  });

  it('シートの中に収まるなら回す', () => {
    const circuit: Circuit = { parts: [{ id: 'g', kind: 'and', x: 100, y: 100 }], wires: [] };
    expect(rotateParts(circuit, ['g'], [], 'cw', pinoutOf, DEFAULT_SHEET)?.parts[0].rotation).toBe(
      90,
    );
  });
});
