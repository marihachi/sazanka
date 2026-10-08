import type { PartBodyProps } from '../bodies';

/** 光っているセグメントと、光っていないセグメントの色。光っている色は OUTPUT のランプと同じ */
const ON = 'var(--chakra-colors-sheet-on)';
const OFF = '#333';

/** ピンのある辺の内側に空ける幅 (px)。ピン名を書く場所 */
const PIN_NAME_SPACE = 18;
/** ピンのない辺の内側に空ける幅 (px) */
const PADDING = 12;

/** 数字の傾き (度)。実物の多くの表示器と同じく、右に傾ける */
const SLANT_DEG = 10;
/** 数字の枠の、高さ / 幅。実物の表示器 (例: 0.56 インチの 1 桁で、およそ 14 mm × 8 mm) に近づける */
const ASPECT = 1.75;
/** セグメントの太さの、数字の枠の幅に対する割合 */
const THICKNESS = 0.17;

/**
 * 7 セグメントディスプレイの描き込み。入力ピン a〜g でセグメントを、DP で小数点を光らせる。
 * 実物の表示器に寄せて、数字を右に傾け (SLANT_DEG)、小数点は右下に置く。
 * 数字の枠は、傾けた分と小数点の分も含めて、ピン名の場所を除いた本体の中に収めて真ん中に置く
 */
export function SevenSegmentBody({ w, h, layout, inputValues }: PartBodyProps) {
  const sides = new Set(layout.inputs.map((p) => p.side));
  const space = (side: 'left' | 'right' | 'top' | 'bottom') =>
    sides.has(side) ? PIN_NAME_SPACE : PADDING;
  const left = space('left');
  const top = space('top');
  const areaW = w - left - space('right');
  const areaH = h - top - space('bottom');
  const slant = Math.tan((SLANT_DEG * Math.PI) / 180);
  // 横に使う幅を、枠の幅 dw を 1 とした長さで求める。傾けると上が右に、下が左に (枠の高さの半分 × slant) ずれる。
  // 小数点は右下 (枠の右端から太さの 1.1 倍の所、半径は太さの 0.6 倍) にあり、下にあるぶん左にずれる
  const shift = (ASPECT / 2) * slant;
  const dpCenter = 1 + THICKNESS * 1.1 - (ASPECT / 2 - THICKNESS / 2) * slant;
  const extLeft = shift;
  const extRight = Math.max(1 + shift, dpCenter + THICKNESS * 0.6);
  const dw = Math.min(areaW / (extLeft + extRight), areaH / ASPECT);
  const dh = dw * ASPECT;
  const t = dw * THICKNESS;
  // 傾けた分と小数点も含めた全体を、使える場所の真ん中に置く
  const x0 = left + (areaW - dw * (extLeft + extRight)) / 2 + dw * extLeft;
  const y0 = top + (areaH - dh) / 2;
  const cy = y0 + dh / 2;
  const segments = calcSegments(x0, y0, dw, dh, t);
  const on = (i: number) => (inputValues[i] ? ON : OFF);
  // 小数点は、傾けると楕円になるので、傾けた位置だけを求めて円のまま描く (skewX は x を (y - cy) × slant だけ左へずらす)
  const dpY = y0 + dh - t / 2;
  const dpX = x0 + dw * dpCenter;
  return (
    <g pointerEvents="none">
      <g transform={`translate(0 ${cy}) skewX(${-SLANT_DEG}) translate(0 ${-cy})`}>
        {segments.map((points, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: セグメントの並びはピン番号 (a〜g) そのもの
          <polygon key={i} points={points} fill={on(i)} />
        ))}
      </g>
      <circle cx={dpX} cy={dpY} r={t * 0.6} fill={on(7)} />
    </g>
  );
}

/**
 * セグメント a〜g の形 (六角形の頂点の並び)。枠の左上 (x, y)、幅 dw、高さ dh、太さ t。
 * a は上、b は右上、c は右下、d は下、e は左下、f は左上、g は真ん中
 */
function calcSegments(x: number, y: number, dw: number, dh: number, t: number): string[] {
  const g = t * 0.2; // セグメントどうしのすき間
  const half = t / 2;
  const mid = y + dh / 2;
  /** 横のセグメント。中心の高さ cy */
  const horizontal = (cy: number) =>
    [
      [x + half + g, cy],
      [x + t + g, cy - half],
      [x + dw - t - g, cy - half],
      [x + dw - half - g, cy],
      [x + dw - t - g, cy + half],
      [x + t + g, cy + half],
    ]
      .map((p) => p.join(','))
      .join(' ');
  /** 縦のセグメント。中心の横位置 cx、上端 y1、下端 y2 */
  const vertical = (cx: number, y1: number, y2: number) =>
    [
      [cx, y1 + g],
      [cx + half, y1 + half + g],
      [cx + half, y2 - half - g],
      [cx, y2 - g],
      [cx - half, y2 - half - g],
      [cx - half, y1 + half + g],
    ]
      .map((p) => p.join(','))
      .join(' ');
  const lx = x + half;
  const rx = x + dw - half;
  return [
    horizontal(y + half),
    vertical(rx, y + half, mid),
    vertical(rx, mid, y + dh - half),
    horizontal(y + dh - half),
    vertical(lx, mid, y + dh - half),
    vertical(lx, y + half, mid),
    horizontal(mid),
  ];
}
