import { describe, expect, it } from 'vitest';
import type { Part } from './part';
import { emptyProject, MAIN_ID, type Project } from './project';
import { circuitsUsing, dependsOn, portParts, pinoutOf } from './module';

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
    const { inputs, outputs } = portParts(def);
    expect(inputs.map((k) => k.id)).toEqual(['c', 'a', 'b']);
    expect(outputs.map((k) => k.id)).toEqual(['o']);
  });

  it('ピンの出し方を持たないモジュール (テストで作るもの) は split として扱う', () => {
    const project: Project = {
      circuits: [
        { id: MAIN_ID, name: 'メイン', parts: [], wires: [] },
        { id: 'm', name: 'M', parts: [], wires: [] },
      ],
    };
    expect(pinoutOf(comp('u', 'module', { module: 'm' }), project).footprint).toEqual({
      kind: 'split',
    });
    // モジュール以外の部品は持たない
    expect(pinoutOf(comp('g', 'and'), project).footprint).toBeUndefined();
  });

  it('モジュールのピン名は中の INPUT / OUTPUT のラベル。ラベルなしは空文字', () => {
    const project: Project = {
      circuits: [
        { id: MAIN_ID, name: 'メイン', parts: [], wires: [] },
        {
          id: 'm',
          name: 'M',
          footprint: { kind: 'dip', pins: 8 },
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
    expect(pinoutOf(comp('u', 'module', { module: 'm' }), project)).toEqual({
      inputs: ['A', ''],
      outputs: ['S'],
      footprint: { kind: 'dip', pins: 8 },
    });
    // 参照先がなければピンなし
    expect(pinoutOf(comp('u', 'module', { module: 'ない' }), project)).toEqual({
      inputs: [],
      outputs: [],
      footprint: { kind: 'split' },
    });
  });

  it('モジュール以外のピン名は種類で決まる', () => {
    const project = emptyProject();
    expect(pinoutOf(comp('g', 'and'), project)).toEqual({
      inputs: ['', ''],
      outputs: [''],
    });
    expect(pinoutOf(comp('n', 'not'), project)).toEqual({
      inputs: [''],
      outputs: [''],
    });
    expect(pinoutOf(comp('f', 'jkFlipFlop'), project)).toEqual({
      inputs: ['J', '>', 'K'],
      outputs: ['Q', 'Q̄'],
    });
    expect(pinoutOf(comp('i', 'input'), project)).toEqual({
      inputs: [],
      outputs: [''],
    });
    expect(pinoutOf(comp('o', 'output'), project)).toEqual({
      inputs: [''],
      outputs: [],
    });
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
