import { describe, expect, it } from 'vitest';
import { CIRCUIT_FORMAT_VERSION } from './upgrade';
import { type CircuitDef, MAIN_ID, type Project } from '../circuit/project';
import { getCircuitsFileName, parseCircuits, serializeCircuits } from './circuitsFile';
import { serializeProject } from './projectFile';

/** アプリの中の形の回路。位置は px */
const circuit = (id: string, name: string, extra: Partial<CircuitDef> = {}): CircuitDef => ({
  id,
  name,
  path: '',
  author: '',
  package: { kind: 'split' },
  sheet: { width: 40, height: 30 },
  parts: [{ id: `${id}-i`, kind: 'input', x: 0, y: 0, on: true, portNumber: 1 }],
  wires: [],
  ...extra,
});

// メインに A を置き、A に B を置く。C はどこにも置かない
const project: Project = {
  folders: ['lib'],
  circuits: [
    circuit(MAIN_ID, '', { parts: [{ id: 'm1', kind: 'module', x: 100, y: 0, circuitId: 'a' }] }),
    circuit('a', '全加算器', {
      path: 'lib',
      parts: [{ id: 'm2', kind: 'module', x: 100, y: 0, circuitId: 'b' }],
    }),
    circuit('b', '半加算器', { path: 'lib' }),
    circuit('c', '比較器'),
  ],
};

/** 決まった ID を順に出す (読み込んだ部品と配線に付ける ID) */
const counter = () => {
  let n = 0;
  return () => `n${++n}`;
};

describe('serializeCircuits', () => {
  it('選んだ回路を、プロジェクトの並びの順に回路の形式で書く。フォルダとメイン回路の扱いはしない', () => {
    const data = JSON.parse(serializeCircuits(project, ['c', 'a']));
    expect(data.format).toBe('sazanka-circuits');
    expect(data.version).toBe(1);
    expect(data.circuits.map((c: { id: string }) => c.id)).toEqual(['a', 'c']);
    expect(data.circuits[0]).not.toHaveProperty('path');
    expect(data.circuits[0].format).toBe('sazanka-circuit');
  });

  it('モジュールの部品に、指す回路の名前と大きさの写しを書く。ON/OFF は書かない', () => {
    const data = JSON.parse(serializeCircuits(project, ['a']));
    const part = data.circuits[0].elements.find((e: { kind: string }) => e.kind === 'module');
    expect(part.circuitName).toBe('半加算器');
    expect(part.circuitSize).toEqual(expect.objectContaining({ width: expect.any(Number) }));
    expect(JSON.stringify(data)).not.toContain('"on"');
  });
});

