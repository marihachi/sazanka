import { describe, expect, it } from 'vitest';
import {
  CIRCUIT_FORMAT_VERSION,
  upgradeCircuit,
  upgradeIntegratedProject,
  upgradeStoredProject,
} from '.';
import { upgradeToProjectV1 } from './project/v1';
import { upgradeV1 } from './integrated/upgradeV1';
import { upgradeV2 } from './integrated/upgradeV2';
import { upgradeV3 } from './integrated/upgradeV3';

/** 呼ぶたびに id1, id2, … を返す ID の作り方 (テスト用)。比べる両方に、新しく作ったものを渡す */
/** プロジェクトの形式のデータの中の回路を、回路の形式の今の版にしたもの (テストの期待値を作るため) */
function upgradeProjectToLatest(project: unknown): unknown {
  const p = project as { circuits: { circuit: unknown }[] };
  return { ...p, circuits: p.circuits.map((e) => ({ ...e, circuit: upgradeCircuit(e.circuit) })) };
}

function counter(): () => string {
  let n = 0;
  return () => `id${++n}`;
}

describe('upgradeIntegratedProject', () => {
  // INPUT の出力ピンから OUTPUT の入力ピンへの、version 1 の配線
  const v1 = {
    circuits: [
      {
        id: 'main',
        name: 'メイン',
        // biome-ignore format: 表形式を維持するため
        components: [
          { id: 'a', kind: 'INPUT', x: 0, y: 0 },
          { id: 'o', kind: 'OUTPUT', x: 200, y: 0 },
        ],
        wires: [{ id: 'w', from: { comp: 'a', pin: 0 }, to: { comp: 'o', pin: 0 } }],
      },
    ],
  };

  it('version 1 は、version 1 → 2、2 → 3、3 → 4 の変換を順に通す', () => {
    expect(upgradeIntegratedProject(v1, 1, counter())).toEqual(
      upgradeV3(upgradeV2(upgradeV1(v1)), counter()),
    );
  });

  it('version 2 は、version 2 → 3 と 3 → 4 の変換を通す', () => {
    const v2 = upgradeV1(v1);
    expect(upgradeIntegratedProject(v2, 2, counter())).toEqual(upgradeV3(upgradeV2(v2), counter()));
  });

  it('version 3 は、version 3 → 4 の変換だけを通す', () => {
    const v3 = upgradeV2(upgradeV1(v1));
    expect(upgradeIntegratedProject(v3, 3, counter())).toEqual(upgradeV3(v3, counter()));
  });

  it('今の版は、そのまま返す', () => {
    const v4 = upgradeV3(upgradeV2(upgradeV1(v1)), counter());
    expect(upgradeIntegratedProject(v4, 4, counter())).toBe(v4);
  });

  it('1 より小さい版や整数でない版は、version 1 から変える', () => {
    expect(upgradeIntegratedProject(v1, 0, counter())).toEqual(
      upgradeIntegratedProject(v1, 1, counter()),
    );
    expect(upgradeIntegratedProject(v1, 1.5, counter())).toEqual(
      upgradeIntegratedProject(v1, 1, counter()),
    );
  });
});

describe('upgradeCircuit', () => {
  it('古い版の回路を、1 版ずつ今の版まで変える', () => {
    const circuit = {
      format: 'sazanka-circuit',
      version: 1,
      elements: [{ kind: 'not', x: 3, y: 4 }],
    };
    expect(upgradeCircuit(circuit)).toEqual({
      format: 'sazanka-circuit',
      version: CIRCUIT_FORMAT_VERSION,
      elements: [{ kind: 'not', x: 3, y: 5 }],
    });
  });

  it('今の版、新しい版、版が正しくないものは、そのまま返す', () => {
    for (const version of [
      CIRCUIT_FORMAT_VERSION,
      CIRCUIT_FORMAT_VERSION + 1,
      0,
      1.5,
      '1',
      undefined,
    ]) {
      const circuit = {
        format: 'sazanka-circuit',
        version,
        elements: [{ kind: 'not', x: 3, y: 4 }],
      };
      expect(upgradeCircuit(circuit)).toBe(circuit);
    }
    expect(upgradeCircuit('x')).toBe('x');
  });
});

describe('upgradeStoredProject', () => {
  const v1 = {
    circuits: [
      {
        id: 'main',
        name: 'メイン',
        components: [{ id: 'a', kind: 'INPUT', x: 0, y: 0 }],
        wires: [],
      },
    ],
  };

  it('一体の形式は、version 4 まで順に変えてから、プロジェクトの形式 v1 に変える (保存データとプロジェクトファイルの包み)', () => {
    // 回路はプロジェクトの形式 v1 に変えたあと、回路の形式の今の版まで変える
    const expected = upgradeProjectToLatest(
      upgradeToProjectV1(upgradeIntegratedProject(v1, 1, counter())),
    );
    expect(upgradeStoredProject({ version: 1, project: v1 }, counter())).toEqual({
      ok: true,
      project: expected,
    });
    expect(upgradeStoredProject({ app: 'sazanka', version: 1, project: v1 }, counter())).toEqual({
      ok: true,
      project: expected,
    });
  });

  it('プロジェクトの形式の今の版は、そのまま返す', () => {
    const project = { format: 'sazanka-project', version: 1, folders: [], circuits: [] };
    expect(upgradeStoredProject(project, counter())).toEqual({ ok: true, project });
  });

  it('プロジェクトの形式の中の古い版の回路は、回路の形式の今の版に変える', () => {
    const circuit = { format: 'sazanka-circuit', version: 1, id: 'main', elements: [] };
    const project = {
      format: 'sazanka-project',
      version: 1,
      folders: [],
      circuits: [{ path: '', circuit }],
    };
    const result = upgradeStoredProject(project, counter());
    expect(result).toEqual({
      ok: true,
      project: {
        ...project,
        circuits: [{ path: '', circuit: { ...circuit, version: CIRCUIT_FORMAT_VERSION } }],
      },
    });
  });

  it('今より新しい版は、理由を返す (一体の形式、プロジェクト、中のモジュール)', () => {
    for (const data of [
      { version: 5, project: v1 },
      { format: 'sazanka-project', version: 2, folders: [], circuits: [] },
      {
        format: 'sazanka-project',
        version: 1,
        folders: [],
        circuits: [{ path: '', circuit: { format: 'sazanka-circuit', version: 3 } }],
      },
    ]) {
      expect(upgradeStoredProject(data, counter())).toEqual({
        ok: false,
        error: { code: 'NEWER_VERSION' },
      });
    }
  });

  it('モジュールのデータとモジュールファイルは、種類が違うことを返す', () => {
    for (const format of ['sazanka-circuit', 'sazanka-circuits']) {
      expect(upgradeStoredProject({ format, version: 1 }, counter())).toEqual({
        ok: false,
        error: { code: 'CIRCUIT_FILE' },
      });
    }
  });

  it('プロジェクトのデータでないものは、理由を返す', () => {
    for (const data of [null, 1, [], {}, { circuits: [] }, { format: 'other' }, { version: 1 }]) {
      expect(upgradeStoredProject(data, counter())).toEqual({
        ok: false,
        error: { code: 'NOT_PROJECT' },
      });
    }
  });
});
