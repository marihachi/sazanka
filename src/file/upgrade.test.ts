import { describe, expect, it } from 'vitest';
import { upgradeProject } from './upgrade';
import { upgradeV1 } from './upgradeV1';
import { upgradeV2 } from './upgradeV2';
import { upgradeV3 } from './upgradeV3';

/** 呼ぶたびに id1, id2, … を返す ID の作り方 (テスト用)。比べる両方に、新しく作ったものを渡す */
function counter(): () => string {
  let n = 0;
  return () => `id${++n}`;
}

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

  it('version 1 は、version 1 → 2、2 → 3、3 → 4 の変換を順に通す', () => {
    expect(upgradeProject(v1, 1, counter())).toEqual(
      upgradeV3(upgradeV2(upgradeV1(v1)), counter()),
    );
  });

  it('version 2 は、version 2 → 3 と 3 → 4 の変換を通す', () => {
    const v2 = upgradeV1(v1);
    expect(upgradeProject(v2, 2, counter())).toEqual(upgradeV3(upgradeV2(v2), counter()));
  });

  it('version 3 は、version 3 → 4 の変換だけを通す', () => {
    const v3 = upgradeV2(upgradeV1(v1));
    expect(upgradeProject(v3, 3, counter())).toEqual(upgradeV3(v3, counter()));
  });

  it('今の版は、そのまま返す', () => {
    const v4 = upgradeV3(upgradeV2(upgradeV1(v1)), counter());
    expect(upgradeProject(v4, 4, counter())).toBe(v4);
  });

  it('1 より小さい版や整数でない版は、version 1 から変える', () => {
    expect(upgradeProject(v1, 0, counter())).toEqual(upgradeProject(v1, 1, counter()));
    expect(upgradeProject(v1, 1.5, counter())).toEqual(upgradeProject(v1, 1, counter()));
  });
});
