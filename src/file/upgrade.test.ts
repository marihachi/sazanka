import { describe, expect, it } from 'vitest';
import { upgradeProject } from './upgrade';
import { upgradeV1 } from './upgradeV1';

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

  it('version 1 は、version 1 → 2 の変換を通す', () => {
    expect(upgradeProject(v1, 1)).toEqual(upgradeV1(v1));
  });

  it('今の版は、そのまま返す', () => {
    const v2 = upgradeV1(v1);
    expect(upgradeProject(v2, 2)).toBe(v2);
  });

  it('1 より小さい版や整数でない版は、version 1 から変える', () => {
    expect(upgradeProject(v1, 0)).toEqual(upgradeV1(v1));
    expect(upgradeProject(v1, 1.5)).toEqual(upgradeV1(v1));
  });
});
