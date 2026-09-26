import { type Point, wireRoute } from '../engine/layout';

/** 配線の角を丸めるときの半径 (px)。短い区間では、隣の角と重ならないよう区間の長さの半分までに抑える */
const WIRE_CORNER_RADIUS = 6;

/**
 * 配線の SVG のパス。折れる点の間を縦横の線でつなぐ (layout.ts の wireRoute)。
 * round なら、曲がり角を丸める (環境設定)
 */
export function wirePath(
  from: Point,
  points: readonly Point[],
  to: Point,
  round: boolean,
): string {
  const route = wireRoute(from, points, to);
  if (!round) {
    return `M${route.map((p) => `${p.x},${p.y}`).join(' L')}`;
  }
  let d = `M${route[0].x},${route[0].y}`;
  for (let i = 1; i < route.length - 1; i++) {
    const [a, b, c] = [route[i - 1], route[i], route[i + 1]];
    const inLen = Math.hypot(b.x - a.x, b.y - a.y);
    const outLen = Math.hypot(c.x - b.x, c.y - b.y);
    const r = Math.min(WIRE_CORNER_RADIUS, inLen / 2, outLen / 2);
    // 長さ 0 の区間があると向きが決まらないので、丸めずに角のまま通る (wireRoute が省くので、通常は来ない)
    if (r === 0) {
      d += ` L${b.x},${b.y}`;
      continue;
    }
    // 角の少し手前まで直線で行き、角を制御点にした曲線で、角の少し先へつなぐ
    const before = {
      x: b.x - ((b.x - a.x) / inLen) * r,
      y: b.y - ((b.y - a.y) / inLen) * r,
    };
    const after = {
      x: b.x + ((c.x - b.x) / outLen) * r,
      y: b.y + ((c.y - b.y) / outLen) * r,
    };
    d += ` L${before.x},${before.y} Q${b.x},${b.y} ${after.x},${after.y}`;
  }
  const end = route[route.length - 1];
  return `${d} L${end.x},${end.y}`;
}
