import { describe, expect, it } from 'vitest';
import type { Part } from '../circuit/part';
import { type CircuitDef, findDef, MAIN_ID, type Project } from '../circuit/project';
import {
  defaultImportActions,
  type ImportAction,
  importCircuits,
  planImport,
  withDependencies,
} from './exchange';

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
const def = (id: string, name: string, parts: Part[] = [], path = ''): CircuitDef => ({
  id,
  name,
  path,
  author: '',
  package: { kind: 'split' },
  parts,
  wires: [],
});
/** 見つからないモジュールの部品 (名前と大きさの写しを持つ) */
const missing = (id: string, circuitId: string, name: string) =>
  mod(id, circuitId, { circuitName: name, circuitSize: { width: 4, height: 2 } });

describe('withDependencies', () => {
  // メインに A、A に B、B に C を置く。D は B を置く。E は見つからない回路 X を置く
  const project: Project = {
    circuits: [
      def(MAIN_ID, '', [mod('u0', 'a')]),
      def('d', 'D', [mod('u1', 'b')]),
      def('a', 'A', [mod('u2', 'b')]),
      def('b', 'B', [mod('u3', 'c')]),
      def('c', 'C'),
      def('e', 'E', [missing('u4', 'x', 'X')]),
    ],
  };

  it('入れ子までたどり、プロジェクトの並びの順に返す', () => {
    expect(withDependencies(project, ['a'])).toEqual(['a', 'b', 'c']);
    expect(withDependencies(project, ['c', 'd'])).toEqual(['d', 'b', 'c']);
  });

  it('メイン回路と、プロジェクトにない回路は含めない', () => {
    expect(withDependencies(project, [MAIN_ID])).toEqual([]);
    expect(withDependencies(project, ['e'])).toEqual(['e']);
  });
});

