import { describe, expect, it } from 'vitest';
import { routeV1, upgradeV1 } from './upgradeV1';

describe('routeV1', () => {
  const axisAligned = (route: { x: number; y: number }[]) =>
    route.every((p, i) => i === 0 || p.x === route[i - 1].x || p.y === route[i - 1].y);

  it('折れる点がなければ、中間で1回折れる', () => {
    expect(routeV1({ x: 0, y: 0 }, [], { x: 100, y: 40 })).toEqual([
      { x: 0, y: 0 },
      { x: 60, y: 0 },
      { x: 60, y: 40 },
      { x: 100, y: 40 },
    ]);
  });

  it('折れる点を順に通り、縦横の線だけでつなぐ', () => {
    // biome-ignore format: 表形式を維持するため
    const points = [
      { x: 200, y: 100 },
      { x: 60, y: 200 },
    ];
    const route = routeV1({ x: 0, y: 0 }, points, { x: 300, y: 300 });
    expect(axisAligned(route)).toBe(true);
    // 置いた点は、どこかの区間の上を通る (曲がらない点は、点の並びからは省かれる)
    const onRoute = (p: { x: number; y: number }) =>
      route.some((q, i) => {
        if (i === 0) {
          return false;
        }
        const r = route[i - 1];
        return (
          p.x >= Math.min(q.x, r.x) &&
          p.x <= Math.max(q.x, r.x) &&
          p.y >= Math.min(q.y, r.y) &&
          p.y <= Math.max(q.y, r.y)
        );
      });
    for (const p of points) {
      expect(onRoute(p)).toBe(true);
    }
  });

  it('両端が同じ高さなら、折れずにまっすぐつなぐ', () => {
    expect(routeV1({ x: 0, y: 40 }, [], { x: 100, y: 40 })).toEqual([
      { x: 0, y: 40 },
      { x: 100, y: 40 },
    ]);
    // 折れる点が一直線に並んでいても、長さ 0 の区間や曲がらない角を残さない
    expect(
      routeV1({ x: 0, y: 40 }, [{ x: 60, y: 40 }], { x: 100, y: 40 }),
      // biome-ignore format: 表形式を維持するため
    ).toEqual([
      { x: 0, y: 40 },
      { x: 100, y: 40 },
    ]);
  });

  it('入力ピンへは横から入る', () => {
    const route = routeV1({ x: 0, y: 0 }, [{ x: 200, y: 100 }], {
      x: 300,
      y: 300,
    });
    const [a, b] = route.slice(-2);
    expect(a.y).toBe(b.y);
  });
});

describe('upgradeV1', () => {
  // INPUT a の出力ピンの先は (60, 20)、OUTPUT o の入力ピンの先は (180, 60)
  // biome-ignore format: 表形式を維持するため
  const components = [
    { id: 'a', kind: 'INPUT', x: 0, y: 0 },
    { id: 'o', kind: 'OUTPUT', x: 200, y: 40 },
  ];

  function circuits(wires: unknown[]) {
    return { circuits: [{ id: 'main', name: 'メイン', components, wires }] };
  }

  it('配線を、version 1 のアプリが描いていた形の点の並びにする', () => {
    const v1 = circuits([{ id: 'w', from: { comp: 'a', pin: 0 }, to: { comp: 'o', pin: 0 } }]);
    expect(upgradeV1(v1)).toEqual(
      circuits([
        {
          id: 'w',
          // 両端の真ん中 (x = 120) で 1 回折れる
          points: [
            { x: 60, y: 20 },
            { x: 120, y: 20 },
            { x: 120, y: 60 },
            { x: 180, y: 60 },
          ],
        },
      ]),
    );
  });

  it('利用者が置いた折れる点を通る', () => {
    const v1 = circuits([
      {
        id: 'w',
        from: { comp: 'a', pin: 0 },
        to: { comp: 'o', pin: 0 },
        points: [
          { x: 100, y: 100 },
          { x: 140, y: 100 },
        ],
      },
    ]);
    expect(upgradeV1(v1)).toEqual(
      circuits([
        {
          id: 'w',
          points: [
            { x: 60, y: 20 },
            { x: 100, y: 20 },
            { x: 100, y: 100 },
            { x: 140, y: 100 },
            { x: 140, y: 60 },
            { x: 180, y: 60 },
          ],
        },
      ]),
    );
  });

  it('存在しない部品やピンを指す配線は捨てる', () => {
    const v1 = circuits([
      { id: 'w1', from: { comp: 'x', pin: 0 }, to: { comp: 'o', pin: 0 } },
      { id: 'w2', from: { comp: 'a', pin: 1 }, to: { comp: 'o', pin: 0 } },
    ]);
    expect(upgradeV1(v1)).toEqual(circuits([]));
  });

  it('形の正しくないデータは、そのまま返す (このあとの検証で断る)', () => {
    expect(upgradeV1(null)).toBeNull();
    const broken = { circuits: [{ id: 'main', components: [{ id: 1 }], wires: [] }] };
    expect(upgradeV1(broken)).toBe(broken);
  });
});
