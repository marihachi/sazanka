import { describe, expect, it } from 'vitest';
import { upgradeProject } from './upgrade';
import { upgradeV1 } from './upgradeV1';
import { upgradeV2 } from './upgradeV2';

describe('upgradeProject', () => {
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

  it('version 1 は、version 1 → 2 と 2 → 3 の変換を順に通す', () => {
    expect(upgradeProject(v1, 1)).toEqual(upgradeV2(upgradeV1(v1)));
  });

  it('version 2 は、version 2 → 3 の変換だけを通す', () => {
    const v2 = upgradeV1(v1);
    expect(upgradeProject(v2, 2)).toEqual(upgradeV2(v2));
  });

  it('今の版は、そのまま返す', () => {
    const v3 = upgradeV2(upgradeV1(v1));
    expect(upgradeProject(v3, 3)).toBe(v3);
  });

  it('1 より小さい版や整数でない版は、version 1 から変える', () => {
    expect(upgradeProject(v1, 0)).toEqual(upgradeProject(v1, 1));
    expect(upgradeProject(v1, 1.5)).toEqual(upgradeProject(v1, 1));
  });
});