describe('parseCircuits', () => {
  it('書き出したものを読み直すと、ID と中身が同じ回路になる (フォルダなし)', () => {
    const result = parseCircuits(serializeCircuits(project, ['a', 'b']), counter());
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.circuits.map((d) => [d.id, d.name, d.path])).toEqual([
      ['a', '全加算器', ''],
      ['b', '半加算器', ''],
    ]);
    // モジュールの部品は、指す回路があるかまだ分からないので、写しを残す
    const part = result.circuits[0].parts.find((c) => c.kind === 'module');
    expect(part).toEqual(expect.objectContaining({ circuitId: 'b', circuitName: '半加算器' }));
    // 部品の ID は新しく付ける
    expect(part?.id).toMatch(/^n\d+$/);
    // ON/OFF は読まない
    expect(result.circuits[1].parts[0]).not.toHaveProperty('on');
  });

  it('JSON でないもの、sazanka のものでないものを見分ける', () => {
    expect(parseCircuits('{', counter())).toEqual({ ok: false, error: { code: 'NOT_JSON' } });
    expect(parseCircuits('[]', counter())).toEqual({ ok: false, error: { code: 'NOT_SAZANKA' } });
    expect(parseCircuits('{"format":"other"}', counter())).toEqual({
      ok: false,
      error: { code: 'NOT_SAZANKA' },
    });
  });

  it('プロジェクトファイル (一体の形式を含む) と、回路の形式だけのデータは、種類が違うとして断る', () => {
    expect(parseCircuits(serializeProject(project), counter())).toEqual({
      ok: false,
      error: { code: 'PROJECT_FILE' },
    });
    expect(parseCircuits('{"version":4,"project":{}}', counter())).toEqual({
      ok: false,
      error: { code: 'PROJECT_FILE' },
    });
    const one = JSON.parse(serializeCircuits(project, ['c'])).circuits[0];
    expect(parseCircuits(JSON.stringify(one), counter())).toEqual({
      ok: false,
      error: { code: 'SINGLE_CIRCUIT' },
    });
  });

  it('古い版の回路は、今の版に変えてから読む (version 1 の NOT は、ピンの先が同じ場所に残るようにずらす)', () => {
    const data = JSON.parse(serializeCircuits(project, ['c']));
    data.circuits[0].version = 1;
    data.circuits[0].elements.push({ kind: 'not', x: 10, y: 20 });
    const result = parseCircuits(JSON.stringify(data), counter());
    if (!result.ok) {
      throw new Error('読み込めなかった');
    }
    // 位置はアプリの中では px (1 マス 20px)。y を 1 マス下げる
    expect(result.circuits[0].parts.find((p) => p.kind === 'not')).toMatchObject({
      x: 200,
      y: 420,
    });
  });

  it('ファイルか中の回路が今より新しい版なら断る', () => {
    const data = JSON.parse(serializeCircuits(project, ['c']));
    expect(parseCircuits(JSON.stringify({ ...data, version: 2 }), counter())).toEqual({
      ok: false,
      error: { code: 'NEWER_VERSION' },
    });
    data.circuits[0].version = CIRCUIT_FORMAT_VERSION + 1;
    expect(parseCircuits(JSON.stringify(data), counter())).toEqual({
      ok: false,
      error: { code: 'NEWER_VERSION' },
    });
  });

  it('壊れたものは、検証で見つかった問題を添えて断る', () => {
    const data = JSON.parse(serializeCircuits(project, ['b', 'c']));
    const broken = (d: unknown) => {
      const result = parseCircuits(JSON.stringify(d), counter());
      return result.ok ? undefined : result.error;
    };
    expect(broken({ ...data, circuits: undefined })).toEqual({
      code: 'BROKEN',
      detail: { code: 'NO_CIRCUITS' },
    });
    // メイン回路は入れられない
    const main = JSON.parse(serializeProject(project)).circuits[0].circuit;
    expect(broken({ ...data, circuits: [...data.circuits, main] })).toEqual({
      code: 'BROKEN',
      detail: { code: 'HAS_MAIN' },
    });
    // 回路の ID は重ならない
    expect(broken({ ...data, circuits: [data.circuits[0], data.circuits[0]] })).toEqual({
      code: 'BROKEN',
      detail: { code: 'DUPLICATE_ID', id: 'b' },
    });
    // 中の回路は、プロジェクトの中の回路と同じに確かめる
    expect(broken({ ...data, circuits: [{ ...data.circuits[0], package: undefined }] })).toEqual({
      code: 'BROKEN',
      detail: { code: 'NO_PACKAGE', circuit: '半加算器', circuitId: 'b' },
    });
  });

  it('名前の重なる回路は読める (持ち込むときに名前を変える)', () => {
    const data = JSON.parse(serializeCircuits(project, ['b', 'c']));
    data.circuits[1].name = '半加算器';
    expect(parseCircuits(JSON.stringify(data), counter()).ok).toBe(true);
  });
});

describe('getCircuitsFileName', () => {
  const date = new Date(2026, 9, 23, 12, 0);
  it('回路が 1 つならその名前、2 つ以上なら日付の名前', () => {
    expect(getCircuitsFileName([circuit('a', '全加算器')], date)).toBe('全加算器.sazanka.json');
    expect(getCircuitsFileName([circuit('a', 'A'), circuit('b', 'B')], date)).toBe(
      'circuits-2026-10-23.sazanka.json',
    );
  });

  it('ファイル名に使えない文字は「_」にし、使える名前が残らなければ日付の名前にする', () => {
    expect(getCircuitsFileName([circuit('a', 'a/b:c*?"<>|\\d')], date)).toBe(
      'a_b_c_______d.sazanka.json',
    );
    expect(getCircuitsFileName([circuit('a', ' ... ')], date)).toBe(
      'circuits-2026-10-23.sazanka.json',
    );
  });
});
