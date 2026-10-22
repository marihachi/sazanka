import { describe, expect, it } from 'vitest';
import type { Part } from '../circuit/part';
import { type CircuitDef, MAIN_ID, type Project } from '../circuit/project';
import { folderName, parentOf, treeRows, usagesOf } from './folders';

const def = (id: string, path = '', parts: Part[] = []): CircuitDef => ({
  id,
  name: id,
  path,
  parts,
  wires: [],
});
const mod = (id: string, circuitId: string): Part => ({
  id,
  kind: 'module',
  x: 0,
  y: 0,
  circuitId,
});

describe('フォルダのパス', () => {
  it('親と名前', () => {
    expect(parentOf('lib/gates')).toBe('lib');
    expect(parentOf('lib')).toBe('');
    expect(folderName('lib/gates')).toBe('gates');
    expect(folderName('lib')).toBe('lib');
  });
});

describe('treeRows', () => {
  const project: Project = {
    folders: ['lib', 'adders', 'lib/gates', 'empty'],
    circuits: [
      def(MAIN_ID),
      def('fa', 'adders'),
      def('seg', 'lib'),
      def('and', 'lib/gates'),
      def('cnt'),
    ],
  };
  const show = (rows: ReturnType<typeof treeRows>) =>
    rows.map((r) => `${'  '.repeat(r.depth)}${r.kind === 'folder' ? `[${r.name}]` : r.def.id}`);

  it('子のフォルダを先に (folders の順)、そのあとに回路を (回路の並びの順) 並べる', () => {
    expect(show(treeRows(project))).toEqual([
      '[lib]',
      '  [gates]',
      '    and',
      '  seg',
      '[adders]',
      '  fa',
      '[empty]',
      'main',
      'cnt',
    ]);
  });

  it('折り畳んだフォルダの中は並べない。中があるかは hasChildren で分かる', () => {
    const rows = treeRows(project, new Set(['lib']));
    expect(show(rows)).toEqual(['[lib]', '[adders]', '  fa', '[empty]', 'main', 'cnt']);
    expect(
      rows.filter((r) => r.kind === 'folder').map((r) => r.kind === 'folder' && r.hasChildren),
    ).toEqual([true, true, false]);
  });
});

describe('usagesOf', () => {
  it('置いている回路と数を、回路の並びの順に返す', () => {
    const project: Project = {
      circuits: [
        def(MAIN_ID, '', [mod('a', 'fa'), mod('b', 'fa')]),
        def('fa'),
        def('cnt', '', [mod('c', 'fa')]),
      ],
    };
    expect(usagesOf(project, 'fa').map((u) => [u.def.id, u.count])).toEqual([
      [MAIN_ID, 2],
      ['cnt', 1],
    ]);
    expect(usagesOf(project, 'cnt')).toEqual([]);
  });
});
