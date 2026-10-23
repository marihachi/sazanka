import { describe, expect, it } from 'vitest';
import type { Part } from '../circuit/part';
import { type CircuitDef, MAIN_ID, type Project } from '../circuit/project';
import {
  addFolder,
  checkFolderName,
  dropTarget,
  folderName,
  isEmptyFolder,
  moveCircuitTo,
  moveFolderTo,
  parentOf,
  removeFolder,
  renameFolder,
  treeRows,
  uniqueCircuitName,
  usagesOf,
} from './folders';

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

describe('フォルダの操作', () => {
  const base: Project = {
    folders: ['lib', 'lib/gates', 'adders'],
    circuits: [def(MAIN_ID), def('fa', 'adders'), def('and', 'lib/gates'), def('seg', 'lib')],
  };

  it('名前を確かめる: 空、/ を含む、同じ親に同じ名前', () => {
    expect(checkFolderName(base, '', '')).toBe('EMPTY');
    expect(checkFolderName(base, '', 'a/b')).toBe('BAD');
    expect(checkFolderName(base, '', 'lib')).toBe('TAKEN');
    expect(checkFolderName(base, 'lib', 'gates')).toBe('TAKEN');
    expect(checkFolderName(base, 'adders', 'gates')).toBeUndefined();
    // 改名で、自分自身とは重ならない
    expect(checkFolderName(base, '', 'lib', 'lib')).toBeUndefined();
  });

  it('足すと、同じ親のフォルダの末尾に並ぶ', () => {
    expect(addFolder(base, '', 'new').folders).toEqual(['lib', 'lib/gates', 'adders', 'new']);
    expect(addFolder(base, 'lib', 'mem').folders).toEqual([
      'lib',
      'lib/gates',
      'lib/mem',
      'adders',
    ]);
  });

  it('改名すると、中のフォルダと回路のパスも変わる', () => {
    const p = renameFolder(base, 'lib', 'parts');
    expect(p.folders).toEqual(['parts', 'parts/gates', 'adders']);
    expect(p.circuits.map((d) => d.path)).toEqual(['', 'adders', 'parts/gates', 'parts']);
  });

  it('空のフォルダだけ削除できる', () => {
    expect(isEmptyFolder(base, 'lib')).toBe(false);
    expect(isEmptyFolder(base, 'lib/gates')).toBe(false);
    const empty = addFolder(base, '', 'empty');
    expect(isEmptyFolder(empty, 'empty')).toBe(true);
    expect(removeFolder(empty, 'empty').folders).toEqual(base.folders);
  });

  it('回路を別のフォルダへ移す。並びの位置と、名前の重なりの (2)', () => {
    const p = moveCircuitTo(base, 'seg', 'adders', 0);
    expect(p.circuits.map((d) => `${d.id}@${d.path}`)).toEqual([
      'main@',
      'seg@adders',
      'fa@adders',
      'and@lib/gates',
    ]);
    const dup: Project = {
      ...base,
      circuits: [...base.circuits, { ...def('fa2', 'lib'), name: 'fa' }],
    };
    expect(moveCircuitTo(dup, 'fa2', 'adders').circuits.find((d) => d.id === 'fa2')?.name).toBe(
      'fa (2)',
    );
    expect(uniqueCircuitName(base, 'adders', 'fa')).toBe('fa (2)');
    expect(uniqueCircuitName(base, 'adders', 'fa', 'fa')).toBe('fa');
  });

  it('フォルダを中身ごと移す。自分の中へは移せず、同じ名前があれば移さない', () => {
    const p = moveFolderTo(base, 'lib/gates', 'adders');
    expect(p?.folders).toEqual(['lib', 'adders', 'adders/gates']);
    expect(p?.circuits.find((d) => d.id === 'and')?.path).toBe('adders/gates');
    expect(moveFolderTo(base, 'lib', 'lib/gates')).toBeUndefined();
    expect(moveFolderTo(addFolder(base, 'adders', 'gates'), 'lib/gates', 'adders')).toBeUndefined();
    // 同じ親の中の並べ替え
    expect(moveFolderTo(base, 'adders', '', 0)?.folders).toEqual(['adders', 'lib', 'lib/gates']);
  });
});

