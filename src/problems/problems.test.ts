import { describe, expect, it } from 'vitest';
import type { Wire } from '../circuit/circuit';
import type { Part } from '../circuit/part';
import { type CircuitDef, MAIN_ID, type Project } from '../circuit/project';
import { computeNets } from '../geometry/net';
import { collectProblems, countProblems } from './problems';

/** 点を (x, y) の組で並べた配線 */
function wire(id: string, ...points: [number, number][]): Wire {
  return { id, points: points.map(([x, y]) => ({ x, y })) };
}

// INPUT a の出力ピンの先は (160, 60)、INPUT b は (160, 260)。OUTPUT o の入力ピンの先は (480, 60)
// biome-ignore format: 表形式を維持するため
const parts: Part[] = [
  { id: 'a', kind: 'input', x: 100, y: 40, portNumber: 1 },
  { id: 'b', kind: 'input', x: 100, y: 240, portNumber: 2 },
  { id: 'o', kind: 'output', x: 500, y: 40, portNumber: 1 },
];

function circuitOf(def: Partial<CircuitDef>): CircuitDef {
  return {
    id: 'm',
    name: 'M',
    path: '',
    author: '',
    package: { kind: 'split', width: 4 },
    sheet: { width: 300, height: 200 },
    parts,
    wires: [],
    ...def,
  } as CircuitDef;
}

function problemsOf(def: CircuitDef, unstable = false) {
  const project: Project = { circuits: [def] } as Project;
  return collectProblems(def, project, computeNets(def, project), unstable);
}

describe('collectProblems', () => {
  it('問題がなければ空', () => {
    expect(problemsOf(circuitOf({}))).toEqual([]);
  });

  it('発振は、か所の数も選ぶものもない', () => {
    expect(problemsOf(circuitOf({}), true)).toEqual([
      { code: 'UNSTABLE', severity: 'error', count: undefined, parts: [], wires: [] },
    ]);
  });

  it('出力のぶつかりは、ぶつかっている出力の部品とネットの配線を選び、ネットの数を数える', () => {
    // a と b の出力を 1 本の配線でつなぐ
    const def = circuitOf({ wires: [wire('w1', [160, 60], [160, 260])] });
    expect(problemsOf(def)).toEqual([
      { code: 'CONFLICT', severity: 'error', count: 1, parts: ['a', 'b'], wires: ['w1'] },
    ]);
  });

  it('外側のピンに出せないポートは、そのポートを選ぶ。メイン回路では出さない', () => {
    const numbered = parts.map((c) =>
      c.id === 'a' ? c : { ...c, pinNumber: c.id === 'b' ? 1 : 2 },
    );
    const def = circuitOf({ package: { kind: 'dip', pins: 4 }, parts: numbered });
    expect(problemsOf(def)).toEqual([
      { code: 'UNEXPOSED_PORTS', severity: 'warning', count: 1, parts: ['a'], wires: [] },
    ]);
    expect(problemsOf({ ...def, id: MAIN_ID })).toEqual([]);
  });

  it('シートの外の部品と配線を選び、その数を数える', () => {
    const def = circuitOf({
      sheet: { width: 20, height: 20 },
      wires: [wire('in', [20, 300], [40, 300]), wire('out', [20, 20], [20, 500])],
    });
    // シートは 400px 四方。o (x = 500) と、下端が 500 の配線 out がはみ出す
    expect(problemsOf(def)).toEqual([
      { code: 'OUTSIDE_SHEET', severity: 'warning', count: 2, parts: ['o'], wires: ['out'] },
    ]);
  });

  it('エラーを先に、警告をあとに並べる', () => {
    const def = circuitOf({
      sheet: { width: 20, height: 20 },
      wires: [wire('w1', [160, 60], [160, 260])],
    });
    const codes = problemsOf(def, true).map((p) => p.code);
    expect(codes).toEqual(['UNSTABLE', 'CONFLICT', 'OUTSIDE_SHEET']);
  });
});

describe('見つからない回路', () => {
  const missing = (id: string, circuitId: string, circuitName?: string): Part => ({
    id,
    kind: 'module',
    x: 100,
    y: 100,
    circuitId,
    ...(circuitName === undefined ? {} : { circuitName }),
  });
  const main = circuitOf({
    id: MAIN_ID,
    parts: [missing('u1', 'gone', '全加算器'), missing('u2', 'gone')],
  });
  const other = circuitOf({
    id: 'o',
    name: 'O',
    parts: [missing('u3', 'gone', '全加算器'), missing('u4', 'lost')],
  });
  const project = { circuits: [main, other] } as Project;
  const of = (def: CircuitDef) => collectProblems(def, project, computeNets(def, project), false);

  it('見つからない回路ごとに 1 つ。か所はすべての回路に置いている数、選ぶのは開いている回路の部品だけ', () => {
    expect(of(main)).toEqual([
      {
        code: 'MISSING_CIRCUIT',
        severity: 'error',
        count: 3,
        circuitId: 'gone',
        name: '全加算器',
        parts: ['u1', 'u2'],
        wires: [],
      },
      {
        code: 'MISSING_CIRCUIT',
        severity: 'error',
        count: 1,
        circuitId: 'lost',
        name: '',
        parts: [],
        wires: [],
      },
    ]);
    expect(of(other).map((p) => p.parts)).toEqual([['u3'], ['u4']]);
  });
});

describe('countProblems', () => {
  it('エラーと警告に分けて数える', () => {
    const def = circuitOf({
      sheet: { width: 20, height: 20 },
      wires: [wire('w1', [160, 60], [160, 260])],
    });
    expect(countProblems(problemsOf(def, true))).toEqual({ errors: 2, warnings: 1 });
  });
});
