import { describe, expect, it } from 'vitest';
import {
  addPart,
  addParts,
  addWire,
  cloneParts,
  extractParts,
  moveParts,
  removeParts,
  selectionOf,
  setClockPeriod,
  setLabel,
  toggleSwitch,
} from './edit';
import type { Circuit } from '../circuit/circuit';
import type { CircuitDef } from '../circuit/project';

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

  it('空白だけのラベルはラベルなしになる', () => {
    const labeled = setLabel(base, 'a', ' x ');
    expect(labeled.parts[0].label).toBe('x');
    expect(setLabel(labeled, 'a', '  ').parts[0].label).toBeUndefined();
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

describe('setClockPeriod', () => {
  it('CLOCK の周期を変える', () => {
    const c = setClockPeriod(base, 'a', 20);
    expect(c.parts.find((x) => x.id === 'a')?.period).toBe(20);
  });
});
