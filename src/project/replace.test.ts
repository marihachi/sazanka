import { describe, expect, it } from 'vitest';
import type { Part } from '../circuit/part';
import { type CircuitDef, MAIN_ID, type Project } from '../circuit/project';
import { replaceCircuit, replaceTargets, samePins } from './replace';

const mod = (id: string, circuitId: string, extra: Partial<Part> = {}): Part => ({
  id,
  kind: 'module',
  x: 0,
  y: 0,
  circuitId,
  ...extra,
});
const port = (id: string, kind: 'input' | 'output', portNumber: number): Part => ({
  id,
  kind,
  x: 0,
  y: portNumber * 40,
  portNumber,
});
const def = (id: string, parts: Part[] = []): CircuitDef =>
  ({ id, name: id, package: { kind: 'split' }, parts, wires: [] }) as CircuitDef;

// メインに A を置き、B に A を置く。C は B を置く (C → B → A)。D は何も置かない
const project: Project = {
  circuits: [
    def(MAIN_ID, [mod('u1', 'a')]),
    def('a', [port('i', 'input', 1)]),
    def('b', [mod('u2', 'a')]),
    def('c', [mod('u3', 'b')]),
    def('d', [port('i', 'input', 1), port('o', 'output', 1)]),
  ],
};

describe('replaceTargets', () => {
  it('自分自身、メイン回路、差し替えると循環する回路は除く', () => {
    // A を置いているのはメインと B。B 自身と、B を含む C は除く
    expect(replaceTargets(project, 'a').map((d) => d.id)).toEqual(['d']);
    expect(replaceTargets(project, 'd').map((d) => d.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('replaceCircuit', () => {
  it('置いている部品をすべて差し替え先に向ける。名前と大きさの写しは捨てる', () => {
    const withCopy: Project = {
      circuits: project.circuits.map((d) =>
        d.id === MAIN_ID
          ? {
              ...d,
              parts: [mod('u1', 'a', { circuitName: 'A', circuitSize: { width: 4, height: 2 } })],
            }
          : d,
      ),
    };
    const result = replaceCircuit(withCopy, 'a', 'd', false);
    expect(result.circuits[0].parts).toEqual([mod('u1', 'd')]);
    expect(result.circuits[2].parts).toEqual([mod('u2', 'd')]);
    expect(result.circuits.map((d) => d.id)).toContain('a');
    // 部品を書き換えない回路は、同じもの
    expect(result.circuits[3]).toBe(withCopy.circuits[3]);
  });

  it('元を削除すると、元の回路がなくなる', () => {
    expect(replaceCircuit(project, 'a', 'd', true).circuits.map((d) => d.id)).toEqual([
      MAIN_ID,
      'b',
      'c',
      'd',
    ]);
  });
});

describe('samePins', () => {
  it('入力と出力の数が同じなら同じ、違えば違う', () => {
    const p: Project = { circuits: [...project.circuits, def('a2', [port('j', 'input', 1)])] };
    expect(samePins(p, 'a', 'a2')).toBe(true);
    expect(samePins(p, 'a', 'd')).toBe(false);
  });
});
