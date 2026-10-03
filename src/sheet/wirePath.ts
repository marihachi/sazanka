import { type Point, wireRoute } from '../geometry/layout';

/** 配線の角を丸めるときの半径 (px)。短い区間では、隣の角と重ならないよう区間の長さの半分までに抑える */
const WIRE_CORNER_RADIUS = 6;

/**
 * 配線の SVG のパス。折れる点の間を縦横の線でつなぐ (geometry/layout.ts の wireRoute)。
 * round なら、曲がり角を丸める (環境設定)
 */
export function wirePath(from: Point, points: readonly Point[], to: Point, round: boolean): string {
  // route は、始点・曲がり角・終点を順に並べた点 (どの区間も縦か横)。
  // SVG のパスでは、M x,y が始点への移動、L x,y がそこまでの直線、Q cx,cy x,y が cx,cy を制御点にした曲線
  const route = wireRoute(from, points, to);
  if (!round) {
    // 角を丸めないなら、点を直線でつなぐだけ (例: M0,0 L40,0 L40,60 L80,60)
    return `M${route.map((p) => `${p.x},${p.y}`).join(' L')}`;
  }
  let d = `M${route[0].x},${route[0].y}`;
  // 両端を除く各点 b が曲がり角。a から b へ来て、b から c へ出ていく
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
    // 角の少し手前まで直線で行き、角を制御点にした曲線で、角の少し先へつなぐ。
    // (b - a) / inLen は a から b へ向かう長さ 1 の向きなので、それに r を掛けると、角から r だけ戻った点になる
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