describe('dropTarget', () => {
  const project: Project = {
    folders: ['lib', 'lib/gates', 'adders'],
    circuits: [
      def(MAIN_ID),
      def('fa', 'adders'),
      def('ha', 'adders'),
      def('and', 'lib/gates'),
      def('seg', 'lib'),
      def('cnt'),
    ],
  };
  // [lib] [gates] and seg [adders] fa ha main cnt
  const rows = treeRows(project);
  // 見つからない行で調べると、テストが何も確かめずに通ってしまうので、見つからなければ止める
  const at = (key: string) => {
    const i = rows.findIndex((r) => (r.kind === 'folder' ? `[${r.path}]` : r.def.id) === key);
    if (i < 0) {
      throw new Error(`行がない: ${key}`);
    }
    return i;
  };
  const row = (key: string) => rows[at(key)];

  it('フォルダの行の上に落とすと、その中の末尾へ', () => {
    expect(dropTarget(project, rows, row('cnt'), at('[adders]'), 'into')).toEqual({
      kind: 'circuit',
      folder: 'adders',
    });
    expect(dropTarget(project, rows, row('[adders]'), at('[lib]'), 'into')).toEqual({
      kind: 'folder',
      parent: 'lib',
    });
  });

  it('回路の間に落とすと、その位置へ (動かす回路は数えない)', () => {
    expect(dropTarget(project, rows, row('cnt'), at('ha'), 'before')).toEqual({
      kind: 'circuit',
      folder: 'adders',
      index: 1,
    });
    expect(dropTarget(project, rows, row('fa'), at('ha'), 'after')).toEqual({
      kind: 'circuit',
      folder: 'adders',
      index: 1,
    });
    expect(dropTarget(project, rows, row('ha'), at('cnt'), 'before')).toEqual({
      kind: 'circuit',
      folder: '',
      index: 1,
    });
  });

  it('開いているフォルダの行のすぐ下は、その中の先頭', () => {
    expect(dropTarget(project, rows, row('cnt'), at('[adders]'), 'after')).toEqual({
      kind: 'circuit',
      folder: 'adders',
      index: 0,
    });
    expect(dropTarget(project, rows, row('[adders]'), at('[lib]'), 'after')).toEqual({
      kind: 'folder',
      parent: 'lib',
      index: 0,
    });
  });

  it('いちばん下の行より下に落とすと、いちばん上の階層の末尾へ', () => {
    expect(dropTarget(project, rows, row('fa'), rows.length, 'after')).toEqual({
      kind: 'circuit',
      folder: '',
    });
    expect(dropTarget(project, rows, row('[lib/gates]'), rows.length, 'after')).toEqual({
      kind: 'folder',
      parent: '',
    });
  });

  it('フォルダはフォルダの間に並べる。自分の中へは落とせない', () => {
    expect(dropTarget(project, rows, row('[adders]'), at('[lib]'), 'before')).toEqual({
      kind: 'folder',
      parent: '',
      index: 0,
    });
    expect(dropTarget(project, rows, row('[lib]'), at('[lib/gates]'), 'into')).toBeUndefined();
    expect(dropTarget(project, rows, row('[lib]'), at('and'), 'before')).toBeUndefined();
    // 回路をフォルダの行の前後に落とすと、そのフォルダと同じ階層の回路の先頭へ (フォルダの外へ出せる)。
    // フォルダは回路の間に並べない
    expect(dropTarget(project, rows, row('fa'), at('[adders]'), 'before')).toEqual({
      kind: 'circuit',
      folder: '',
      index: 0,
    });
    expect(dropTarget(project, rows, row('and'), at('[lib/gates]'), 'before')).toEqual({
      kind: 'circuit',
      folder: 'lib',
      index: 0,
    });
    expect(dropTarget(project, rows, row('[adders]'), at('cnt'), 'before')).toBeUndefined();
  });
});