describe('planImport と importCircuits', () => {
  // プロジェクト: メインに FA (id fa、「FA」に改名してある) を置く。フォルダ lib に「乗算器」がある
  const project: Project = {
    folders: ['lib'],
    circuits: [
      def(MAIN_ID, '', [mod('u0', 'fa')]),
      def('fa', 'FA', [port('i', 'input', 1)], 'lib'),
      def('add4', '4 ビット加算器', [], 'lib'),
      def('mul0', '乗算器', [], 'lib'),
    ],
  };
  // 回路ファイル: 全加算器 (fa。ピンが 2 つに増えた。半加算器を使う)、4 ビット加算器 (add4)、半加算器 (ha)、比較器 (cmp)、乗算器 (mul)
  const file: CircuitDef[] = [
    def('fa', '全加算器', [
      port('i', 'input', 1),
      port('j', 'input', 2),
      missing('u1', 'ha', '半加算器'),
    ]),
    def('add4', '4 ビット加算器'),
    def('ha', '半加算器'),
    def('cmp', '比較器'),
    def('mul', '乗算器'),
  ];
  const actions = (entries: [string, ImportAction][] = []) =>
    new Map([...defaultImportActions(project, file), ...entries]);

  it('既定の扱いは、同じ ID があれば置き換え、なければ追加', () => {
    expect([...defaultImportActions(project, file)]).toEqual([
      ['fa', 'replace'],
      ['add4', 'replace'],
      ['ha', 'add'],
      ['cmp', 'add'],
      ['mul', 'add'],
    ]);
  });

  it('一覧: 選べる扱い、プロジェクトでの名前、ピンが変わるか', () => {
    const rows = planImport(project, file, 'lib', actions([['add4', 'skip']]));
    const view = rows.map((r) => [r.def.id, r.choices.join('/'), r.action, r.projectName ?? '—']);
    expect(view).toEqual([
      // 同じ ID: 置き換えても、プロジェクトでの名前 (FA) のまま
      ['fa', 'replace/skip', 'replace', 'FA'],
      // 同じ ID で読み込まない: 名前は「—」
      ['add4', 'replace/skip', 'skip', '—'],
      ['ha', 'add/skip', 'add', '半加算器'],
      ['cmp', 'add/skip', 'add', '比較器'],
      // 読み込み先のフォルダに同じ名前がある: 名前を変えて足す
      ['mul', 'add/skip', 'add', '乗算器 (2)'],
    ]);
    expect(rows.map((r) => r.nameTaken)).toEqual([false, false, false, false, true]);
    // 全加算器はピンが 1 つから 2 つに増える
    expect(rows.map((r) => r.pinsChange)).toEqual([true, false, false, false, false]);
  });

  it('名前の重なりは、読み込み先のフォルダの中だけで見る', () => {
    const rows = planImport(project, file, '', actions());
    expect(rows.find((r) => r.def.id === 'mul')?.projectName).toBe('乗算器');
  });

  it('読み込まないと見つからなくなる回路には、使っている回路の名前を出す', () => {
    const rows = planImport(project, file, 'lib', actions([['ha', 'skip']]));
    expect(rows.find((r) => r.def.id === 'ha')?.missingUsers).toEqual(['全加算器']);
    // 使っている回路も読み込まないなら出さない
    const both = planImport(
      project,
      file,
      'lib',
      actions([
        ['ha', 'skip'],
        ['fa', 'skip'],
      ]),
    );
    expect(both.find((r) => r.def.id === 'ha')?.missingUsers).toEqual([]);
    // 同じ ID の回路がプロジェクトにあれば、読み込まなくても見つかるので出さない
    const kept = planImport(project, file, 'lib', actions([['add4', 'skip']]));
    expect(kept.find((r) => r.def.id === 'add4')?.missingUsers).toEqual([]);
  });

  it('選べない扱いを渡しても、既定の扱いにする', () => {
    const rows = planImport(project, file, 'lib', actions([['cmp', 'replace']]));
    expect(rows.find((r) => r.def.id === 'cmp')?.action).toBe('add');
  });

  it('読み込むと、置き換えは位置とフォルダと名前を保ち、追加は末尾のフォルダに入る。ID は付け直さない', () => {
    const result = importCircuits(project, file, 'lib', actions([['add4', 'skip']]));
    expect(result.circuits.map((d) => [d.id, d.name, d.path])).toEqual([
      [MAIN_ID, '', ''],
      ['fa', 'FA', 'lib'],
      ['add4', '4 ビット加算器', 'lib'],
      ['mul0', '乗算器', 'lib'],
      ['ha', '半加算器', 'lib'],
      ['cmp', '比較器', 'lib'],
      ['mul', '乗算器 (2)', 'lib'],
    ]);
    // 置き換えた回路の中身はファイルのもの
    expect(findDef(result, 'fa')?.parts.map((c) => c.id)).toEqual(['i', 'j', 'u1']);
    // フォルダの一覧は変えない
    expect(result.folders).toEqual(['lib']);
  });

  it('指す回路が見つかったモジュールの部品から、名前と大きさの写しを外す。見つからないままなら残す', () => {
    const found = importCircuits(project, file, 'lib', actions());
    expect(findDef(found, 'fa')?.parts[2]).toEqual(mod('u1', 'ha'));
    const notFound = importCircuits(project, file, 'lib', actions([['ha', 'skip']]));
    expect(findDef(notFound, 'fa')?.parts[2]).toEqual(missing('u1', 'ha', '半加算器'));
  });

  it('今まで見つからなかったプロジェクトのモジュールも、読み込んだ回路で見つかれば写しを外す', () => {
    const before: Project = { circuits: [def(MAIN_ID, '', [missing('u9', 'cmp', '比較器')])] };
    const after = importCircuits(before, [def('cmp', '比較器')], '', new Map());
    expect(findDef(after, MAIN_ID)?.parts[0]).toEqual(mod('u9', 'cmp'));
  });

  it('読み込むとモジュールの置き方が循環する回路に印を付ける', () => {
    // プロジェクトの P は Q を置いている。ファイルの Q (同じ ID) は P を置く
    const before: Project = {
      circuits: [def(MAIN_ID, ''), def('p', 'P', [mod('u1', 'q')]), def('q', 'Q')],
    };
    const incoming = [def('q', 'Q', [mod('u2', 'p')])];
    expect(planImport(before, incoming, '', new Map())[0].cycle).toBe(true);
    expect(planImport(before, incoming, '', new Map([['q', 'skip']]))[0].cycle).toBe(false);
  });
});
